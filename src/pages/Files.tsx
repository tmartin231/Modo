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
import { baseName, decodeImageFile } from "@/lib/image-utils";
import YAML from "yaml";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { Download, FileArchive, FileCode } from "lucide-react";
import JSZip from "jszip";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type TextFormat = "json" | "csv" | "md" | "yaml" | "xml";

const TARGET_FORMATS: { value: TextFormat; labelKey: string; ext: string }[] = [
  { value: "json", labelKey: "files.page.formats.json", ext: "json" },
  { value: "csv", labelKey: "files.page.formats.csv", ext: "csv" },
  { value: "md", labelKey: "files.page.formats.md", ext: "md" },
  { value: "yaml", labelKey: "files.page.formats.yaml", ext: "yaml" },
  { value: "xml", labelKey: "files.page.formats.xml", ext: "xml" },
];

function detectFormat(file: File, text: string): TextFormat | "txt" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".csv") || name.endsWith(".tsv")) return "csv";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "md";
  if (name.endsWith(".yml") || name.endsWith(".yaml")) return "yaml";
  if (name.endsWith(".xml")) return "xml";
  // Fallback: versuchen JSON zu parsen
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) || typeof parsed === "object") return "json";
  } catch {
    // ignore
  }
  // Fallback: grobe Erkennung für YAML / XML über Inhalt
  const trimmed = text.trimStart();
  if (trimmed.startsWith("---") || trimmed.includes(":\n")) return "yaml";
  if (trimmed.startsWith("<") && trimmed.includes(">")) return "xml";
  return "txt";
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const split = (line: string) => line.split(",").map((s) => s.trim());
  const headers = split(lines[0]!);
  const rows = lines.slice(1).map((l) => {
    const cols = split(l);
    while (cols.length < headers.length) cols.push("");
    return cols;
  });
  return { headers, rows };
}

function csvToJson(text: string): unknown[] {
  const { headers, rows } = parseCsv(text);
  if (headers.length === 0) return [];
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

function jsonToCsv(data: unknown): string {
  if (!Array.isArray(data)) return "";
  if (data.length === 0) return "";
  const objects = data as Record<string, unknown>[];
  const headerSet = new Set<string>();
  for (const obj of objects) {
    Object.keys(obj ?? {}).forEach((k) => headerSet.add(k));
  }
  const headers = Array.from(headerSet);
  const escape = (value: unknown) => {
    const s =
      value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? value
          : JSON.stringify(value);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.join(",");
  const lines = objects.map((obj) =>
    headers.map((h) => escape(obj?.[h])).join(","),
  );
  return [headerLine, ...lines].join("\n");
}

function jsonToMarkdownTable(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) return "";
  const objects = data as Record<string, unknown>[];
  const headerSet = new Set<string>();
  for (const obj of objects) {
    Object.keys(obj ?? {}).forEach((k) => headerSet.add(k));
  }
  const headers = Array.from(headerSet);
  const headerRow = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const rows = objects.map(
    (obj) =>
      `| ${headers
        .map((h) => {
          const v = obj?.[h];
          if (v === null || v === undefined) return "";
          if (typeof v === "string") return v.replace(/\n/g, " ");
          return JSON.stringify(v);
        })
        .join(" | ")} |`,
  );
  return [headerRow, separator, ...rows].join("\n");
}

function parseJsonSafe(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseYamlSafe(text: string): unknown | null {
  try {
    return YAML.parse(text);
  } catch {
    return null;
  }
}

function parseXmlSafe(text: string): unknown | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    return parser.parse(text);
  } catch {
    return null;
  }
}

function jsonToYaml(data: unknown): string {
  return YAML.stringify(data);
}

function jsonToXml(data: unknown): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    suppressEmptyNode: true,
  });
  return builder.build(data);
}

function convertText(
  input: string,
  from: TextFormat | "txt",
  to: TextFormat,
): string | null {
  if (from === to) return input;

  // Alles über eine gemeinsame JSON-Repräsentation routen
  let jsonValue: unknown | null = null;

  if (from === "json") {
    jsonValue = parseJsonSafe(input);
  } else if (from === "csv") {
    jsonValue = csvToJson(input);
  } else if (from === "md") {
    // Aktuell keine generische MD→JSON-Analyse
    return null;
  } else if (from === "yaml") {
    jsonValue = parseYamlSafe(input);
  } else if (from === "xml") {
    jsonValue = parseXmlSafe(input);
  } else {
    // txt → nur sinnvoll nach JSON parsbar
    jsonValue = parseJsonSafe(input);
  }

  if (jsonValue === null) return null;

  // JSON-Repräsentation in das Zielformat wandeln
  if (to === "json") {
    return JSON.stringify(jsonValue, null, 2);
  }

  if (to === "csv") {
    return jsonToCsv(jsonValue);
  }

  if (to === "md") {
    return jsonToMarkdownTable(jsonValue);
  }

  if (to === "yaml") {
    return jsonToYaml(jsonValue);
  }

  if (to === "xml") {
    return jsonToXml(jsonValue);
  }

  return null;
}

