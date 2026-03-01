import { FileCode, FileText, Image } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const categories = [
  {
    to: "/images",
    title: "Bilder",
    description: "JPG, PNG, WebP, GIF – konvertieren, komprimieren, anpassen",
    icon: Image,
    className:
      "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40",
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  {
    to: "/pdf",
    title: "PDF",
    description:
      "PDF erstellen, zusammenführen, teilen oder in andere Formate umwandeln",
    icon: FileText,
    className:
      "from-rose-500/10 to-red-500/10 border-rose-500/20 hover:border-rose-500/40",
    iconClassName: "text-rose-600 dark:text-rose-400",
  },
  {
    to: "/files",
    title: "Andere Dateien",
    description: "MD, JSON, TXT, CSV und mehr – konvertieren und anpassen",
    icon: FileCode,
    className:
      "from-amber-500/10 to-orange-500/10 border-amber-500/20 hover:border-amber-500/40",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
] as const;

export function Home() {
  return (
    <main className="flex">
      <div className="flex flex-col items-center justify-center mx-auto">
        <img
          src="/modo_winky.png"
          alt=""
          role="presentation"
          className="relative z-0 hidden h-auto w-64 max-h-[340px] object-contain sm:block sm:w-96 sm:max-h-[420px]"
        />
        <div className="relative z-10 flex w-full max-w-4xl flex-col gap-6 sm:-mt-42 md:flex-row">
          {categories.map(
            ({
              to,
              title,
              description,
              icon: Icon,
              className,
              iconClassName,
            }) => (
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
                <h2 className="mb-2 text-lg font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
              </Link>
            ),
          )}
        </div>
      </div>
    </main>
  );
}
