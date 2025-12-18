import Link from "next/link";

export const metadata = {
  title: "Drafts | Shift"
};

export default function DraftsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Drafts</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Drafts consolidate community collaboration before formal proposals. Snapshot history and review
          states will be connected after GraphQL entities are in place.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Draft listings coming online with Ponder integration.
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/requests">
          Return to requests
        </Link>
        <Link className="underline" href="/governance/proposals">
          Explore proposals
        </Link>
      </div>
    </main>
  );
}
