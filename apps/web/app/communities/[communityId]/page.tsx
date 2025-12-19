import Link from "next/link";

export const metadata = {
  title: "Community Overview | Shift"
};

type PageParams = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityDetailPage({ params }: PageParams) {
  const { communityId } = await params;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Community
        </p>
        <h1 className="text-3xl font-semibold">Community {communityId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Detailed overview, governance configuration, and live metrics will appear here once
          indexing is complete.
        </p>
      </header>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Core Modules</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Links to requests, drafts, governance, and claims for this community.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link className="underline" href={`/requests?communityId=${communityId}`}>
                Requests
              </Link>
            </li>
            <li>
              <Link className="underline" href={`/drafts?communityId=${communityId}`}>
                Drafts
              </Link>
            </li>
            <li>
              <Link className="underline" href={`/governance/proposals?communityId=${communityId}`}>
                Proposals
              </Link>
            </li>
            <li>
              <Link className="underline" href={`/claims?communityId=${communityId}`}>
                Claims
              </Link>
            </li>
            <li>
              <Link className="underline" href={`/marketplace?communityId=${communityId}`}>
                Marketplace
              </Link>
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Governance Windows</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Voting delay, voting period, quorum, and timelock delays will be displayed once the
            Governor contract data is retrieved.
          </p>
        </div>
      </section>
    </main>
  );
}
