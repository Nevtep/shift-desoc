import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import { isIpfsDocumentResponse } from "./helpers";

export function CommentContent({ cid }: { cid: string }) {
  const { data, isLoading, isError, refetch } = useIpfsDocument(cid, Boolean(cid));
  const commentDoc = isIpfsDocumentResponse(data) ? data : null;

  if (isLoading) {
    return <p className="mt-2 text-xs text-muted-foreground">Loading comment…</p>;
  }
  if (isError) {
    return (
      <div className="mt-2 space-y-1 text-xs">
        <p className="text-destructive">Failed to load comment content.</p>
        <button className="underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }
  if (!commentDoc?.html?.body) {
    return <p className="mt-2 text-xs text-muted-foreground">No comment body provided.</p>;
  }
  return (
    <article
      className="prose prose-xs mt-2 max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: commentDoc.html.body }}
    />
  );
}
