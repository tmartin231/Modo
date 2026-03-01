import { Github, MessageCircle } from "lucide-react";

const FEEDBACK_EMAIL = "tmartin231@outlook.de";
const FEEDBACK_SUBJECT = "Modo – Feedback";

export function Footer() {
  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`;

  return (
    <footer className="mt-auto border-t border-border/80 bg-muted/30 py-6">
      <div className="mx-auto flex max-w-[1820px] items-center justify-center gap-4 px-6 flex-row">
        <p className="text-sm text-muted-foreground">Made by Tom</p>
        <a
          href="https://github.com/tmartin231/Modo"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground ring-1 ring-border/50 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Github className="h-4 w-4" aria-hidden />
          GitHub
        </a>
        <a
          href={mailto}
          className="inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground ring-1 ring-border/50 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Feedback
        </a>
      </div>
    </footer>
  );
}
