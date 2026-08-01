import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { getManagerCapabilityMetadata } from "../../lib/community-overview/availability";
import { MANAGER_CAPABILITY_ROUTE_KEYS } from "../../lib/community-overview/routes";
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
  const offersCapability = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.MARKETPLACE_OFFERS);
  const housingCapability = getManagerCapabilityMetadata(MANAGER_CAPABILITY_ROUTE_KEYS.HOUSING);

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

      <section className="card-tight border-dashed border-primary/25 text-center">
        <p className="text-sm font-semibold text-foreground">{t.statusNotice}</p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <article className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.92)] via-background to-background/95 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)]">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90" aria-hidden />
          <div className="space-y-3 pt-1">
            <h2 className="text-lg font-semibold text-primary">{t.offersTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {t.offersBody}
            </p>
            {offersCapability.enabled ? (
              <Link className="btn-ghost" href={offersCapability.href}>
                {t.offersTitle}
              </Link>
            ) : (
              <button
                className="btn-ghost"
                type="button"
                disabled
                data-capability-key={offersCapability.key}
                data-capability-state={offersCapability.status}
              >
                {t.offersTitle} · {t.openSection}
              </button>
            )}
          </div>
        </article>
        <article className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-[rgba(246,240,225,0.92)] via-background to-background/95 p-5 shadow-[0_4px_18px_rgba(86,102,69,0.08)]">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-primary to-secondary opacity-90" aria-hidden />
          <div className="space-y-3 pt-1">
            <h2 className="text-lg font-semibold text-primary">{t.housingTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {t.housingBody}
            </p>
            {housingCapability.enabled ? (
              <Link className="btn-ghost" href={housingCapability.href}>
                {t.housingTitle}
              </Link>
            ) : (
              <button
                className="btn-ghost"
                type="button"
                disabled
                data-capability-key={housingCapability.key}
                data-capability-state={housingCapability.status}
              >
                {t.housingTitle} · {t.openSection}
              </button>
            )}
          </div>
        </article>
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
