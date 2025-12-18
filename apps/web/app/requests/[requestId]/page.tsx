import { RequestDetail } from "../../../components/requests/request-detail";

export const metadata = {
  title: "Request Detail | Shift"
};

type PageProps = {
  params: {
    requestId: string;
  };
};

export default function RequestDetailPage({ params }: PageProps) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Request</p>
        <h1 className="text-3xl font-semibold">Request {params.requestId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Review request metadata, associated drafts, and sanitized discussion threads pulled from the
          indexer and IPFS edge proxy.
        </p>
      </header>
      <section className="space-y-6">
        <RequestDetail requestId={params.requestId} />
      </section>
    </main>
  );
}
