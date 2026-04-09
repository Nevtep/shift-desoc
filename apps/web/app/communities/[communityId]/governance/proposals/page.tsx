import Link from "next/link";

import { ProposalList } from "../../../../../components/governance/proposal-list";

export const metadata = {
  title: "Community Proposals | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityProposalsPage({ params }: PageProps) {
  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Governance Proposals</h1>
          <span className="rounded bg-muted px-2 py-1 text-xs uppercase tracking-wide">Community #{safeCommunityId}</span>
        </div>
        <div>
          <Link className="text-sm underline" href={`/communities/${safeCommunityId}/governance`}>
            Back to governance hub
          </Link>
        </div>
      </header>

      <ProposalList
        communityId={safeCommunityId}
        detailHrefBasePath={`/communities/${safeCommunityId}/governance/proposals`}
      />
    </main>
  );
}
