import Link from "next/link";

import { DirectProposalCreateContainer } from "../../../../../../../components/governance/direct-proposal-create.container";

export const metadata = {
  title: "Create Governance Proposal | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityDirectProposalCreatePage({ params }: PageProps) {
  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Create proposal</h1>
        <Link className="text-sm underline" href={`/communities/${safeCommunityId}/governance/proposals`}>
          Back to proposals
        </Link>
      </header>

      <DirectProposalCreateContainer communityId={safeCommunityId} />
    </main>
  );
}
