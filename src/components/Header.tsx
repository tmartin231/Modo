import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Header() {
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/80 shadow-sm shadow-black/5 supports-backdrop-filter:bg-background/70 backdrop-blur-md dark:shadow-none dark:border-border/50">
      <div className="mx-auto flex h-16 max-w-[1820px] items-center justify-between gap-6 px-6">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-4 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg -m-1 p-1"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/60 ring-1 ring-border/50 dark:bg-muted/40">
            <img
              src="/Logo.png"
              alt=""
              className="h-9 w-9 object-contain object-center"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tracking-tight text-foreground leading-tight">
              Modo
            </span>
            <span className="text-xs font-medium text-muted-foreground tracking-wide">
              Simple Convert
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
            "ring-1 ring-border/50 dark:bg-muted/50 dark:ring-border/40",
            "transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          aria-label={dark ? "Hellmodus aktivieren" : "Darkmodus aktivieren"}
        >
          {dark ? (
            <Sun className="h-5 w-5 cursor-pointer" aria-hidden />
          ) : (
            <Moon className="h-5 w-5 cursor-pointer" aria-hidden />
          )}
        </button>
      </div>
    </header>
  );
}
