"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BackLink } from "@/components/BackLink";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { baseName } from "@/lib/image-utils";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { FileCode, FileImage, FileText, FileType2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import JSZip from "jszip";
import { Document, Packer, Paragraph } from "docx";

// Worker-URL für Vite (wie in PdfSplit)
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
if (typeof pdfjsWorker === "string") {
  GlobalWorkerOptions.workerSrc = pdfjsWorker;
} else {
  GlobalWorkerOptions.workerSrc = (pdfjsWorker as URL).toString();
}

type PdfTarget =
  | "word"
  | "pptx"
  | "images-png"
  | "images-jpg"
  | "svg"
  | "html"
  | "text";

const TARGETS: { value: PdfTarget; key: string }[] = [
  { value: "word", key: "word" },
  { value: "pptx", key: "pptx" },
  { value: "images-png", key: "imagesPng" },
  { value: "images-jpg", key: "imagesJpg" },
  { value: "svg", key: "svg" },
  { value: "html", key: "html" },
  { value: "text", key: "text" },
];

async function extractPlainText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(`--- Page ${pageNumber} ---`, strings.trim(), "");
  }
  return parts.join("\n");
}

async function extractPlainTextPages(buffer: ArrayBuffer): Promise<string[]> {
  const pdf = await getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(strings.trim());
  }
  return pages;
}

async function renderImagesZip(
  buffer: ArrayBuffer,
  mime: "image/png" | "image/jpeg",
  fileBaseName: string,
): Promise<{ blob: Blob; filename: string }> {
  const pdf = await getDocument({ data: buffer }).promise;
  const zip = new JSZip();
  const ext = mime === "image/png" ? "png" : "jpg";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, 0.92),
    );
    if (!blob) continue;
    zip.file(`${fileBaseName}_page-${pageNumber}.${ext}`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  return {
    blob: zipBlob,
    filename: `${fileBaseName}_images_${ext}.zip`,
  };
}

async function renderSvgZip(
  buffer: ArrayBuffer,
  fileBaseName: string,
): Promise<{ blob: Blob; filename: string }> {
  const pdf = await getDocument({ data: buffer }).promise;
  const zip = new JSZip();

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png", 0.92);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}"><image href="${dataUrl}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });
    zip.file(`${fileBaseName}_page-${pageNumber}.svg`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  return {
    blob: zipBlob,
    filename: `${fileBaseName}_images_svg.zip`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function PdfConvert() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<PdfTarget>("word");
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    url: string;
    filename: string;
  } | null>(null);

  const onFileChange = useCallback((v: File | File[] | null) => {
    if (v === null) {
      setFile(null);
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      setError(null);
      return;
    }
    const f = Array.isArray(v) ? (v[0] ?? null) : v;
    setFile(f);
    setError(null);
  }, []);

  useEffect(
    () => () => {
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    },
    [],
  );

  const handleConvert = useCallback(async () => {
    if (!file) return;
    setError(null);
    setConverting(true);
    try {
      const buffer = await file.arrayBuffer();
      const base = baseName(file.name);

      if (target === "images-png" || target === "images-jpg") {
        const { blob, filename } = await renderImagesZip(
          buffer,
          target === "images-png" ? "image/png" : "image/jpeg",
          base,
        );
        const url = URL.createObjectURL(blob);
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url, filename };
        });
        return;
      }

      if (target === "svg") {
        const { blob, filename } = await renderSvgZip(buffer, base);
        const url = URL.createObjectURL(blob);
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url, filename };
        });
        return;
      }

      if (target === "text") {
        const text = await extractPlainText(buffer);
        const blob = new Blob([text], {
          type: "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url, filename: `${base}.txt` };
        });
        return;
      }

      if (target === "html") {
        const pages = await extractPlainTextPages(buffer);
        const sections = pages
          .map((content, index) => {
            const safe = escapeHtml(content).replace(/\n+/g, "<br/>");
            return `<section><h2>Seite ${index + 1}</h2><p>${safe}</p></section>`;
          })
          .join("\n\n");
        const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(base)}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; line-height: 1.5; }
    h2 { margin-top: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; font-size: 1.1rem; }
    section:first-of-type h2 { margin-top: 0; }
  </style>
