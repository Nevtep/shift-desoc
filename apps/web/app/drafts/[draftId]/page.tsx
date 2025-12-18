import Link from "next/link";

export const metadata = {
  title: "Draft Detail | Shift"
};

type PageProps = {
  params: {
    draftId: string;
  };
};

export default function DraftDetailPage({ params }: PageProps) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Draft</p>
        <h1 className="text-3xl font-semibold">Draft {params.draftId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Version history, review activity, and escalation status will render here with the indexed data
          and IPFS-backed markdown.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Latest Version</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sanitized draft content from IPFS will display after the edge proxy wiring is complete.
          </p>
        </div>
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Actions</h2>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              <Link className="underline" href={`/governance/proposals?sourceDraft=${params.draftId}`}>
                View escalated proposal
              </Link>
            </li>
            <li>
              <span className="text-muted-foreground">Submit review (coming soon)</span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
