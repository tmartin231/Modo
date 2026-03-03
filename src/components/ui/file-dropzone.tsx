"use client";

import { Upload, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const ACCEPT_IMAGE = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/avif": [".avif"],
  "image/svg+xml": [".svg"],
  "image/x-icon": [".ico"],
  "image/vnd.microsoft.icon": [".ico"],
  "image/tiff": [".tiff", ".tif"],
  "image/bmp": [".bmp"],
};

export type FileDropzoneProps = {
  accept?: Record<string, string[]>;
  multiple?: boolean;
  value?: File | File[] | null;
  onFileChange?: (file: File | File[] | null) => void;
  className?: string;
  disabled?: boolean;
  hint: string;
  activeHint?: string;
  removeLabel?: string;
  addMoreLabel?: string;
  fileCountLabel?: (count: number) => string;
  multipleHint?: string;
};

export function FileDropzone({
  accept = ACCEPT_IMAGE,
  multiple = false,
  value,
  onFileChange,
  className,
  disabled = false,
  hint,
  activeHint,
  removeLabel = "Remove",
  addMoreLabel,
  fileCountLabel,
  multipleHint,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);

  const acceptStr = Object.keys(accept).join(",");
  const extensions = Array.from(
    new Set(
      Object.values(accept)
        .flat()
        .map((ext) => ext.toLowerCase()),
    ),
  );
  const files = multiple ? (Array.isArray(value) ? value : value ? [value] : []) : [];
  const hasFiles = multiple ? files.length > 0 : !!value && !Array.isArray(value);
  const singleFile = !multiple ? (Array.isArray(value) ? null : value ?? null) : null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const addFiles = (newFiles: FileList | File[]) => {
    const list = Array.from(newFiles);
    const valid = acceptStr
      ? list.filter((f) => Object.prototype.hasOwnProperty.call(accept, f.type))
      : list;
    if (valid.length === 0) return;
    if (multiple) {
      onFileChange?.([...files, ...valid]);
    } else {
      onFileChange?.(valid[0] ?? null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list?.length) addFiles(list);
    e.target.value = "";
  };

  const handleClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent, index?: number) => {
    e.stopPropagation();
    if (multiple && index !== undefined) {
      const next = files.filter((_, i) => i !== index);
      onFileChange?.(next.length ? next : null);
    } else {
      onFileChange?.(null);
    }
  };

  const displayFiles = multiple ? files : singleFile ? [singleFile] : [];

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptStr}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        aria-label={hint}
        className={cn(
          "border-input bg-muted/30 flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 transition-colors",
          isDragActive && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-50",
          !disabled && "hover:border-primary/50 hover:bg-muted/50",
          hasFiles && "min-h-0 py-4",
          className
        )}
      >
        {displayFiles.length > 0 ? (
          <div className="flex w-full flex-col gap-2">
            <p className="text-center text-sm text-muted-foreground">
              {fileCountLabel
                ? fileCountLabel(displayFiles.length)
                : `${displayFiles.length} ${displayFiles.length === 1 ? "file" : "files"} selected`}
            </p>
            <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded border bg-background/60 px-2 py-1.5 text-left">
              {displayFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate text-foreground">{f.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    ({(f.size / 1024).toFixed(1)} KB)
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, multiple ? i : undefined)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={removeLabel}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!disabled && (
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                {multiple && addMoreLabel && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      inputRef.current?.click();
                    }}
                    className="text-primary underline underline-offset-2 hover:no-underline"
                  >
                    {addMoreLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileChange?.(null);
                  }}
                  className="text-primary underline underline-offset-2 hover:no-underline"
                >
                  {removeLabel} {displayFiles.length > 1 ? "alle" : ""}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="text-center text-sm text-muted-foreground">
              {isDragActive && activeHint ? activeHint : hint}
            </p>
            {!!extensions.length && (
              <p className="text-xs text-muted-foreground/80">
                {extensions.join(", ")}
                {multiple && multipleHint ? multipleHint : ""}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
