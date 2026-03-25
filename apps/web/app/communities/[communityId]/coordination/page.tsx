import { CoordinationTopBar } from "../../../../components/communities/coordination-top-bar";

export const metadata = {
  title: "Coordination Hub | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityCoordinationHubPage({ params }: PageProps) {
  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <CoordinationTopBar communityId={safeCommunityId} />

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card flex min-h-[180px] flex-col justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Requests</h2>
            <p className="text-sm text-muted-foreground">Create and manage work requests</p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <a className="btn-primary" href={`/communities/${safeCommunityId}/coordination/requests/new`}>
              Create request
            </a>
            <a className="text-sm underline" href={`/communities/${safeCommunityId}/coordination/requests`}>
              View all requests
            </a>
          </div>
        </article>

        <article className="card flex min-h-[180px] flex-col justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Drafts</h2>
            <p className="text-sm text-muted-foreground">Draft solutions and escalate to governance</p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <a className="btn-primary" href={`/communities/${safeCommunityId}/coordination/drafts/new`}>
              Create draft
            </a>
            <a className="text-sm underline" href={`/communities/${safeCommunityId}/coordination/drafts`}>
              View all drafts
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
