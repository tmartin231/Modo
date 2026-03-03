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
import { Download, Crop } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { incrementFeatureUsage } from "@/lib/usage-tracking";

type CropRect = { x: number; y: number; w: number; h: number };

export function ImageCrop() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<{
    blob: Blob;
    baseName: string;
    ext: string;
  } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    incrementFeatureUsage("images.crop");
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Create/revoke image URL when file changes
  useEffect(() => {
    if (!file) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setImageUrl(null);
      setNaturalSize(null);
      setCropRect(null);
      setResult(null);
      return;
    }
    if (file.type === "image/svg+xml") {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      file.text().then((text) => {
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
        setImageUrl(dataUrl);
      });
      return;
    }
    let cancelled = false;
    decodeImageFile(file)
      .then((decoded) => {
        if (cancelled) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(decoded);
        setImageUrl(objectUrlRef.current);
      })
      .catch((err) => {
        if (
          !cancelled &&
          err instanceof Error &&
          err.message === TIFF_PARSE_ERROR
        ) {
          setError(t("images.errors.tiffParseError"));
        }
      });
    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file, t]);

  useEffect(() => {
    if (!result) {
      setResultUrl(null);
      return;
    }
    const url = URL.createObjectURL(result.blob);
    setResultUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  // When image loads, store natural size
  const onImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  // ResizeObserver for container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {
        width: 0,
        height: 0,
      };
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageUrl]);

  const getScaleAndOffset = useCallback(() => {
    if (!naturalSize || containerSize.w <= 0 || containerSize.h <= 0)
      return null;
    const scale = Math.min(
      containerSize.w / naturalSize.w,
      containerSize.h / naturalSize.h,
    );
    const displayW = naturalSize.w * scale;
    const displayH = naturalSize.h * scale;
    const offsetX = (containerSize.w - displayW) / 2;
    const offsetY = (containerSize.h - displayH) / 2;
    return { scale, offsetX, offsetY, displayW, displayH };
  }, [naturalSize, containerSize]);

  const toImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el || !naturalSize) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const so = getScaleAndOffset();
      if (!so) return { x: 0, y: 0 };
      const { scale, offsetX, offsetY } = so;
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const ix = (cx - offsetX) / scale;
      const iy = (cy - offsetY) / scale;
      return {
        x: Math.max(0, Math.min(naturalSize.w, ix)),
        y: Math.max(0, Math.min(naturalSize.h, iy)),
      };
    },
    [naturalSize, getScaleAndOffset],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!naturalSize) return;
      const { x, y } = toImageCoords(e.clientX, e.clientY);
      setIsDragging(true);
      setDragStart({ x, y });
      setDragEnd({ x, y });
    },
    [naturalSize, toImageCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStart || !naturalSize) return;
      const { x, y } = toImageCoords(e.clientX, e.clientY);
      setDragEnd({ x, y });
    },
    [isDragging, dragStart, naturalSize, toImageCoords],
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }
    const x = Math.min(dragStart.x, dragEnd.x);
    const y = Math.min(dragStart.y, dragEnd.y);
    const w = Math.max(1, Math.abs(dragEnd.x - dragStart.x));
    const h = Math.max(1, Math.abs(dragEnd.y - dragStart.y));
    // Clamp to image bounds
    const x2 = Math.min(x + w, naturalSize!.w);
    const y2 = Math.min(y + h, naturalSize!.h);
    const x1 = Math.max(0, x);
    const y1 = Math.max(0, y);
    setCropRect({
      x: x1,
      y: y1,
      w: Math.max(1, x2 - x1),
      h: Math.max(1, y2 - y1),
    });
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, naturalSize]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    }
  }, [isDragging]);

  const handleCrop = useCallback(async () => {
    if (!file || !cropRect || !imgRef.current) return;
    setError(null);
    setCropping(true);
    try {
      const img = imgRef.current;
      const { mime, ext } = getOutputMimeAndExt(file, "crop");
      const canvas = document.createElement("canvas");
      canvas.width = cropRect.w;
      canvas.height = cropRect.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(
        img,
        cropRect.x,
        cropRect.y,
        cropRect.w,
        cropRect.h,
        0,
        0,
        cropRect.w,
        cropRect.h,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), mime, 0.92),
      );
      if (!blob) throw new Error("Crop failed");
      setResult({ blob, baseName: baseName(file.name), ext });
    } catch (e) {
      const msg =
        e instanceof Error && e.message === TIFF_PARSE_ERROR
          ? t("images.errors.tiffParseError")
          : e instanceof Error
            ? e.message
            : "Crop failed";
      setError(msg);
    } finally {
      setCropping(false);
    }
  }, [file, cropRect, t]);

  const handleReset = useCallback(() => {
    setFile(null);
    setCropRect(null);
    setResult(null);
    setError(null);
    setDragStart(null);
    setDragEnd(null);
  }, []);

  const handleFileChange = useCallback((v: File | File[] | null) => {
    if (v === null || Array.isArray(v)) setFile(null);
    else setFile(v);
  }, []);

  const so = getScaleAndOffset();
  const displayCrop =
    cropRect && so
      ? {
          left: so.offsetX + cropRect.x * so.scale,
          top: so.offsetY + cropRect.y * so.scale,
          width: cropRect.w * so.scale,
          height: cropRect.h * so.scale,
        }
      : null;
  const dragRect =
    isDragging && dragStart && dragEnd
      ? {
          x: Math.min(dragStart.x, dragEnd.x),
          y: Math.min(dragStart.y, dragEnd.y),
          w: Math.max(1, Math.abs(dragEnd.x - dragStart.x)),
          h: Math.max(1, Math.abs(dragEnd.y - dragStart.y)),
        }
      : null;
  const displayDrag =
    dragRect && so
      ? {
          left: so.offsetX + dragRect.x * so.scale,
          top: so.offsetY + dragRect.y * so.scale,
          width: dragRect.w * so.scale,
          height: dragRect.h * so.scale,
        }
      : null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <BackLink to="/images" />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <Crop className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("images.tools.crop.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("images.tools.crop.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("images.tools.crop.title")}</CardTitle>
          <CardDescription>
            {t("images.tools.crop.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label>{t("images.imageLabel")}</Label>
            <FileDropzone
              multiple={false}
              value={file}
              onFileChange={handleFileChange}
              hint={t("images.dropzoneHint")}
              activeHint={t("images.dropzoneActive")}
              removeLabel={t("images.removeFile")}
            />
            <p className="text-xs text-muted-foreground">
              {t("images.cropPage.singleImageOnly")}
            </p>
          </div>

          {imageUrl && (
            <div className="space-y-2">
              <Label>{t("images.cropPage.cropHint")}</Label>
              <div
                ref={containerRef}
                className="relative inline-block max-w-full overflow-hidden rounded-lg border border-input"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: "crosshair" }}
                role="img"
                aria-label={t("images.cropPage.cropHint")}
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt=""
                  className="block max-h-[85vh] max-w-full w-auto h-auto object-contain"
                  onLoad={onImageLoad}
                  draggable={false}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                />
                {displayDrag && (
                  <div
                    className="absolute border-2 border-dashed border-primary bg-primary/10"
                    style={{
                      left: displayDrag.left,
                      top: displayDrag.top,
                      width: displayDrag.width,
                      height: displayDrag.height,
                    }}
                  />
                )}
                {!displayDrag && displayCrop && (
                  <div
                    className="absolute border-2 border-primary bg-primary/10"
                    style={{
                      left: displayCrop.left,
                      top: displayCrop.top,
                      width: displayCrop.width,
                      height: displayCrop.height,
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={handleCrop}
            disabled={!file || !cropRect || cropping}
            className="min-w-28"
          >
            {cropping ? "…" : t("images.cropPage.cropBtn")}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!file && !result}
          >
            {t("images.resetBtn")}
          </Button>
        </CardFooter>
      </Card>

      {result && resultUrl && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("images.imagesReady_one")}
          </p>
          <a
            href={resultUrl}
            download={`${result.baseName}_cropped.${result.ext}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("images.downloadResult")}
          </a>
        </div>
      )}
    </main>
  );
}
