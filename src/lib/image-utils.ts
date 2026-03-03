// @ts-expect-error utif has no type definitions
import UTIF from "utif";

/**
 * Erweiterte MIME → Dateiendung für alle unterstützten Bildformate.
 * GIF bleibt als "gif" gemappt; Konvertierung zu WebP nur in der Komprimier-Logik.
 */
export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
};

const TIFF_TYPES = ["image/tiff"];

export function isTiff(file: File): boolean {
  return TIFF_TYPES.includes(file.type);
}

/** Fehlercode, wenn TIFF nicht geparst werden kann. */
export const TIFF_PARSE_ERROR = "TIFF_PARSE_ERROR";

/**
 * TIFF-Dateien im Browser dekodieren (Browser können TIFF nicht nativ in <img> laden).
 * Gibt ein PNG-Blob zurück. Siehe https://github.com/photopea/UTIF.js
 */
export function decodeTiffToBlob(file: File): Promise<Blob> {
  return file
    .arrayBuffer()
    .then((buffer) => {
      const ifds = UTIF.decode(buffer);
      if (!ifds || ifds.length === 0) throw new Error(TIFF_PARSE_ERROR);
      const ifd = ifds[0];
      UTIF.decodeImage(buffer, ifd);
      const rgba = UTIF.toRGBA8(ifd);
      const canvas = document.createElement("canvas");
      canvas.width = ifd.width as number;
      canvas.height = ifd.height as number;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(TIFF_PARSE_ERROR);
      const imageData = ctx.createImageData(ifd.width as number, ifd.height as number);
      imageData.data.set(rgba);
      ctx.putImageData(imageData, 0, 0);
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error(TIFF_PARSE_ERROR))),
          "image/png",
          0.92,
        );
      });
    })
    .catch((err) => {
      if (err instanceof Error && err.message === TIFF_PARSE_ERROR) throw err;
      throw new Error(TIFF_PARSE_ERROR);
    });
}

/**
 * Datei für die Anzeige/Verarbeitung vorbereiten:
 * TIFF → PNG (Browser können TIFF nicht nativ in <img> laden),
 * sonst die Originaldatei.
 */
export async function decodeImageFile(file: File): Promise<File> {
  if (isTiff(file)) {
    const blob = await decodeTiffToBlob(file);
    const base = file.name.replace(/\.[^.]+$/i, "");
    return new File([blob], `${base}.png`, { type: "image/png" });
  }
  return file;
}

export type OutputFormatContext = "convert" | "compress" | "resize" | "crop";

/**
 * Ausgabe-MIME und Endung je nach Kontext.
 * - convert: Originalformat beibehalten (außer SVG→PNG).
 * - compress: JPEG/WebP unverändert; PNG/GIF/SVG → WebP (Qualität steuert Größe).
 * - resize/crop: wie convert.
 */
export function getOutputMimeAndExt(
  file: File,
  context: OutputFormatContext = "convert",
): { mime: string; ext: string } {
  if (file.type === "image/svg+xml") return { mime: "image/png", ext: "png" };

  if (context === "compress") {
    if (file.type === "image/png" || file.type === "image/gif") {
      return { mime: "image/webp", ext: "webp" };
    }
  }

  const ext = MIME_TO_EXT[file.type] ?? "png";
  const mime =
    file.type in MIME_TO_EXT && canEncodeMime(file.type)
      ? file.type
      : "image/png";
  return { mime, ext: mime === "image/png" ? "png" : MIME_TO_EXT[mime] ?? ext };
}

/** Browser kann dieses MIME per Canvas toBlob ausgeben. */
function canEncodeMime(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(mime);
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}
