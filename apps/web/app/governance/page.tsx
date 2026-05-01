import Link from "next/link";
import type { Metadata } from "next";
import type { Route } from "next";
import { cookies } from "next/headers";

import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;
  return {
    title: t.metaHubTitle,
    description: t.metaHubDescription
  };
}

export default async function GovernancePage() {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t.hubTitle}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t.hubSubtitle}</p>
      </header>
      <details className="card rounded-xl border border-border bg-background/70 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground transition-colors hover:text-primary">
          {t.topBarIndexerDetails}
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.topBarIndexerHelp}</p>
      </details>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link className="card block transition-colors hover:border-primary/40" href="/governance/proposals">
          <div className="space-y-2">
            <h2 className="text-lg font-medium">{t.hubCardProposalsTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.hubCardProposalsBody}</p>
          </div>
        </Link>
        <Link className="card block transition-colors hover:border-primary/40" href={"/governance/activity" as Route}>
          <div className="space-y-2">
            <h2 className="text-lg font-medium">{t.hubCardActivityTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.hubCardActivityBody}</p>
          </div>
        </Link>
      </div>
    </main>
  );
}
