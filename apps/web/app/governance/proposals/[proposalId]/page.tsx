import Link from "next/link";

export const metadata = {
  title: "Proposal Detail | Shift"
};

type PageProps = {
  params: {
    proposalId: string;
  };
};

export default function ProposalDetailPage({ params }: PageProps) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Proposal</p>
        <h1 className="text-3xl font-semibold">Proposal {params.proposalId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Proposal metadata, action bundle previews, and vote breakdowns will display here with live RPC
          truth checks.
        </p>
      </header>
      <section className="space-y-4">
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Voting Status</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Quorum progress, support percentages, and multi-choice weight distribution will render after
            the governor integration is online.
          </p>
        </div>
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Associated Draft</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Draft references and IPFS content will appear via the sanitized edge proxy.
          </p>
          <Link className="mt-3 inline-flex text-sm underline" href={`/drafts?proposalId=${params.proposalId}`}>
            View source draft
          </Link>
        </div>
      </section>
    </main>
  );
}
