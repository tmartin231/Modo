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
import { Download, FileArchive, Maximize2 } from "lucide-react";
import JSZip from "jszip";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function resizeImage(
  file: File,
  scalePercent: number,
): Promise<{ blob: Blob; ext: string }> {
  const scale = Math.max(1, Math.min(200, scalePercent)) / 100;
  const { mime, ext } = getOutputMimeAndExt(file, "resize");

  const drawToCanvas = (
    img: HTMLImageElement,
  ): Promise<{ blob: Blob; ext: string }> =>
    new Promise((resolve, reject) => {
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      if (w < 1 || h < 1) {
        reject(new Error("Bild würde zu klein"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) =>
          blob ? resolve({ blob, ext }) : reject(new Error("Resize failed")),
        mime,
        0.92,
      );
    });

  if (file.type === "image/svg+xml") {
    return file.text().then((svgContent) => {
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => drawToCanvas(img).then(resolve, reject);
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
      drawToCanvas(img).then(resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function ImageResize() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [scale, setScale] = useState(100);
  const [results, setResults] = useState<
    { blob: Blob; baseName: string; ext: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);

  const handleResize = useCallback(async () => {
    if (files.length === 0) return;
    setError(null);
    setResizing(true);
    try {
      const decoded = await Promise.all(files.map(decodeImageFile));
      const converted = await Promise.all(
        decoded.map(async (decodedFile, i) => {
          const file = files[i]!;
          const { blob, ext } = await resizeImage(decodedFile, scale);
          return { blob, baseName: baseName(file.name), ext };
        }),
      );
      setResults(converted);
    } catch (e) {
      const msg =
        e instanceof Error && e.message === TIFF_PARSE_ERROR
          ? t("images.errors.tiffParseError")
          : e instanceof Error
            ? e.message
            : "Resize failed";
      setError(msg);
    } finally {
      setResizing(false);
    }
  }, [files, scale, t]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResults([]);
    setError(null);
    setScale(100);
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
    a.download = "resized-images.zip";
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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <Maximize2 className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("images.tools.resize.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("images.tools.resize.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("images.tools.resize.title")}</CardTitle>
          <CardDescription>
            {t("images.tools.resize.description")}
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
            <Label htmlFor="scale">{t("images.resizePage.scaleLabel")}</Label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <input
                  id="scale"
                  type="range"
                  min={1}
                  max={200}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="h-2 flex-1 accent-primary"
                  aria-valuemin={1}
                  aria-valuemax={200}
                  aria-valuenow={scale}
                />
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={scale}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v))
                      setScale(Math.max(1, Math.min(200, v)));
                  }}
                  className="h-9 w-16 rounded-md border border-input bg-background px-2 py-1 text-center text-sm tabular-nums"
                  aria-label={t("images.resizePage.scaleLabel")}
                />
                <span className="w-8 text-sm text-muted-foreground">%</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[50, 100, 150, 200].map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={scale === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setScale(p)}
                  >
                    {p}%
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("images.resizePage.scaleHint")}
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
            onClick={handleResize}
            disabled={files.length === 0 || resizing}
            className="min-w-28"
          >
            {resizing ? "…" : t("images.resizePage.resizeBtn")}
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
