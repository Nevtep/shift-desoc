import { ClaimDetail } from "../../../components/claims/claim-detail";

export const metadata = {
  title: "Claim Detail | Shift"
};

type PageProps = {
  params: {
    claimId: string;
  };
};

export default function ClaimDetailPage({ params }: PageProps) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Claim</p>
        <h1 className="text-3xl font-semibold">Claim {params.claimId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Claim evidence manifests, juror ballots, and resolution status sync from the indexer and IPFS edge
          proxy.
        </p>
      </header>
      <ClaimDetail claimId={params.claimId} />
    </main>
  );
}
