import Link from "next/link";

import { RequestCreateForm } from "../../../../../../components/requests/request-create-form";

export const metadata = {
  title: "Create Community Request | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityRequestCreatePage({ params }: PageProps) {
  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Create request</h1>
        <Link className="text-sm underline" href={`/communities/${safeCommunityId}/coordination/requests`}>
          Back to requests
        </Link>
      </header>

      <RequestCreateForm
        fixedCommunityId={safeCommunityId}
        successRedirectHref={`/communities/${safeCommunityId}/coordination/requests`}
      />
    </main>
  );
}
