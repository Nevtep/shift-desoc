import Link from "next/link";

import { ProposalList } from "../../../components/governance/proposal-list";

export const metadata = {
  title: "Proposals | Shift"
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProposalsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const communityIdParam = resolvedSearchParams?.communityId;
  const communityId = Array.isArray(communityIdParam) ? communityIdParam[0] : communityIdParam;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Governance Proposals</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Multi-choice and binary proposals from ShiftGovernor contracts stream from the indexer. Filter by
          community to narrow results.
        </p>
      </header>
      <section className="space-y-4">
        <CommunityFilter currentCommunityId={communityId ?? undefined} />
        <ProposalList communityId={communityId ?? undefined} />
      </section>
    </main>
  );
}

function CommunityFilter({ currentCommunityId }: { currentCommunityId?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4 text-sm text-muted-foreground">
      <span>Filtering by community:</span>
      <form className="flex flex-wrap items-center gap-2" action="/governance/proposals" method="get">
        <input
          name="communityId"
          defaultValue={currentCommunityId}
          placeholder="Community ID"
          className="rounded border border-border bg-background px-2 py-1 text-sm"
        />
        <button className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" type="submit">
          Apply
        </button>
        <Link className="text-xs underline" href="/governance/proposals">
          Clear
        </Link>
      </form>
    </div>
  );
}
