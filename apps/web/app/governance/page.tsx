import Link from "next/link";

export const metadata = {
  title: "Governance | Shift"
};

export default function GovernancePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Governance</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Monitor proposals, voting activity, and timelock executions across Shift communities.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          className="rounded-lg border border-border p-4 shadow-sm transition hover:border-primary"
          href="/governance/proposals"
        >
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Proposals</h2>
            <p className="text-sm text-muted-foreground">
              Browse proposals, cast votes, and review execution timelines.
            </p>
          </div>
        </Link>
        <Link
          className="rounded-lg border border-border p-4 shadow-sm transition hover:border-primary"
          href="/governance/activity"
        >
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Activity (coming soon)</h2>
            <p className="text-sm text-muted-foreground">
              Cross-community governance feed powered by Ponder subscriptions.
            </p>
          </div>
        </Link>
      </div>
    </main>
  );
}
