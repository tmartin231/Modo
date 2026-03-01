import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { baseName, HEIC_PARSE_ERROR } from "@/lib/image-utils";
import { ArrowLeftRight, Download, FileArchive } from "lucide-react";
import heic2any from "heic2any";
import JSZip from "jszip";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const FORMATS = [
  { value: "image/jpeg", key: "jpg", ext: "jpg" },
  { value: "image/png", key: "png", ext: "png" },
  { value: "image/webp", key: "webp", ext: "webp" },
  { value: "image/gif", key: "gif", ext: "gif" },
] as const;

/** Skaliert SVG für höhere Auflösung (Quickpic-Logik). */
function scaleSvg(svgContent: string, scale: number): string {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgEl = svgDoc.documentElement;

  let w = parseInt(svgEl.getAttribute("width") ?? "", 10);
  let h = parseInt(svgEl.getAttribute("height") ?? "", 10);
  if (!w || !h) {
    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.trim().split(/\s+/);
      if (parts.length >= 4) {
        w = parseInt(parts[2]!, 10) || 300;
        h = parseInt(parts[3]!, 10) || 150;
      }
    }
    if (!w) w = 300;
    if (!h) h = 150;
  }

  const scaledW = Math.round(w * scale);
  const scaledH = Math.round(h * scale);
  svgEl.setAttribute("width", String(scaledW));
  svgEl.setAttribute("height", String(scaledH));
  return new XMLSerializer().serializeToString(svgDoc);
}

const SVG_SCALE = 2; // höhere Auflösung wie bei Quickpic

function convertSvgToBlob(
  svgContent: string,
  targetMime: string,
  scale: number = SVG_SCALE,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const scaledSvg = scaleSvg(svgContent, scale);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scaledSvg)}`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Conversion failed")),
        targetMime,
        0.92,
      );
    };
    img.onerror = () => reject(new Error("Failed to load SVG"));
    img.src = dataUrl;
  });
}

const HEIC_TYPES = ["image/heic", "image/heif"];

function isHeic(file: File): boolean {
  return HEIC_TYPES.includes(file.type);
}

function convertHeicToBlob(file: File, targetMime: string): Promise<Blob> {
  const direct = targetMime === "image/png" || targetMime === "image/jpeg";
  const toType = targetMime === "image/png" ? "image/png" : "image/jpeg";
  return heic2any({
    blob: file,
    toType,
    quality: 0.92,
  })
    .then((result) => {
      const blob = Array.isArray(result) ? result[0] : result;
      if (!blob || !(blob instanceof Blob)) throw new Error(HEIC_PARSE_ERROR);
      if (direct && targetMime === toType) return blob;
      if (targetMime === "image/webp" || targetMime === "image/gif")
        return blobToTarget(blob, targetMime);
      return blob;
    })
    .catch(() => {
      throw new Error(HEIC_PARSE_ERROR);
    });
}

function blobToTarget(blob: Blob, targetMime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Conversion failed"))),
        targetMime,
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function convertImage(file: File, targetMime: string): Promise<Blob> {
  if (file.type === "image/svg+xml") {
    return file
      .text()
      .then((svgContent) => convertSvgToBlob(svgContent, targetMime));
  }

  if (isHeic(file)) {
    return convertHeicToBlob(file, targetMime);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Conversion failed")),
        targetMime,
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function ImageConvert() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [targetFormat, setTargetFormat] = useState<string>("image/png");
  const [results, setResults] = useState<{ blob: Blob; baseName: string }[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;
    setError(null);
    setConverting(true);
    try {
      const converted = await Promise.all(
        files.map(async (file) => {
          const blob = await convertImage(file, targetFormat);
          return { blob, baseName: baseName(file.name) };
        }),
      );
      setResults(converted);
    } catch (e) {
      setError(
        e instanceof Error && e.message === HEIC_PARSE_ERROR
          ? t("images.errors.heicParseError")
          : e instanceof Error
            ? e.message
            : "Conversion failed",
      );
    } finally {
      setConverting(false);
    }
  }, [files, targetFormat, t]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResults([]);
    setError(null);
    setTargetFormat("image/png");
  }, []);

  const resultExt = FORMATS.find((f) => f.value === targetFormat)?.ext ?? "png";

  const handleDownloadZip = useCallback(async () => {
    if (results.length === 0) return;
    const zip = new JSZip();
    results.forEach(({ blob, baseName: name }, i) => {
      const uniqueName =
        results.length > 1
          ? `${name}_${i + 1}.${resultExt}`
          : `${name}.${resultExt}`;
      zip.file(uniqueName, blob);
    });
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `converted-images.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, resultExt]);

  const handleFileChange = useCallback((v: File | File[] | null) => {
    if (v === null) setFiles([]);
    else setFiles(Array.isArray(v) ? v : [v]);
  }, []);

  const [resultUrls, setResultUrls] = useState<string[]>([]);
  useEffect(() => {
    if (results.length === 0) {
      setResultUrls([]);
      return;
    }
    const urls = results.map((r) => URL.createObjectURL(r.blob));
    setResultUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [results]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <Link
        to="/images"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← {t("placeholder.backToOverview")}
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ArrowLeftRight className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("images.tools.convert.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("images.tools.convert.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label>{t("images.imageLabel")}</Label>
            <FileDropzone
              multiple
              value={files}
              onFileChange={handleFileChange}
              hint={t("images.dropzoneHint")}
              activeHint={t("images.dropzoneActive")}
              removeLabel={t("images.removeFile")}
              fileCountLabel={(count) => t("images.filesSelected", { count })}
              multipleHint={t("images.multipleHint")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("images.convertPage.targetFormat")}</Label>
            <Select
              value={targetFormat}
              onValueChange={(v) => setTargetFormat(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map(({ value, key }) => (
                  <SelectItem key={value} value={value}>
                    {t(`images.convertPage.formats.${key}`)}
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
            disabled={files.length === 0 || converting}
            className="min-w-28"
          >
            {converting ? "…" : t("images.convertPage.convertBtn")}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={files.length === 0 && results.length === 0}
          >
            {t("images.resetBtn")}
          </Button>
        </CardFooter>
      </Card>

      {results.length > 0 && resultUrls.length === results.length && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("images.imagesReady", { count: results.length })}
          </p>
          <div className="flex flex-wrap gap-3">
            {results.length === 1 ? (
              <a
                href={resultUrls[0]}
                download={`${results[0].baseName}.${resultExt}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Download className="h-4 w-4" aria-hidden />
                {t("images.downloadResult")}
              </a>
            ) : (
              <Button
                type="button"
                className="gap-2"
                onClick={handleDownloadZip}
              >
                <FileArchive className="h-4 w-4" aria-hidden />
                {t("images.downloadZip")}
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
