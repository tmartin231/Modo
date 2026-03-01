import heic2any from "heic2any";

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
  "image/heic": "heic",
  "image/heif": "heif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
};

const HEIC_TYPES = ["image/heic", "image/heif"];

export function isHeic(file: File): boolean {
  return HEIC_TYPES.includes(file.type);
}

/** Fehlercode, wenn HEIC/HEIF nicht geparst werden kann (z. B. manche HEIF-Varianten). */
export const HEIC_PARSE_ERROR = "HEIC_PARSE_ERROR";

/**
 * HEIC/HEIF-Dateien im Browser dekodieren (z. B. iPhone-Fotos).
 * Gibt ein JPEG-Blob zurück, das in <img> und Canvas genutzt werden kann.
 * Wirft HEIC_PARSE_ERROR, wenn die Datei nicht gelesen werden kann.
 */
export function decodeHeicToBlob(file: File): Promise<Blob> {
  return heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  })
    .then((result) => {
      const blob = Array.isArray(result) ? result[0] : result;
      if (!blob || !(blob instanceof Blob)) throw new Error(HEIC_PARSE_ERROR);
      return blob;
    })
    .catch(() => {
      throw new Error(HEIC_PARSE_ERROR);
    });
}

/**
 * Datei für die Anzeige/Verarbeitung vorbereiten: HEIC → JPEG-Blob,
 * sonst die Originaldatei. Für HEIC wird ein neues File mit .jpg-Endung zurückgegeben.
 */
export async function decodeImageFile(file: File): Promise<File> {
  if (isHeic(file)) {
    const blob = await decodeHeicToBlob(file);
    const baseName = file.name.replace(/\.[^.]+$/i, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  }
  return file;
}

export type OutputFormatContext = "convert" | "compress" | "resize" | "crop";

/**
 * Ausgabe-MIME und Endung je nach Kontext.
 * - convert: Originalformat beibehalten (außer SVG→PNG, HEIC→JPEG).
 * - compress: JPEG/WebP unverändert; PNG/GIF/SVG → WebP (Qualität steuert Größe).
 * - resize/crop: wie convert.
 */
export function getOutputMimeAndExt(
  file: File,
  context: OutputFormatContext = "convert",
): { mime: string; ext: string } {
  if (file.type === "image/svg+xml") return { mime: "image/png", ext: "png" };
  if (isHeic(file)) return { mime: "image/jpeg", ext: "jpg" };

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
