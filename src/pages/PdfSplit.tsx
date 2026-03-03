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
import { PDFDocument } from "pdf-lib";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { Scissors } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import JSZip from "jszip";
import { cn } from "@/lib/utils";

const THUMB_SCALE = 0.4;
const THUMB_MAX_WIDTH = 120;

// Worker-URL für Vite
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
if (typeof pdfjsWorker === "string") {
  GlobalWorkerOptions.workerSrc = pdfjsWorker;
} else {
  GlobalWorkerOptions.workerSrc = (pdfjsWorker as URL).toString();
}

type PageRange = { start: number; end: number };

function buildRanges(pageCount: number, splitAfter: number[]): PageRange[] {
  const sorted = [...splitAfter].filter((p) => p >= 1 && p < pageCount).sort((a, b) => a - b);
  const ranges: PageRange[] = [];
  let start = 1;
  for (const after of sorted) {
    if (after >= start) {
      ranges.push({ start, end: after });
      start = after + 1;
    }
  }
  ranges.push({ start, end: pageCount });
  return ranges;
}

export function PdfSplit() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);
  const [splitAfter, setSplitAfter] = useState<Set<number>>(new Set());
  const [selectedParts, setSelectedParts] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfDataRef = useRef<ArrayBuffer | null>(null);

  const onFileChange = useCallback((v: File | File[] | null) => {
    if (v === null) {
      setFile(null);
      setPageCount(0);
      setThumbUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return [];
      });
      setSplitAfter(new Set());
      setSelectedParts(new Set());
      setError(null);
      if (pdfDataRef.current) pdfDataRef.current = null;
      return;
    }
    const f = Array.isArray(v) ? v[0] ?? null : v;
    if (!f) return;
    setFile(f);
    setError(null);
  }, []);

  // PDF laden: Seitenzahl + Thumbnails
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const load = async () => {
      try {
        const ab = await file.arrayBuffer();
        if (cancelled) return;
        pdfDataRef.current = ab;

        const pdfDoc = await PDFDocument.load(ab);
        const num = pdfDoc.getPageCount();
        if (cancelled) return;
        setPageCount(num);

        // Kopie für PDF.js verwenden – der Worker übernimmt den Buffer und detached ihn
        const abCopy = ab.slice(0);
        const pdfjsDoc = await getDocument({ data: abCopy }).promise;
        if (cancelled) return;
        const urls: string[] = [];
        for (let i = 1; i <= num; i++) {
          const page = await pdfjsDoc.getPage(i);
          const viewport = page.getViewport({ scale: THUMB_SCALE });
          const w = Math.min(viewport.width, THUMB_MAX_WIDTH);
          const scale = w / viewport.width;
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width * scale;
          canvas.height = viewport.height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          const renderViewport = page.getViewport({
            scale: THUMB_SCALE * scale,
          });
          await page.render({
            canvasContext: ctx,
            canvas,
            viewport: renderViewport,
          }).promise;
          const blob = await new Promise<Blob | null>((res) =>
            canvas.toBlob(res, "image/jpeg", 0.85),
          );
          if (cancelled || !blob) break;
          urls.push(URL.createObjectURL(blob));
        }
        if (!cancelled) setThumbUrls(urls);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : t("files.page.genericError"));
      }
    };
    load();
    return () => {
      cancelled = true;
      setThumbUrls((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return [];
      });
    };
  }, [file, t]);

  const ranges = pageCount > 0 ? buildRanges(pageCount, [...splitAfter]) : [];
  const toggleSplit = useCallback((afterPage: number) => {
    if (afterPage < 1) return;
    setSplitAfter((prev) => {
      const next = new Set(prev);
      if (next.has(afterPage)) next.delete(afterPage);
      else next.add(afterPage);
      return next;
    });
  }, []);

  const togglePart = useCallback((index: number) => {
    setSelectedParts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const selectAllParts = useCallback(() => {
    setSelectedParts(new Set(ranges.map((_, i) => i)));
  }, [ranges.length]);

  const handleDownload = useCallback(async () => {
    if (!file || !pdfDataRef.current || selectedParts.size === 0) return;
    setError(null);
    setProcessing(true);
    try {
      const srcDoc = await PDFDocument.load(pdfDataRef.current);
      const baseName = file.name.replace(/\.pdf$/i, "");

      if (selectedParts.size === 1) {
        const idx = [...selectedParts][0]!;
        const { start, end } = ranges[idx]!;
        const newPdf = await PDFDocument.create();
        const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
        const pages = await newPdf.copyPages(srcDoc, indices);
        pages.forEach((p) => newPdf.addPage(p));
        const bytes = await newPdf.save();
        const blob = new Blob([bytes as unknown as ArrayBuffer], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}_${start}-${end}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const zip = new JSZip();
      for (const idx of selectedParts) {
        const { start, end } = ranges[idx]!;
        const newPdf = await PDFDocument.create();
        const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
        const pages = await newPdf.copyPages(srcDoc, indices);
        pages.forEach((p) => newPdf.addPage(p));
        const bytes = await newPdf.save();
        zip.file(`${baseName}_${start}-${end}.pdf`, bytes as unknown as Blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}_split.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("files.page.genericError"),
      );
    } finally {
      setProcessing(false);
    }
  }, [file, ranges, selectedParts, t]);

  const handleReset = useCallback(() => {
    onFileChange(null);
  }, [onFileChange]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <BackLink to="/pdf" />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Scissors className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("pdf.tools.split.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("pdf.tools.split.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("pdf.splitPage.title")}</CardTitle>
          <CardDescription>
            {t("pdf.splitPage.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label>{t("pdf.splitPage.fileLabel")}</Label>
            <FileDropzone
              value={file}
              onFileChange={onFileChange}
              accept={{ "application/pdf": [".pdf"] }}
              hint={t("pdf.splitPage.dropzoneHint")}
              activeHint={t("pdf.splitPage.dropzoneActive")}
              removeLabel={t("images.removeFile")}
              fileCountLabel={(count) => t("images.filesSelected", { count })}
            />
          </div>

          {pageCount > 0 && (
            <>
              <div className="space-y-2">
                <Label>{t("pdf.splitPage.previewLabel")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("pdf.splitPage.splitHint")}
                </p>
                <div className="flex flex-wrap items-stretch gap-x-1 gap-y-6">
                  {Array.from({ length: pageCount }, (_, i) => {
                    const pageNum = i + 1;
                    const hasSplitAfter = splitAfter.has(pageNum);
                    return (
                      <div
                        key={pageNum}
                        className="flex items-center gap-0"
                      >
                        <div className="flex flex-col items-center">
                          <div className="relative">
                            {thumbUrls[i] ? (
                              <img
                                src={thumbUrls[i]}
                                alt={t("pdf.splitPage.pageAlt", { page: pageNum })}
                                className="h-auto max-h-32 w-auto max-w-[120px] rounded-lg border border-border object-contain shadow-sm"
                              />
                            ) : (
                              <div className="flex h-24 w-20 items-center justify-center rounded-lg border border-dashed bg-muted/50 text-xs text-muted-foreground">
                                {pageNum}
                              </div>
                            )}
                            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                              {pageNum}
                            </span>
                          </div>
                        </div>
                        {pageNum < pageCount && (
                          <button
                            type="button"
                            onClick={() => toggleSplit(pageNum)}
                            aria-pressed={hasSplitAfter}
                            aria-label={
                              hasSplitAfter
                                ? t("pdf.splitPage.splitOn")
                                : t("pdf.splitPage.splitHere")
                            }
                            className="group relative flex w-10 shrink-0 min-h-32 self-stretch flex-col items-center justify-center px-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <span
                              className={cn(
                                "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors",
                                hasSplitAfter
                                  ? "bg-primary"
                                  : "bg-border group-hover:bg-primary/40",
                              )}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-colors",
                                hasSplitAfter
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-muted-foreground group-hover:border-primary/60 group-hover:bg-muted group-hover:text-foreground",
                              )}
                            >
                              <Scissors className="size-4" aria-hidden />
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {ranges.length > 0 && (
                <div className="space-y-2">
                  <Label>{t("pdf.splitPage.partsLabel")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("pdf.splitPage.partsHint")}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {ranges.map((range, idx) => (
                      <label
                        key={idx}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/50 has-checked:ring-2 has-checked:ring-primary"
                      >
                        <input
                          type="checkbox"
                          checked={selectedParts.has(idx)}
                          onChange={() => togglePart(idx)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="text-sm font-medium">
                          {t("pdf.splitPage.partRange", {
                            start: range.start,
                            end: range.end,
                          })}
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAllParts}
                  >
                    {t("pdf.splitPage.selectAll")}
                  </Button>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={handleDownload}
            disabled={
              !file ||
              pageCount === 0 ||
              selectedParts.size === 0 ||
              processing
            }
            className="min-w-28"
          >
            {processing ? "…" : t("pdf.splitPage.downloadSelected")}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!file && pageCount === 0}
          >
            {t("pdf.mergePage.resetBtn")}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
