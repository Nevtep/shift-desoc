import Link from "next/link";

import { DraftList } from "../../../../../components/drafts/draft-list";

export const metadata = {
  title: "Community Drafts | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityDraftsPage({ params }: PageProps) {
  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Drafts</h1>
          <Link className="btn-primary" href={`/communities/${safeCommunityId}/coordination/drafts/new`}>
            Create draft
          </Link>
        </div>
        <div>
          <Link className="text-sm underline" href={`/communities/${safeCommunityId}/coordination`}>
            Back to coordination
          </Link>
        </div>
      </header>

      <DraftList
        communityId={String(safeCommunityId)}
        detailHrefBasePath={`/communities/${safeCommunityId}/coordination/drafts`}
      />
    </main>
  );
}
