export type FeatureId =
  | "images.convert"
  | "images.compress"
  | "images.resize"
  | "images.crop"
  | "pdf.merge"
  | "pdf.split"
  | "pdf.convert"
  | "pdf.toPdf"
  | "files.convert";

export type FeatureUsageMap = Partial<Record<FeatureId, number>>;

const STORAGE_KEY = "qwikfiles:featureUsage:v1";

function safeParse(json: string | null): FeatureUsageMap {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: FeatureUsageMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        typeof key === "string" &&
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        result[key as FeatureId] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function incrementFeatureUsage(id: FeatureId): void {
  if (typeof window === "undefined") return;
  try {
    const current = safeParse(window.localStorage.getItem(STORAGE_KEY));
    const next: FeatureUsageMap = { ...current };
    next[id] = (next[id] ?? 0) + 1;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage kann z. B. im Private Mode fehlschlagen – dann ignorieren wir das still.
  }
}

export function readFeatureUsage(): FeatureUsageMap {
  if (typeof window === "undefined") return {};
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

