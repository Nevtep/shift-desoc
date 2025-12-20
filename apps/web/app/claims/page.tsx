import Link from "next/link";

import { ClaimList } from "../../components/claims/claim-list";
import { ClaimSubmitForm } from "../../components/claims/claim-submit-form";

export const metadata = {
  title: "Claims | Shift"
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClaimsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const communityIdParam = resolvedSearchParams?.communityId;
  const communityId = Array.isArray(communityIdParam) ? communityIdParam[0] : communityIdParam;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Claims</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Track valuable actions from submission through juror verification and resolution.
        </p>
      </header>
      <ClaimSubmitForm />
      <section className="space-y-4">
        <CommunityFilter currentCommunityId={communityId ?? undefined} />
        <ClaimList communityId={communityId ?? undefined} />
      </section>
    </main>
  );
}

function CommunityFilter({ currentCommunityId }: { currentCommunityId?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4 text-sm text-muted-foreground">
      <span>Filtering by community:</span>
      <form className="flex flex-wrap items-center gap-2" action="/claims" method="get">
        <input
          name="communityId"
          defaultValue={currentCommunityId}
          placeholder="Community ID"
          className="rounded border border-border bg-background px-2 py-1 text-sm"
        />
        <button className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" type="submit">
          Apply
        </button>
        <Link className="text-xs underline" href="/claims">
          Clear
        </Link>
      </form>
    </div>
  );
}
