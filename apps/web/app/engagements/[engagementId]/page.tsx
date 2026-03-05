import { ClaimDetail } from "../../../components/claims/claim-detail";

export const metadata = {
  title: "Engagement Detail | Shift"
};

type PageProps = {
  params: Promise<{
    engagementId: string;
  }>;
};

export function EngagementDetailPageContent({ engagementId }: { engagementId: string }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Engagement</p>
        <h1 className="text-3xl font-semibold">Engagement {engagementId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Engagement evidence manifests, juror ballots, and resolution status sync from the indexer and IPFS edge
          proxy.
        </p>
      </header>
      <ClaimDetail claimId={engagementId} />
    </main>
  );
}

export default async function EngagementDetailPage({ params }: PageProps) {
  const { engagementId } = await params;
  return <EngagementDetailPageContent engagementId={engagementId} />;
}
