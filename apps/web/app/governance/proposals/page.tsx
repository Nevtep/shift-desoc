import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { GovernanceTechnicalFooter } from "../../../components/layout/governance-technical-footer";
import { ProposalList } from "../../../components/governance/proposal-list";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;
  return {
    title: t.metaProposalsTitle,
    description: t.metaProposalsDescription
  };
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProposalsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const communityIdParam = resolvedSearchParams?.communityId;
  const rawCommunityId = Array.isArray(communityIdParam) ? communityIdParam[0] : communityIdParam;
  const communityId =
    rawCommunityId && /^\d+$/.test(String(rawCommunityId).trim()) ? String(rawCommunityId).trim() : undefined;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:py-12">
      <header className="space-y-4">
        <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {t.governanceSpaceBadge}
        </p>
        <div className="space-y-2 sm:space-y-3">
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{t.listTitle}</h1>
          <p className="max-w-3xl text-muted-foreground">{t.listSubtitle}</p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold text-primary">{t.listCard1Title}</h2>
          <p className="text-sm text-muted-foreground">{t.listCard1Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold text-primary">{t.listCard2Title}</h2>
          <p className="text-sm text-muted-foreground">{t.listCard2Body}</p>
        </article>
        <article className="card-tight space-y-2">
          <h2 className="text-base font-semibold text-primary">{t.listCard3Title}</h2>
          <p className="text-sm text-muted-foreground">{t.listCard3Body}</p>
        </article>
      </section>

      <section className="space-y-4">
        <CommunityFilter
          currentCommunityId={communityId ?? undefined}
          labels={{
            filterLabel: t.listFilterLabel,
            hint: t.listFilterHint,
            placeholder: t.listCommunityPlaceholder,
            apply: t.apply,
            clear: t.clear
          }}
        />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-primary">{t.proposalListHeading}</h2>
          <p className="text-sm text-muted-foreground">
            {communityId ? t.proposalListSubFiltered.replace("{id}", communityId) : t.proposalListSubAll}
          </p>
        </div>
        <ProposalList communityId={communityId ?? undefined} />
      </section>

      <GovernanceTechnicalFooter />
    </main>
  );
}

function CommunityFilter({
  currentCommunityId,
  labels
}: {
  currentCommunityId?: string;
  labels: { filterLabel: string; hint: string; placeholder: string; apply: string; clear: string };
}) {
  return (
    <div className="card-tight flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="space-y-1 md:max-w-md md:shrink">
        <p className="text-sm font-semibold text-foreground">{labels.filterLabel}</p>
        <p className="text-xs text-muted-foreground">{labels.hint}</p>
      </div>
      <form
        className="flex w-full min-w-0 flex-col gap-3 md:w-auto md:flex-1 md:flex-row md:flex-nowrap md:items-center md:justify-end md:gap-3"
        action="/governance/proposals"
        method="get"
      >
        <input
          name="communityId"
          defaultValue={currentCommunityId}
          placeholder={labels.placeholder}
          className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm shadow-sm outline-none ring-primary/0 transition-shadow focus-visible:ring-2 md:max-w-[11rem] lg:max-w-[14rem]"
        />
        <div className="flex flex-shrink-0 flex-row flex-nowrap items-center gap-2">
          <button className="btn-primary-sm whitespace-nowrap" type="submit">
            {labels.apply}
          </button>
          <Link
            className="btn-ghost inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap px-3 text-sm"
            href="/governance/proposals"
          >
            {labels.clear}
          </Link>
        </div>
      </form>
    </div>
  );
}
