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
import { Download, ListOrdered } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { incrementFeatureUsage } from "@/lib/usage-tracking";

type PdfItem = {
  file: File;
  id: string;
  addedAt: number;
};

function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

export function PdfMerge() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PdfItem[]>([]);
  const [dropzoneFileList, setDropzoneFileList] = useState<File[]>([]);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string>("merged.pdf");

  useEffect(() => {
    incrementFeatureUsage("pdf.merge");
  }, []);

  const onFileChange = useCallback((v: File | File[] | null) => {
    if (v === null) {
      setItems([]);
      setDropzoneFileList([]);
      return;
    }
    const files = Array.isArray(v) ? v : [v];
    setDropzoneFileList(files);
    setItems((prev) => {
      const existingInMergeOrder = prev.filter((p) =>
        files.some((f) => sameFile(p.file, f)),
      );
      const newFiles = files.filter(
        (f) => !prev.some((p) => sameFile(p.file, f)),
      );
      const newItems = newFiles.map((file) => ({
        file,
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        addedAt: Date.now(),
      }));
      return [...existingInMergeOrder, ...newItems];
    });
  }, []);

  const moveItem = useCallback((index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= next.length) return prev;
      const [moved] = next.splice(index, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      const fileToRemove = prev[index]?.file;
      if (fileToRemove) {
        setDropzoneFileList((d) => d.filter((f) => !sameFile(f, fileToRemove)));
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleMerge = useCallback(async () => {
    if (items.length === 0) return;
    setError(null);
    setMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const { file } of items) {
        const arrayBuffer = await file.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(
          srcDoc,
          srcDoc.getPageIndices(),
        );
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const bytes = await mergedPdf.save();
      const blob = new Blob([bytes as unknown as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const base = items[0]!.file.name.replace(/\.pdf$/i, "");
      setResultFilename(`${base}_Merged.pdf`);
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("files.page.genericError"),
      );
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setMerging(false);
    }
  }, [items, t]);

  const handleReset = useCallback(() => {
    setItems([]);
    setDropzoneFileList([]);
    setError(null);
    setResultFilename("merged.pdf");
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(
    () => () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    },
    [resultUrl],
  );

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <BackLink to="/pdf" />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <ListOrdered className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("pdf.tools.merge.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("pdf.tools.merge.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("pdf.tools.merge.title")}</CardTitle>
          <CardDescription>
            {t("pdf.mergePage.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label>{t("pdf.mergePage.fileLabel")}</Label>
            <FileDropzone
              multiple
              value={dropzoneFileList}
              onFileChange={onFileChange}
              accept={{ "application/pdf": [".pdf"] }}
              hint={t("pdf.mergePage.dropzoneHint")}
              activeHint={t("pdf.mergePage.dropzoneActive")}
              removeLabel={t("images.removeFile")}
              addMoreLabel={t("images.addMoreFiles")}
              fileCountLabel={(count) =>
                t("images.filesSelected", { count })
              }
              multipleHint={t("images.multipleHint")}
            />
          </div>

          {items.length > 1 && (
            <div className="space-y-2">
              <Label>{t("pdf.mergePage.orderLabel")}</Label>
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded border bg-background/60 px-2 py-2 text-sm">
                {items.map(({ file, id }, index) => (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex-1 truncate text-foreground">
                      {index + 1}. {file.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => moveItem(index, -1)}
                        aria-label={t("pdf.mergePage.moveUp")}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={index === items.length - 1}
                        onClick={() => moveItem(index, 1)}
                        aria-label={t("pdf.mergePage.moveDown")}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeItem(index)}
                        aria-label={t("images.removeFile")}
                      >
                        ✕
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
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
            onClick={handleMerge}
            disabled={items.length === 0 || merging}
            className="min-w-28"
          >
            {merging ? "…" : t("pdf.mergePage.mergeBtn")}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={items.length === 0 && !resultUrl}
          >
            {t("pdf.mergePage.resetBtn")}
          </Button>
        </CardFooter>
      </Card>

      {resultUrl && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("pdf.mergePage.resultReady")}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={resultUrl}
              download={resultFilename}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Download className="h-4 w-4" aria-hidden />
              {t("pdf.mergePage.downloadResult")}
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

