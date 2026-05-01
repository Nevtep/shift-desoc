import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).marketplacePage;
  return {
    title: t.metaTitle,
    description: t.metaDescription
  };
}

export default async function MarketplacePage() {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).marketplacePage;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:py-12">
      <header className="space-y-4">
        <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {t.badge}
        </p>
        <div className="space-y-2 sm:space-y-3">
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1>
          <p className="max-w-3xl text-muted-foreground">{t.subtitle}</p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold text-primary">{t.card1Title}</h2>
          <p className="text-sm text-muted-foreground">{t.card1Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold text-primary">{t.card2Title}</h2>
          <p className="text-sm text-muted-foreground">{t.card2Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold text-primary">{t.card3Title}</h2>
          <p className="text-sm text-muted-foreground">{t.card3Body}</p>
        </article>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <Link
          className="group relative block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.92)] via-background to-background/95 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/45 hover:shadow-[0_12px_32px_rgba(221,136,72,0.14)]"
          href="/marketplace/offers"
        >
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90" aria-hidden />
          <div className="space-y-3 pt-1">
            <h2 className="text-lg font-semibold text-primary">{t.offersTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {t.offersBody}
            </p>
            <p className="text-sm font-semibold text-secondary">{t.openSection} →</p>
          </div>
        </Link>
        <Link
          className="group relative block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.92)] via-background to-background/95 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/45 hover:shadow-[0_12px_32px_rgba(221,136,72,0.14)]"
          href="/housing/reservations"
        >
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90" aria-hidden />
          <div className="space-y-3 pt-1">
            <h2 className="text-lg font-semibold text-primary">{t.housingTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {t.housingBody}
            </p>
            <p className="text-sm font-semibold text-secondary">{t.openSection} →</p>
          </div>
        </Link>
      </section>

      <section className="card space-y-4 border-primary/15">
        <h2 className="text-xl font-semibold text-primary">{t.infoTitle}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.infoIntro}</p>
        <details className="rounded-xl border border-border bg-background/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground transition-colors hover:text-primary">
            {t.infoMoreSummary}
          </summary>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>{t.infoLi1}</li>
            <li>{t.infoLi2}</li>
            <li>{t.infoLi3}</li>
            <li>{t.infoLi4}</li>
          </ul>
        </details>
      </section>
    </main>
  );
}
