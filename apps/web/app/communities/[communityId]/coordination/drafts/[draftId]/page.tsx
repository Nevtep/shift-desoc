import Link from "next/link";

import { DraftDetail } from "../../../../../../components/drafts/draft-detail";

export const metadata = {
  title: "Community Draft Detail | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
    draftId: string;
  }>;
};

export default async function CommunityDraftDetailPage({ params }: PageProps) {
  const { communityId, draftId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Draft</p>
        <h1 className="text-3xl font-semibold">Draft {draftId}</h1>
        <Link className="text-sm underline" href={`/communities/${safeCommunityId}/coordination/drafts`}>
          Back to drafts
        </Link>
      </header>
      <DraftDetail
        draftId={draftId}
        expectedCommunityId={safeCommunityId}
        draftsListHref={`/communities/${safeCommunityId}/coordination/drafts`}
        useCommunityScopedRequestLinks
      />
    </main>
  );
}
