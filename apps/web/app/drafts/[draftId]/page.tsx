import { DraftDetail } from "../../../components/drafts/draft-detail";

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
          Version history, review activity, and escalation status sync from the indexer alongside
          sanitized IPFS markdown.
        </p>
      </header>
      <DraftDetail draftId={params.draftId} />
    </main>
  );
}
