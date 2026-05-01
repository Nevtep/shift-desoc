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
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-12">
      <header className="space-y-5">
        <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {t.badge}
        </p>
        <div className="space-y-3">
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

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold">{t.card1Title}</h2>
          <p className="text-sm text-muted-foreground">{t.card1Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold">{t.card2Title}</h2>
          <p className="text-sm text-muted-foreground">{t.card2Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold">{t.card3Title}</h2>
          <p className="text-sm text-muted-foreground">{t.card3Body}</p>
        </article>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">{t.infoTitle}</h2>
        <details className="rounded-xl border border-border bg-background/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold">{t.infoDetail}</summary>
          <p className="mt-2 text-sm text-muted-foreground">{t.infoDetailBody}</p>
        </details>
      </section>

      <section className="space-y-4">
        <CommunityList />
      </section>
    </main>
  );
}
