import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { BackLink } from "@/components/BackLink";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  baseName,
  decodeImageFile,
  getOutputMimeAndExt,
  TIFF_PARSE_ERROR,
} from "@/lib/image-utils";
import { incrementFeatureUsage } from "@/lib/usage-tracking";
import { Download, FileArchive, Shrink } from "lucide-react";
import JSZip from "jszip";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function compressImage(
  file: File,
  quality: number,
): Promise<{ blob: Blob; ext: string }> {
  const q = Math.max(0.01, Math.min(1, quality));
  const { mime, ext } = getOutputMimeAndExt(file, "compress");

  if (file.type === "image/svg+xml") {
    return file.text().then((svgContent) => {
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
      return new Promise<{ blob: Blob; ext: string }>((resolve, reject) => {
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
              blob
                ? resolve({ blob, ext })
                : reject(new Error("Compression failed")),
            mime,
            q,
          );
        };
        img.onerror = () => reject(new Error("Failed to load SVG"));
        img.src = dataUrl;
      });
    });
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
          blob
            ? resolve({ blob, ext })
            : reject(new Error("Compression failed")),
        mime,
        q,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageCompress() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(80);
  const [results, setResults] = useState<
    {
      blob: Blob;
      baseName: string;
      ext: string;
      originalSize: number;
      newSize: number;
    }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    incrementFeatureUsage("images.compress");
  }, []);

  const handleCompress = useCallback(async () => {
    if (files.length === 0) return;
    setError(null);
    setCompressing(true);
    try {
      const q = quality / 100;
      const decoded = await Promise.all(files.map(decodeImageFile));
      const converted = await Promise.all(
        decoded.map(async (decodedFile, i) => {
          const file = files[i]!;
          const { blob, ext } = await compressImage(decodedFile, q);
          return {
            blob,
            baseName: baseName(file.name),
            ext,
            originalSize: file.size,
            newSize: blob.size,
          };
        }),
      );
      setResults(converted);
    } catch (e) {
      const msg =
        e instanceof Error && e.message === TIFF_PARSE_ERROR
          ? t("images.errors.tiffParseError")
          : e instanceof Error
            ? e.message
            : "Compression failed";
      setError(msg);
    } finally {
      setCompressing(false);
    }
  }, [files, quality, t]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResults([]);
    setError(null);
    setQuality(80);
  }, []);

  const handleDownloadZip = useCallback(async () => {
    if (results.length === 0) return;
    const zip = new JSZip();
    results.forEach(({ blob, baseName: name, ext }, i) => {
      const uniqueName =
        results.length > 1 ? `${name}_${i + 1}.${ext}` : `${name}.${ext}`;
      zip.file(uniqueName, blob);
    });
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compressed-images.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

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
      <BackLink to="/images" />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Shrink className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("images.tools.compress.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("images.tools.compress.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("images.tools.compress.title")}</CardTitle>
          <CardDescription>
            {t("images.tools.compress.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label>{t("images.imageLabel")}</Label>
            <FileDropzone
              multiple
              value={files}
              addMoreLabel={t("images.addMoreFiles")}
              onFileChange={handleFileChange}
              hint={t("images.dropzoneHint")}
              activeHint={t("images.dropzoneActive")}
              removeLabel={t("images.removeFile")}
              fileCountLabel={(count) => t("images.filesSelected", { count })}
              multipleHint={t("images.multipleHint")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quality">
              {t("images.compressPage.qualityLabel")}
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="quality"
                type="range"
                min={10}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="h-2 w-full max-w-xs flex-1 accent-primary"
                aria-valuemin={10}
                aria-valuemax={100}
                aria-valuenow={quality}
              />
              <span className="w-10 text-sm tabular-nums text-muted-foreground">
                {quality}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("images.compressPage.outputFormat")}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={handleCompress}
            disabled={files.length === 0 || compressing}
            className="min-w-28"
          >
            {compressing ? "…" : t("images.compressPage.compressBtn")}
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
          {(() => {
            const totalOriginal = results.reduce(
              (s, r) => s + r.originalSize,
              0,
            );
            const totalNew = results.reduce((s, r) => s + r.newSize, 0);
            if (totalOriginal <= 0) return null;
            const percentSmaller = Math.round(
              (1 - totalNew / totalOriginal) * 100,
            );
            const fromStr = formatBytes(totalOriginal);
            const toStr = formatBytes(totalNew);
            return (
              <p className="text-sm font-medium text-foreground">
                {percentSmaller >= 0
                  ? t("images.compressPage.savings", {
                      from: fromStr,
                      to: toStr,
                      percent: percentSmaller,
                    })
                  : t("images.compressPage.savingsLarger", {
                      from: fromStr,
                      to: toStr,
                      percent: -percentSmaller,
                    })}
              </p>
            );
          })()}
          <div className="flex flex-wrap gap-3">
            {results.length === 1 ? (
              <a
                href={resultUrls[0]}
                download={`${results[0].baseName}.${results[0].ext}`}
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
