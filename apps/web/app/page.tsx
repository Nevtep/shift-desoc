import Link from "next/link";
import { cookies } from "next/headers";

import { CommunityList } from "../components/communities/community-list";
import { DeployWizard } from "../components/home/deploy-wizard";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../lib/i18n";

export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).home;

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
          <a className="btn-primary cursor-pointer" href="#crear-comunidad">
            {t.ctaStart}
          </a>
          <Link className="btn-ghost cursor-pointer" href="/communities">
            {t.ctaExplore}
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold">{t.value1Title}</h2>
          <p className="text-sm text-muted-foreground">{t.value1Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold">{t.value2Title}</h2>
          <p className="text-sm text-muted-foreground">{t.value2Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold">{t.value3Title}</h2>
          <p className="text-sm text-muted-foreground">{t.value3Body}</p>
        </article>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">{t.howTitle}</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-xl border border-border bg-background/60 p-3 text-sm">
            <p className="font-semibold">1. Request</p>
            <p className="text-muted-foreground">Se propone una necesidad o iniciativa.</p>
          </li>
          <li className="rounded-xl border border-border bg-background/60 p-3 text-sm">
            <p className="font-semibold">2. Draft</p>
            <p className="text-muted-foreground">Se consolida una solucion operativa con detalles claros.</p>
          </li>
          <li className="rounded-xl border border-border bg-background/60 p-3 text-sm">
            <p className="font-semibold">3. Proposal</p>
            <p className="text-muted-foreground">La comunidad vota alternativas y define rumbo.</p>
          </li>
          <li className="rounded-xl border border-border bg-background/60 p-3 text-sm">
            <p className="font-semibold">4. Execution</p>
            <p className="text-muted-foreground">Se ejecuta con trazabilidad y verificaciones.</p>
          </li>
        </ol>
        <details className="rounded-xl border border-border bg-background/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold">{t.howDetail}</summary>
          <p className="mt-2 text-sm text-muted-foreground">{t.howDetailBody}</p>
        </details>
      </section>

      <section id="crear-comunidad" className="space-y-4">
        <div className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.mainActionLabel}</p>
          <h2 className="text-2xl font-semibold">{t.createSectionTitle}</h2>
        </div>
        <DeployWizard />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.communitiesLabel}</p>
            <h2 className="text-xl font-semibold">{t.communitiesTitle}</h2>
          </div>
          <Link className="text-sm underline" href="/communities">
            {t.communitiesLink}
          </Link>
        </div>
        <CommunityList />
      </section>
    </main>
  );
}