</head>
<body>
${sections}
</body>
</html>`;
        const blob = new Blob([html], {
          type: "text/html;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url, filename: `${base}.html` };
        });
        return;
      }

      if (target === "word") {
        const text = await extractPlainText(buffer);
        const lines = text.split(/\r?\n/);
        const paragraphs = lines.map(
          (line) => new Paragraph(line.length ? line : " "),
        );
        const doc = new Document({
          sections: [
            {
              children: paragraphs,
            },
          ],
        });
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url, filename: `${base}.docx` };
        });
        return;
      }

      if (target === "pptx") {
        const pages = await extractPlainTextPages(buffer);
        const { default: PptxGenJS } = await import("pptxgenjs");
        const pptx = new PptxGenJS();
        pages.forEach((content, index) => {
          const slide = pptx.addSlide();
          slide.addText(`Seite ${index + 1}`, {
            x: 0.5,
            y: 0.3,
            fontSize: 20,
            bold: true,
          });
          slide.addText(content || "", {
            x: 0.5,
            y: 1.0,
            w: 9.0,
            h: 4.5,
            fontSize: 14,
            bullet: false,
          });
        });
        const blob = (await pptx.write({
          outputType: "blob",
        })) as Blob;
        const url = URL.createObjectURL(blob);
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { url, filename: `${base}.pptx` };
        });
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("files.page.genericError"));
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    } finally {
      setConverting(false);
    }
  }, [file, target, t]);

  const handleReset = useCallback(() => {
    setFile(null);
    setTarget("word");
    setError(null);
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const currentIcon =
    target === "word" || target === "pptx" ? (
      <FileType2 className="h-4 w-4" aria-hidden />
    ) : target === "text" || target === "html" ? (
      <FileText className="h-4 w-4" aria-hidden />
    ) : (
      <FileImage className="h-4 w-4" aria-hidden />
    );

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <BackLink to="/pdf" />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <FileType2 className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("pdf.tools.convert.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("pdf.tools.convert.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("pdf.convertPage.title")}</CardTitle>
          <CardDescription>{t("pdf.convertPage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label>{t("pdf.convertPage.fileLabel")}</Label>
            <FileDropzone
              value={file}
              onFileChange={onFileChange}
              accept={{ "application/pdf": [".pdf"] }}
              hint={t("pdf.convertPage.dropzoneHint")}
              activeHint={t("pdf.convertPage.dropzoneActive")}
              removeLabel={t("images.removeFile")}
              fileCountLabel={(count) => t("images.filesSelected", { count })}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("pdf.convertPage.targetLabel")}</Label>
            <Select
              value={target}
              onValueChange={(v) => setTarget(v as PdfTarget)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGETS.map(({ value, key }) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      {value === "word" || value === "pptx" ? (
                        <FileType2 className="h-4 w-4" aria-hidden />
                      ) : value === "text" || value === "html" ? (
                        <FileText className="h-4 w-4" aria-hidden />
                      ) : value === "svg" ? (
                        <FileCode className="h-4 w-4" aria-hidden />
                      ) : (
                        <FileImage className="h-4 w-4" aria-hidden />
                      )}
                      <span>{t(`pdf.convertPage.targets.${key}`)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={handleConvert}
            disabled={!file || converting}
            className="min-w-28"
          >
            {converting ? (
              "…"
            ) : (
              <span className="inline-flex items-center gap-2">
                {currentIcon}
                <span>{t("pdf.convertPage.convertBtn")}</span>
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!file && !result}
          >
            {t("pdf.convertPage.resetBtn")}
          </Button>
        </CardFooter>
      </Card>

      {result && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("pdf.convertPage.resultReady")}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={result.url}
              download={result.filename}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {currentIcon}
              <span>{t("pdf.convertPage.downloadResult")}</span>
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
