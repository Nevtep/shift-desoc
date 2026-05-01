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
  const communityId = Array.isArray(communityIdParam) ? communityIdParam[0] : communityIdParam;

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

      <section className="space-y-4">
        <CommunityFilter
          currentCommunityId={communityId ?? undefined}
          labels={{
            filterLabel: t.listFilterLabel,
            placeholder: t.listCommunityPlaceholder,
            apply: t.apply,
            clear: t.clear
          }}
        />
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
  labels: { filterLabel: string; placeholder: string; apply: string; clear: string };
}) {
  return (
    <div className="card-tight flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>{labels.filterLabel}:</span>
      <form className="flex flex-wrap items-center gap-2" action="/governance/proposals" method="get">
        <input
          name="communityId"
          defaultValue={currentCommunityId}
          placeholder={labels.placeholder}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button className="btn-primary-sm" type="submit">
          {labels.apply}
        </button>
        <Link className="text-xs underline" href="/governance/proposals">
          {labels.clear}
        </Link>
      </form>
    </div>
  );
}
