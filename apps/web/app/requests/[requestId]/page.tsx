import { notFound } from "next/navigation";

export const metadata = {
  title: "Request Detail | Shift"
};

type PageProps = {
  params: {
    requestId: string;
  };
};

export default function RequestDetailPage({ params }: PageProps) {
  if (!params.requestId) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Request</p>
        <h1 className="text-3xl font-semibold">Request {params.requestId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Request metadata, comments, and escalation status will render here once connected to the
          indexer and IPFS edge proxy.
        </p>
      </header>
      <section className="space-y-3">
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Discussion</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Comment threads and valuable action links will display alongside sanitized markdown content
            fetched from IPFS.
          </p>
        </div>
      </section>
    </main>
  );
}
