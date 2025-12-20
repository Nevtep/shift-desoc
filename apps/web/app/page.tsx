import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="space-y-3 text-center sm:text-left">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Shift DeSoc dApp</h1>
        <p className="max-w-2xl text-muted-foreground">
          Governance, verification, and commerce tooling for modular communities.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link className="underline" href="/communities">
            View communities
          </Link>
          <a
            className="underline"
            href="https://github.com/Shift-Labs/shift/tree/main/docs"
            target="_blank"
            rel="noreferrer"
          >
            Documentation
          </a>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Golden paths</p>
            <h2 className="text-xl font-semibold">Quick entry points</h2>
          </div>
          <Link className="text-sm underline" href="/communities">
            Browse all communities
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            className="rounded-lg border border-border p-4 text-left shadow-sm transition hover:border-primary"
            href="/requests"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Path A</p>
            <h3 className="text-lg font-semibold">Requests → Drafts → Proposals</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with a request, track draft iterations, and vote on proposals.
            </p>
          </Link>
          <Link
            className="rounded-lg border border-border p-4 text-left shadow-sm transition hover:border-primary"
            href="/claims"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Path B</p>
            <h3 className="text-lg font-semibold">Valuable Actions → Claims</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Review claim submissions, juror decisions, and evidence manifests.
            </p>
          </Link>
          <Link
            className="rounded-lg border border-border p-4 text-left shadow-sm transition hover:border-primary"
            href="/marketplace"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Path C</p>
            <h3 className="text-lg font-semibold">Marketplace → Orders/Reservations</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Explore offers, reservations, and disputes in the commerce flow.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
