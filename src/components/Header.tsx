import { Globe, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import i18n from "@/i18n.ts";

const LANGUAGES = [
  { code: "de", labelKey: "languages.de" },
  { code: "en", labelKey: "languages.en" },
] as const;

const THEME_KEY = "modo-theme";

function getInitialDark(): boolean {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light") return false;
  if (saved === "dark") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function Header() {
  const { t } = useTranslation();
  const [dark, setDark] = useState(getInitialDark);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  };

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("modo-language", code);
    setLanguageModalOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 mb-20 w-full border-b border-border/80 bg-background/80 shadow-sm shadow-black/5 supports-backdrop-filter:bg-background/70 backdrop-blur-md dark:shadow-none dark:border-border/50">
        <div className="mx-auto flex h-16 max-w-[1820px] items-center justify-between gap-6 px-6">
          <Link
            to="/"
            className="-m-1 flex shrink-0 items-center gap-4 rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/60 ring-1 ring-border/50 dark:bg-muted/40">
              <img
                src="/Logo.png"
                alt=""
                className="h-9 w-9 object-contain object-center"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-lg font-bold leading-tight tracking-tight text-foreground">
                {t("common.appName")}
              </span>
              <span className="text-xs font-medium tracking-wide text-muted-foreground">
                {t("common.tagline")}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguageModalOpen(true)}
              className={cn(
                "cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                "ring-1 ring-border/50 dark:bg-muted/50 dark:ring-border/40",
                "transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              aria-label={t("header.chooseLanguage")}
            >
              <Globe className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                "cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                "ring-1 ring-border/50 dark:bg-muted/50 dark:ring-border/40",
                "transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              aria-label={dark ? t("header.themeLight") : t("header.themeDark")}
            >
              {dark ? (
                <Sun className="h-5 w-5" aria-hidden />
              ) : (
                <Moon className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Sprachauswahl-Modal */}
      {languageModalOpen && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="language-modal-title"
          onClick={() => setLanguageModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="language-modal-title"
              className="mb-4 text-lg font-semibold text-foreground"
            >
              {t("header.chooseLanguage")}
            </h2>
            <ul className="flex flex-col gap-2">
              {LANGUAGES.map(({ code, labelKey }) => (
                <li key={code}>
                  <button
                    type="button"
                    onClick={() => changeLanguage(code)}
                    className={cn(
                      "w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors",
                      i18n.language === code
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                  >
                    {t(labelKey)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
