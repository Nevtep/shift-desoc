import Link from "next/link";

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
          Claim evidence manifests, juror ballots, and final resolution will render after indexer wiring.
        </p>
      </header>
      <section className="space-y-4">
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Verification Panel</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Juror assignments and decision timestamps will display here using indexed events.
          </p>
        </div>
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Evidence</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sanitized markdown from the IPFS edge proxy will appear in this section.
          </p>
          <Link className="mt-3 inline-flex text-sm underline" href={`/governance/proposals?claimId=${params.claimId}`}>
            View associated governance
          </Link>
        </div>
      </section>
    </main>
  );
}
