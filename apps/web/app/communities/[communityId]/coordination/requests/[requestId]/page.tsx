import Link from "next/link";

import { RequestDetail } from "../../../../../../components/requests/request-detail";

export const metadata = {
  title: "Community Request Detail | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
    requestId: string;
  }>;
};

export default async function CommunityRequestDetailPage({ params }: PageProps) {
  const { communityId, requestId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;
  const safeRequestId = (() => {
    try {
      return decodeURIComponent(requestId);
    } catch {
      return requestId;
    }
  })();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Request</p>
        <h1 className="text-3xl font-semibold">Request {safeRequestId}</h1>
        <Link className="text-sm underline" href={`/communities/${safeCommunityId}/coordination/requests`}>
          Back to requests
        </Link>
      </header>

      <RequestDetail
        requestId={safeRequestId}
        expectedCommunityId={safeCommunityId}
        draftHrefBasePath={`/communities/${safeCommunityId}/coordination/drafts`}
      />
    </main>
  );
}
