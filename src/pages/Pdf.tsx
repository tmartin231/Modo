import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/BackLink";
import { FileDiff, FileInput, FileOutput } from "lucide-react";

const PDF_TOOLS = [
  {
    key: "merge",
    to: "/pdf/merge",
    icon: FileInput,
    className:
      "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "split",
    to: "/pdf/split",
    icon: FileDiff,
    className:
      "from-sky-500/10 to-blue-500/10 border-sky-500/20 hover:border-sky-500/40",
    iconClassName: "text-sky-600 dark:text-sky-400",
  },
  {
    key: "convert",
    to: "/pdf/convert",
    icon: FileOutput,
    className:
      "from-violet-500/10 to-purple-500/10 border-violet-500/20 hover:border-violet-500/40",
    iconClassName: "text-violet-600 dark:text-violet-400",
  },
  {
    key: "toPdf",
    to: "/pdf/to-pdf",
    icon: FileInput,
    className:
      "from-rose-500/10 to-orange-500/10 border-rose-500/20 hover:border-rose-500/40",
    iconClassName: "text-rose-600 dark:text-rose-400",
  },
] as const;

export function Pdf() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-4xl flex-1 flex-col px-4 py-8">
      <BackLink to="/" />

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <FileInput className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("home.categories.pdf.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("home.categories.pdf.description")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PDF_TOOLS.map(({ key, to, icon: Icon, className, iconClassName }) => (
          <Link
            key={key}
            to={to}
            className={cn(
              "group flex flex-col rounded-xl border bg-card p-6 text-card-foreground shadow-sm transition-all duration-200",
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
            <h2 className="mb-1 text-lg font-semibold">
              {t(`pdf.tools.${key}.title`)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(`pdf.tools.${key}.description`)}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}

