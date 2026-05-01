import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { CommunityList } from "../../components/communities/community-list";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).communitiesPage;
  return {
    title: t.metaTitle,
    description: t.metaDescription
  };
}

export default async function CommunitiesPage() {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).communitiesPage;

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
        <div className="flex flex-wrap gap-3">
          <Link className="btn-primary cursor-pointer" href="/#crear-comunidad">
            {t.ctaCreate}
          </Link>
          <Link className="btn-ghost cursor-pointer" href="/">
            {t.ctaHome}
          </Link>
        </div>
      </header>

      <section>
        <CommunityList />
      </section>

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
            <li>{t.infoLi5}</li>
          </ul>
        </details>
      </section>
    </main>
  );
}
