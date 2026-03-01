import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

type PlaceholderProps = {
  title: string;
  backTo?: string;
};

export function Placeholder({ title, backTo = "/" }: PlaceholderProps) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex flex-1 max-w-[1820px] flex-col items-center justify-center gap-6 px-4 py-12">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">{t("placeholder.comingSoon")}</p>
      <Link
        to={backTo}
        className="text-primary underline underline-offset-4 hover:no-underline"
      >
        ← {t("placeholder.backToOverview")}
      </Link>
    </main>
  );
}
