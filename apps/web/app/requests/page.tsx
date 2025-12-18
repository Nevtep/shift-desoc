import Link from "next/link";

export const metadata = {
  title: "Requests | Shift"
};

export default function RequestsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Requests</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Requests capture early-stage ideas before they become drafts and proposals. Indexed data will
          populate this feed once the Ponder schema is live.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Request feed integration coming soon.
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/drafts">
          View drafts
        </Link>
        <Link className="underline" href="/governance/proposals">
          View proposals
        </Link>
      </div>
    </main>
  );
}