export function Files() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [targetFormat, setTargetFormat] = useState<TextFormat>("json");
  const [results, setResults] = useState<
    { blob: Blob; baseName: string; ext: string }[]
  >([]);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const handleFileChange = useCallback((v: File | File[] | null) => {
    if (v === null) setFiles([]);
    else setFiles(Array.isArray(v) ? v : [v]);
  }, []);

  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;
    setError(null);
    setConverting(true);
    try {
      // decodeImageFile behandelt aktuell nur TIFF, andere Dateien werden unverändert durchgereicht.
      const preparedFiles = await Promise.all(files.map(decodeImageFile));
      const nextResults: { blob: Blob; baseName: string; ext: string }[] = [];
      for (const prepared of preparedFiles) {
        const text = await prepared.text();
        const from = detectFormat(prepared, text);
        const converted = convertText(text, from, targetFormat);
        if (converted === null) {
          throw new Error("UNSUPPORTED_COMBINATION");
        }
        const ext =
          TARGET_FORMATS.find((f) => f.value === targetFormat)?.ext ??
          targetFormat;
        const blob = new Blob([converted], {
          type: "text/plain;charset=utf-8",
        });
        nextResults.push({
          blob,
          baseName: baseName(prepared.name),
          ext,
        });
      }
      setResults(nextResults);
    } catch (e) {
      if (e instanceof Error && e.message === "UNSUPPORTED_COMBINATION") {
        setError(t("files.page.unsupportedCombination"));
      } else {
        setError(e instanceof Error ? e.message : t("files.page.genericError"));
      }
      setResults([]);
    } finally {
      setConverting(false);
    }
  }, [files, targetFormat, t]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResults([]);
    setResultUrls([]);
    setError(null);
    setTargetFormat("json");
  }, []);

  useEffect(() => {
    if (!results.length) {
      setResultUrls([]);
      return;
    }
    const urls = results.map((r) => URL.createObjectURL(r.blob));
    setResultUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [results]);

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
    a.download = "converted-files.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <BackLink to="/" />

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <FileCode className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("home.categories.files.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("home.categories.files.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("files.page.title")}</CardTitle>
          <CardDescription>{t("files.page.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="space-y-2">
            <Label>{t("files.page.fileLabel")}</Label>
            <FileDropzone
              multiple
              value={files}
              addMoreLabel={t("images.addMoreFiles")}
              onFileChange={handleFileChange}
              accept={{
                "application/json": [".json"],
                "text/plain": [".txt", ".log"],
                "text/markdown": [".md", ".markdown"],
                "text/x-markdown": [".md"],
                "text/csv": [".csv"],
                "text/tab-separated-values": [".tsv"],
                "application/x-yaml": [".yaml", ".yml"],
                "text/yaml": [".yaml", ".yml"],
                "application/xml": [".xml"],
                "text/xml": [".xml"],
              }}
              hint={t("files.page.dropzoneHint")}
              activeHint={t("files.page.dropzoneActive")}
              removeLabel={t("images.removeFile")}
            />
            <p className="text-xs text-muted-foreground">
              {t("images.filesSelected", { count: files.length })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-format">
              {t("files.page.targetFormat")}
            </Label>
            <select
              id="target-format"
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as TextFormat)}
              className="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {TARGET_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {t(f.labelKey)}
                </option>
              ))}
            </select>
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
            {converting ? "…" : t("files.page.convertBtn")}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={files.length === 0 && results.length === 0}
          >
            {t("files.page.resetBtn")}
          </Button>
        </CardFooter>
      </Card>

      {results.length > 0 && resultUrls.length === results.length && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("files.page.resultsReady", { count: results.length })}
          </p>
          {results.length === 1 ? (
            <a
              href={resultUrls[0]}
              download={`${results[0].baseName}.${results[0].ext}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Download className="h-4 w-4" aria-hidden />
              {t("files.page.downloadResult")}
            </a>
          ) : (
            <Button type="button" className="gap-2" onClick={handleDownloadZip}>
              <FileArchive className="h-4 w-4" aria-hidden />
              {t("files.page.downloadZip")}
            </Button>
          )}
        </div>
      )}
    </main>
  );
}
