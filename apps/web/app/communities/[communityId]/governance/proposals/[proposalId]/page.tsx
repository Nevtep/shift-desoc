import Link from "next/link";

import { ProposalDetail } from "../../../../../../components/governance/proposal-detail";

export const metadata = {
  title: "Community Proposal Detail | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
    proposalId: string;
  }>;
};

export default async function CommunityProposalDetailPage({ params }: PageProps) {
  const { communityId, proposalId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Proposal</p>
        <h1 className="text-3xl font-semibold">Proposal {proposalId}</h1>
        <Link className="text-sm underline" href={`/communities/${safeCommunityId}/governance/proposals`}>
          Back to proposals
        </Link>
      </header>

      <ProposalDetail proposalId={proposalId} expectedCommunityId={safeCommunityId} />
    </main>
  );
}
