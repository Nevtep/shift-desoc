import Link from "next/link";

import { DraftCreateForm } from "../../../../../../../components/drafts/draft-create-form";

export const metadata = {
  title: "Create Community Draft (Expert) | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityDraftCreateExpertPage({ params }: PageProps) {
  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Create draft (expert)</h1>
        <Link className="text-sm underline" href={`/communities/${safeCommunityId}/coordination/drafts/new`}>
          Back to guided mode
        </Link>
      </header>

      <DraftCreateForm
        fixedCommunityId={safeCommunityId}
        mode="expert"
        guidedHref={`/communities/${safeCommunityId}/coordination/drafts/new`}
        successRedirectHref={`/communities/${safeCommunityId}/coordination/drafts`}
      />
    </main>
  );
}
