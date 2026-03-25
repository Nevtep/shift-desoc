import Link from "next/link";

import { RequestList } from "../../../../../components/requests/request-list.container";

export const metadata = {
  title: "Community Requests | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityRequestsPage({ params }: PageProps) {
  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Requests</h1>
          <Link className="btn-primary" href={`/communities/${safeCommunityId}/coordination/requests/new`}>
            Create request
          </Link>
        </div>
        <div>
          <Link className="text-sm underline" href={`/communities/${safeCommunityId}/coordination`}>
            Back to coordination
          </Link>
        </div>
      </header>

      <RequestList
        communityId={String(safeCommunityId)}
        detailHrefBasePath={`/communities/${safeCommunityId}/coordination/requests`}
      />
    </main>
  );
}
