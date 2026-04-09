import Link from "next/link";

import { GovernanceTopBar } from "../../../../components/communities/governance-top-bar";

export const metadata = {
  title: "Community Governance Hub | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityGovernanceHubPage({ params }: PageProps) {
  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <GovernanceTopBar communityId={safeCommunityId} />

      <section className="grid gap-4 md:grid-cols-1">
        <article className="card flex min-h-[180px] flex-col justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Proposals</h2>
            <p className="text-sm text-muted-foreground">Review lifecycle status, cast weighted votes, and track readiness.</p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Link className="btn-primary" href={`/communities/${safeCommunityId}/governance/proposals`}>
              View all proposals
            </Link>
            <Link className="text-sm underline" href={`/communities/${safeCommunityId}`}>
              Back to overview
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
