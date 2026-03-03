import { FileCode, FileText, Image } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { FeatureId } from "@/lib/usage-tracking";
import { readFeatureUsage } from "@/lib/usage-tracking";

const categories = [
  {
    to: "/images",
    key: "images",
    icon: Image,
    className:
      "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  {
    to: "/pdf",
    key: "pdf",
    icon: FileText,
    className:
      "from-rose-500/10 to-red-500/10 border-rose-500/20 hover:border-rose-500/40",
    iconClassName: "text-rose-600 dark:text-rose-400",
  },
  {
    to: "/files",
    key: "files",
    icon: FileCode,
    className:
      "from-amber-500/10 to-orange-500/10 border-amber-500/20 hover:border-amber-500/40",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
] as const;

type FeatureCard = {
  id: FeatureId;
  to: string;
  titleKey: string;
  descriptionKey: string;
  icon: typeof Image;
  className: string;
  iconClassName: string;
};

const ALL_FEATURES: Record<FeatureId, FeatureCard> = {
  "images.convert": {
    id: "images.convert",
    to: "/images/convert",
    titleKey: "images.tools.convert.title",
    descriptionKey: "images.tools.convert.description",
    icon: Image,
    className:
      "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  "images.compress": {
    id: "images.compress",
    to: "/images/compress",
    titleKey: "images.tools.compress.title",
    descriptionKey: "images.tools.compress.description",
    icon: Image,
    className:
      "from-sky-500/10 to-blue-500/10 border-sky-500/20 hover:border-sky-500/40",
    iconClassName: "text-sky-600 dark:text-sky-400",
  },
  "images.resize": {
    id: "images.resize",
    to: "/images/resize",
    titleKey: "images.tools.resize.title",
    descriptionKey: "images.tools.resize.description",
    icon: Image,
    className:
      "from-violet-500/10 to-purple-500/10 border-violet-500/20 hover:border-violet-500/40",
    iconClassName: "text-violet-600 dark:text-violet-400",
  },
  "images.crop": {
    id: "images.crop",
    to: "/images/crop",
    titleKey: "images.tools.crop.title",
    descriptionKey: "images.tools.crop.description",
    icon: Image,
    className:
      "from-amber-500/10 to-orange-500/10 border-amber-500/20 hover:border-amber-500/40",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  "pdf.merge": {
    id: "pdf.merge",
    to: "/pdf/merge",
    titleKey: "pdf.tools.merge.title",
    descriptionKey: "pdf.tools.merge.description",
    icon: FileText,
    className:
      "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  "pdf.split": {
    id: "pdf.split",
    to: "/pdf/split",
    titleKey: "pdf.tools.split.title",
    descriptionKey: "pdf.tools.split.description",
    icon: FileText,
    className:
      "from-sky-500/10 to-blue-500/10 border-sky-500/20 hover:border-sky-500/40",
    iconClassName: "text-sky-600 dark:text-sky-400",
  },
  "pdf.convert": {
    id: "pdf.convert",
    to: "/pdf/convert",
    titleKey: "pdf.tools.convert.title",
    descriptionKey: "pdf.tools.convert.description",
    icon: FileText,
    className:
      "from-violet-500/10 to-purple-500/10 border-violet-500/20 hover:border-violet-500/40",
    iconClassName: "text-violet-600 dark:text-violet-400",
  },
  "pdf.toPdf": {
    id: "pdf.toPdf",
    to: "/pdf/to-pdf",
    titleKey: "pdf.tools.toPdf.title",
    descriptionKey: "pdf.tools.toPdf.description",
    icon: FileText,
    className:
      "from-rose-500/10 to-orange-500/10 border-rose-500/20 hover:border-rose-500/40",
    iconClassName: "text-rose-600 dark:text-rose-400",
  },
  "files.convert": {
    id: "files.convert",
    to: "/files",
    titleKey: "files.page.title",
    descriptionKey: "files.page.description",
    icon: FileCode,
    className:
      "from-amber-500/10 to-orange-500/10 border-amber-500/20 hover:border-amber-500/40",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
};

export function Home() {
  const { t } = useTranslation();
  const [topFeatures] = useState<FeatureCard[]>(() => {
    const usage = readFeatureUsage();
    const entries = Object.entries(usage) as [FeatureId, number][];
    if (!entries.length) return [];
    entries.sort((a, b) => b[1] - a[1]);
    const picked: FeatureCard[] = [];
    for (const [id] of entries) {
      const def = ALL_FEATURES[id];
      if (def && !picked.some((p) => p.id === id)) picked.push(def);
      if (picked.length === 3) break;
    }
    return picked;
  });
  return (
    <main className="flex">
      <div className="mx-auto flex flex-col items-center justify-center">
        <img
          src="/qwik_winky.png"
          alt=""
          role="presentation"
          className="hidden object-contain sm:block sm:w-96 sm:max-h-[420px]"
        />
        <div className="relative z-10 flex w-full max-w-4xl flex-col gap-6 sm:-mt-34">
          <div className="flex flex-col gap-6 md:flex-row">
            {categories.map(
            ({ to, key, icon: Icon, className, iconClassName }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group flex min-w-0 flex-1 flex-col rounded-xl border bg-card p-6 text-card-foreground shadow-sm transition-all duration-200",
                  "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "bg-linear-to-br",
                  className,
                )}
              >
                <div
                  className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-background/80",
                    iconClassName,
                  )}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h2 className="mb-2 text-lg font-semibold">
                  {t(`home.categories.${key}.title`)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t(`home.categories.${key}.description`)}
                </p>
              </Link>
            ),
            )}
          </div>

          {topFeatures.length > 0 && (
            <section className="mt-2 flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">
                  {t("home.mostUsed.title")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("home.mostUsed.subtitle")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topFeatures.map(
                  ({
                    id,
                    to,
                    titleKey,
                    descriptionKey,
                    icon: Icon,
                    className,
                    iconClassName,
                  }) => (
                    <Link
                      key={id}
                      to={to}
                      className={cn(
                        "group flex flex-col rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-all duration-200",
                        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "bg-linear-to-br",
                        className,
                      )}
                    >
                      <div
                        className={cn(
                          "mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-background/80",
                          iconClassName,
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <h3 className="mb-1 text-sm font-semibold">
                        {t(titleKey)}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {t(descriptionKey)}
                      </p>
                    </Link>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
