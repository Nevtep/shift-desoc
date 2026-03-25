import Link from "next/link";

import { DraftCreateForm } from "../../../../../../components/drafts/draft-create-form";

export const metadata = {
  title: "Create Community Draft | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommunityDraftCreatePage({ params, searchParams }: PageProps) {
  const { communityId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestIdParam = resolvedSearchParams?.requestId;
  const requestIdValue = Array.isArray(requestIdParam) ? requestIdParam[0] : requestIdParam;
  const normalizedRequestId = Number(requestIdValue);
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Create draft</h1>
        <Link className="text-sm underline" href={`/communities/${safeCommunityId}/coordination/drafts`}>
          Back to drafts
        </Link>
      </header>

      <DraftCreateForm
        fixedCommunityId={safeCommunityId}
        initialRequestId={Number.isFinite(normalizedRequestId) && normalizedRequestId >= 0 ? normalizedRequestId : undefined}
        successRedirectHref={`/communities/${safeCommunityId}/coordination/drafts`}
        expertHref={`/communities/${safeCommunityId}/coordination/drafts/new/expert`}
      />
    </main>
  );
}
