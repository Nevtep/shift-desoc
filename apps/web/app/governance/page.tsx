import Link from "next/link";
import type { Metadata } from "next";
import type { Route } from "next";
import { cookies } from "next/headers";

import { GovernanceTechnicalFooter } from "../../components/layout/governance-technical-footer";
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
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:py-12">
      <header className="space-y-4">
        <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {t.governanceSpaceBadge}
        </p>
        <div className="space-y-2 sm:space-y-3">
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{t.hubTitle}</h1>
          <p className="max-w-3xl text-muted-foreground">{t.hubSubtitle}</p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          className="card-tight group block space-y-2 border-primary/20 transition-colors hover:border-secondary/40"
          href="/governance/proposals"
        >
          <h2 className="text-base font-semibold text-primary transition-colors group-hover:text-primaryDark">{t.hubCardProposalsTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.hubCardProposalsBody}</p>
        </Link>
        <Link
          className="card-tight group block space-y-2 border-primary/20 transition-colors hover:border-secondary/40"
          href={"/governance/activity" as Route}
        >
          <h2 className="text-base font-semibold text-primary transition-colors group-hover:text-primaryDark">{t.hubCardActivityTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.hubCardActivityBody}</p>
        </Link>
      </div>

      <GovernanceTechnicalFooter />
    </main>
  );
}
