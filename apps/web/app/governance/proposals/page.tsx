import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t.listTitle}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t.listSubtitle}</p>
      </header>
      <details className="card rounded-xl border border-border bg-background/70 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground transition-colors hover:text-primary">
          {t.topBarIndexerDetails}
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.topBarIndexerHelp}</p>
      </details>
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
    <div className="card flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>{labels.filterLabel}:</span>
      <form className="flex flex-wrap items-center gap-2" action="/governance/proposals" method="get">
        <input
          name="communityId"
          defaultValue={currentCommunityId}
          placeholder={labels.placeholder}
          className="rounded border border-border bg-background px-2 py-1 text-sm"
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
