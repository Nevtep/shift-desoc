import { DraftDetail } from "../../../components/drafts/draft-detail";

export const metadata = {
  title: "Draft Detail | Shift"
};

type PageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

export default async function DraftDetailPage({ params }: PageProps) {
  const { draftId } = await params;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Draft</p>
        <h1 className="text-3xl font-semibold">Draft {draftId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Version history, review activity, and escalation status sync from the indexer alongside
          sanitized IPFS markdown.
        </p>
      </header>
      <DraftDetail draftId={draftId} />
    </main>
  );
}
