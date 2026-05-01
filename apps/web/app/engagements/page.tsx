import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { EngagementList } from "../../components/engagements/engagement-list";
import { EngagementSubmitModal } from "../../components/engagements/engagement-submit-modal";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).engagementsPage;
  return {
    title: t.metaTitle,
    description: t.metaDescription
  };
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function EngagementsPageContent({ communityId }: { communityId?: string }) {
  const t = getI18n().engagementsPage;
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
          <EngagementSubmitModal />
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

      <section className="space-y-6">
        <CommunityFilter
          currentCommunityId={communityId ?? undefined}
          filterHint={t.filterHint}
          filterLabel={t.filterLabel}
          filterPlaceholder={t.filterPlaceholder}
          applyLabel={t.filterApply}
          clearLabel={t.filterClear}
        />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-primary">{t.listHeading}</h2>
          <p className="text-sm text-muted-foreground">
            {communityId ? t.listSubFiltered.replace("{id}", communityId) : t.listSubAll}
          </p>
        </div>
        <EngagementList communityId={communityId ?? undefined} />
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

export default async function EngagementsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const communityIdParam = resolvedSearchParams?.communityId;
  const rawCommunityId = Array.isArray(communityIdParam) ? communityIdParam[0] : communityIdParam;
  const communityId =
    rawCommunityId && /^\d+$/.test(String(rawCommunityId).trim()) ? String(rawCommunityId).trim() : undefined;

  return <EngagementsPageContent communityId={communityId} />;
}

function CommunityFilter({
  currentCommunityId,
  filterHint,
  filterLabel,
  filterPlaceholder,
  applyLabel,
  clearLabel
}: {
  currentCommunityId?: string;
  filterHint: string;
  filterLabel: string;
  filterPlaceholder: string;
  applyLabel: string;
  clearLabel: string;
}) {
  return (
    <div className="card-tight flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="space-y-1 md:max-w-md md:shrink">
        <p className="text-sm font-semibold text-foreground">{filterLabel}</p>
        <p className="text-xs text-muted-foreground">{filterHint}</p>
      </div>
      <form
        className="flex w-full min-w-0 flex-col gap-3 md:w-auto md:flex-1 md:flex-row md:flex-nowrap md:items-center md:justify-end md:gap-3"
        action="/engagements"
        method="get"
      >
        <input
          name="communityId"
          defaultValue={currentCommunityId}
          placeholder={filterPlaceholder}
          className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm shadow-sm outline-none ring-primary/0 transition-shadow focus-visible:ring-2 md:max-w-[11rem] lg:max-w-[14rem]"
        />
        <div className="flex flex-shrink-0 flex-row flex-nowrap items-center gap-2">
          <button className="btn-primary-sm whitespace-nowrap" type="submit">
            {applyLabel}
          </button>
          <Link
            className="btn-ghost inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap px-3 text-sm"
            href="/engagements"
          >
            {clearLabel}
          </Link>
        </div>
      </form>
    </div>
  );
}
