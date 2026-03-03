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
import { baseName, decodeImageFile } from "@/lib/image-utils";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { FileImage, FileInput, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import JSZip from "jszip";
import { incrementFeatureUsage } from "@/lib/usage-tracking";

type ToPdfSource = "image" | "svg" | "html" | "text" | "docx" | "pptx";

async function createPdfFromImage(file: File): Promise<Uint8Array> {
  const prepared = await decodeImageFile(file);
  const pdfDoc = await PDFDocument.create();

  const bytes = new Uint8Array(await prepared.arrayBuffer());
  const isPng = prepared.type === "image/png";
  const embedded = isPng
    ? await pdfDoc.embedPng(bytes)
    : await pdfDoc.embedJpg(bytes);

  const { width, height } = embedded.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width,
    height,
  });

  return pdfDoc.save();
}

async function createPngFromSvg(file: File): Promise<File> {
  const svgText = await file.text();
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("SVG konnte nicht in ein Bild geladen werden."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = loaded.naturalWidth || 800;
    canvas.height = loaded.naturalHeight || 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas wird nicht unterstützt.");
    ctx.drawImage(loaded, 0, 0);
    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png", 0.92),
    );
    if (!pngBlob) throw new Error("SVG konnte nicht in PNG umgewandelt werden.");
    const name = baseName(file.name) || "image";
    return new File([pngBlob], `${name}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function createPdfFromPlainText(text: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const lineHeight = fontSize * 1.4;
  const margin = 50;

  let page = pdfDoc.addPage();
  let { height } = page.getSize();
  let y = height - margin;

  const paragraphs = text.split(/\r?\n/);

  const drawLine = (line: string) => {
    if (y < margin) {
      page = pdfDoc.addPage();
      ({ height } = page.getSize());
      y = height - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  };

  const maxChars = 90;
  for (const para of paragraphs) {
    if (!para) {
      y -= lineHeight * 0.5;
      continue;
    }
    let rest = para;
    while (rest.length > 0) {
      const slice = rest.slice(0, maxChars);
      const lastSpace = slice.lastIndexOf(" ");
      const take = lastSpace > 40 ? lastSpace : slice.length;
      const line = rest.slice(0, take).trimEnd();
      drawLine(line);
      rest = rest.slice(take).trimStart();
    }
  }

  return pdfDoc.save();
}

function stripHtml(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.body.textContent ?? "";
  }
  return html.replace(/<[^>]+>/g, " ");
}

function detectSourceFromFile(file: File): ToPdfSource {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (type === "image/svg+xml" || name.endsWith(".svg")) return "svg";
  if (type.startsWith("image/")) return "image";
  if (type === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) {
    return "html";
  }
  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (
    type ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    name.endsWith(".pptx")
  ) {
    return "pptx";
  }
  if (
    type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown")
  ) {
    return "text";
  }
  return "text";
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function extractTextFromDocx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) return "";
  const xml = await docFile.async("text");
  const matches = Array.from(xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g));
  if (!matches.length) return "";
  return matches
    .map((m) => decodeXmlEntities((m[1] ?? "").trim()))
    .filter((s) => s.length > 0)
    .join(" ");
}

async function extractTextFromPptx(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const parts: string[] = [];
  let index = 1;
  // pptx speichert Folien unter ppt/slides/slideN.xml
  // Wir iterieren, bis keine weitere Datei existiert.
  while (true) {
    const path = `ppt/slides/slide${index}.xml`;
    const slideFile = zip.file(path);
    if (!slideFile) break;
    const xml = await slideFile.async("text");
    const matches = Array.from(xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g));
    const slideText = matches
      .map((m) => decodeXmlEntities((m[1] ?? "").trim()))
      .filter((s) => s.length > 0)
      .join(" ");
    if (slideText) {
      parts.push(`Slide ${index}: ${slideText}`);
    }
    index += 1;
  }
  return parts.join("\n\n");
}

export function PdfToPdf() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ToPdfSource>("image");
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
    if (f) {
      setSource(detectSourceFromFile(f));
    }
    setError(null);
  }, []);

  useEffect(() => {
    incrementFeatureUsage("pdf.toPdf");
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
      const base = baseName(file.name) || "document";
      let pdfBytes: Uint8Array | null = null;

      if (source === "image") {
        if (!file.type.startsWith("image/")) {
          throw new Error(t("pdf.toPdfPage.unsupportedCombination"));
        }
        pdfBytes = await createPdfFromImage(file);
      } else if (source === "svg") {
        if (file.type !== "image/svg+xml" && !file.name.toLowerCase().endsWith(".svg")) {
          throw new Error(t("pdf.toPdfPage.unsupportedCombination"));
        }
        const pngFile = await createPngFromSvg(file);
        pdfBytes = await createPdfFromImage(pngFile);
      } else if (source === "html") {
        const text = stripHtml(await file.text());
        pdfBytes = await createPdfFromPlainText(text);
      } else if (source === "text") {
        if (
          !file.type.startsWith("text/") &&
          !file.name.toLowerCase().match(/\.(txt|md|markdown)$/)
        ) {
          throw new Error(t("pdf.toPdfPage.unsupportedCombination"));
        }
        const text = await file.text();
        pdfBytes = await createPdfFromPlainText(text);
      } else if (source === "docx") {
        const lower = file.name.toLowerCase();
        if (
          !lower.endsWith(".docx") &&
          file.type !==
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          throw new Error(t("pdf.toPdfPage.unsupportedCombination"));
        }
        const text = await extractTextFromDocx(file);
        pdfBytes = await createPdfFromPlainText(text);
      } else if (source === "pptx") {
        const lower = file.name.toLowerCase();
        if (
          !lower.endsWith(".pptx") &&
          file.type !==
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ) {
          throw new Error(t("pdf.toPdfPage.unsupportedCombination"));
        }
        const text = await extractTextFromPptx(file);
        pdfBytes = await createPdfFromPlainText(text);
      }

      if (!pdfBytes) {
        throw new Error(t("pdf.toPdfPage.unsupportedCombination"));
      }

      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url, filename: `${base}.pdf` };
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("files.page.genericError"),
      );
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    } finally {
      setConverting(false);
    }
  }, [file, source, t]);

  const handleReset = useCallback(() => {
    setFile(null);
    setSource("image");
    setError(null);
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const currentIcon =
    source === "image" || source === "svg" ? (
      <FileImage className="h-4 w-4" aria-hidden />
    ) : (
      <FileText className="h-4 w-4" aria-hidden />
    );

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <BackLink to="/pdf" />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <FileInput className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("pdf.toPdfPage.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("pdf.toPdfPage.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("pdf.toPdfPage.title")}</CardTitle>
          <CardDescription>{t("pdf.toPdfPage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label>{t("pdf.toPdfPage.fileLabel")}</Label>
            <FileDropzone
              value={file}
              onFileChange={onFileChange}
              accept={{
                "image/jpeg": [".jpg", ".jpeg"],
                "image/png": [".png"],
                "image/webp": [".webp"],
                "image/gif": [".gif"],
                "image/svg+xml": [".svg"],
                "text/plain": [".txt"],
                "text/markdown": [".md", ".markdown"],
                "text/x-markdown": [".md"],
                "text/html": [".html", ".htm"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
                  ".docx",
                ],
                "application/vnd.openxmlformats-officedocument.presentationml.presentation":
                  [".pptx"],
              }}
              hint={t("pdf.toPdfPage.dropzoneHint")}
              activeHint={t("pdf.toPdfPage.dropzoneActive")}
              removeLabel={t("images.removeFile")}
              fileCountLabel={(count) => t("images.filesSelected", { count })}
            />
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
                <span>{t("pdf.toPdfPage.convertBtn")}</span>
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!file && !result}
          >
            {t("pdf.toPdfPage.resetBtn")}
          </Button>
        </CardFooter>
      </Card>

      {result && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("pdf.toPdfPage.resultReady")}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={result.url}
              download={result.filename}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {currentIcon}
              <span>{t("pdf.toPdfPage.downloadResult")}</span>
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

