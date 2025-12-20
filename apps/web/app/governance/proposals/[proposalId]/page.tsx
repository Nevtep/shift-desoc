import { ProposalDetail } from "../../../../components/governance/proposal-detail";

export const metadata = {
  title: "Proposal Detail | Shift"
};

type PageProps = {
  params: Promise<{
    proposalId: string;
  }>;
};

export default async function ProposalDetailPage({ params }: PageProps) {
  const { proposalId } = await params;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Proposal</p>
        <h1 className="text-3xl font-semibold">Proposal {proposalId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Proposal metadata, action bundle previews, and vote breakdowns sourced from the indexer and IPFS
          edge proxy.
        </p>
      </header>
      <ProposalDetail proposalId={proposalId} />
    </main>
  );
}
