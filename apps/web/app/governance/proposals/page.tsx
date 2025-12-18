import Link from "next/link";

export const metadata = {
  title: "Proposals | Shift"
};

export default function ProposalsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Governance Proposals</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Multi-choice and binary proposals from ShiftGovernor contracts will display here with live vote
          tallies once indexing lands.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Proposal list populated after GraphQL endpoint is available.
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/governance/proposals/new">
          Launch proposal flow (upcoming)
        </Link>
        <Link className="underline" href="/requests">
          Back to requests
        </Link>
      </div>
    </main>
  );
}
