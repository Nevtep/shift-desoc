import { useMemo, type FormEvent, type ReactElement } from "react";

import { CommentContent } from "./comment-content.component";
import { buildCommentTree, formatDate } from "./helpers";
import { RoleChip } from "./role-chip.component";
import type { CommentView } from "./types";

export type RequestDetailCommentsProps = {
  comments: CommentView[];
  replyTo: string | null;
  onReplyChange: (value: string | null) => void;
  commentBody: string;
  onCommentBodyChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  commentError?: string | null;
  writeErrorMessage?: string | null;
  commentDisabled: boolean;
  isSubmitting: boolean;
  isWriting: boolean;
  isRequestOpen: boolean;
  isModerator: boolean;
  isConnected: boolean;
  hasHiddenComments: boolean;
  requestStatus?: string;
  requestAuthor?: string;
  currentAddress?: string;
  moderatingCommentId?: string | null;
  onModerate: (commentId: string | number, hide: boolean) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  unsupportedNetworkMessage?: string | null;
};

export function RequestDetailComments({
  comments,
  replyTo,
  onReplyChange,
  commentBody,
  onCommentBodyChange,
  onSubmit,
  commentError,
  writeErrorMessage,
  commentDisabled,
  isSubmitting,
  isWriting,
  isRequestOpen,
  isModerator,
  isConnected,
  hasHiddenComments,
  requestStatus,
  requestAuthor,
  currentAddress,
  moderatingCommentId,
  onModerate,
  onLoadMore,
  hasMore,
  unsupportedNetworkMessage
}: RequestDetailCommentsProps) {
  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const renderCommentTree = (parentKey: string, depth = 0): ReactElement | null => {
    const list = commentTree.get(parentKey) ?? [];
    if (!list.length) return null;

    return (
      <ul className="space-y-2">
        {list.map((comment) => {
          const isHidden = comment.isModerated;
          const isAuthor = requestAuthor && comment.author?.toLowerCase?.() === requestAuthor.toLowerCase();
          const isSelf = currentAddress && comment.author?.toLowerCase?.() === currentAddress.toLowerCase();
          const isModeratorAuthor = isSelf && isModerator;

          return (
            <li key={comment.id} className={`rounded border border-border p-3 ${depth ? "ml-4" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{comment.author}</span>
                  {isAuthor ? <RoleChip label="Author" tone="blue" /> : null}
                  {isModeratorAuthor ? <RoleChip label="Moderator" tone="purple" /> : null}
                  {isSelf && !isModeratorAuthor ? <RoleChip label="You" tone="slate" /> : null}
                  {comment.status === "pending" ? (
                    <span className="text-xs text-amber-600">Pending…</span>
                  ) : null}
                  {comment.status === "failed" ? (
                    <span className="text-xs text-destructive">Failed</span>
                  ) : null}
                  {isHidden ? <span className="text-xs text-amber-700">Hidden</span> : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(comment.createdAt)}</span>
                  <button className="underline" onClick={() => onReplyChange(String(comment.id))}>
                    Reply
                  </button>
                  {isModerator ? (
                    <button
                      className="underline"
                      disabled={Boolean(moderatingCommentId) || isWriting}
                      onClick={() => void onModerate(comment.id, !isHidden)}
                    >
                      {isHidden ? "Unhide" : "Hide"}
                    </button>
                  ) : null}
                </div>
              </div>
              {isHidden && !isModerator ? (
                <div className="mt-2 rounded border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Comment hidden by a moderator.
                </div>
              ) : (
                <CommentContent cid={comment.cid} />
              )}
              {renderCommentTree(String(comment.id), depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Comments</h2>
        {!isConnected ? <span className="text-xs text-muted-foreground">Connect a wallet to comment.</span> : null}
      </div>
      {!isModerator && hasHiddenComments ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Some comments are hidden by moderators.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-2">
        {replyTo ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Replying to comment #{replyTo}</span>
            <button type="button" className="underline" onClick={() => onReplyChange(null)}>
              Cancel reply
            </button>
          </div>
        ) : null}
        {!isRequestOpen ? (
          <p className="text-xs text-muted-foreground">
            Comments are closed while this request is {requestStatus?.toLowerCase?.() ?? "unavailable"}.
          </p>
        ) : null}
        <textarea
          required
          value={commentBody}
          onChange={(e) => onCommentBodyChange(e.target.value)}
          disabled={commentDisabled}
          className="min-h-[140px] w-full rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="Share context, feedback, or links to evidence"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={commentDisabled}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Posting…" : "Post comment"}
          </button>
          {commentError ? <span className="text-xs text-destructive">{commentError}</span> : null}
          {!commentError && writeErrorMessage ? <span className="text-xs text-destructive">{writeErrorMessage}</span> : null}
          {commentDisabled && unsupportedNetworkMessage ? (
            <span className="text-xs text-destructive">{unsupportedNetworkMessage}</span>
          ) : null}
        </div>
      </form>

      {comments.length ? (
        <div className="space-y-2 text-sm">
          {renderCommentTree("root") ?? <p className="text-sm text-muted-foreground">No threaded comments.</p>}
          <div className="flex items-center gap-3">
            {hasMore ? (
              <button className="text-xs underline" onClick={() => void onLoadMore()}>
                Load more comments
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">End of thread.</span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
    </section>
  );
}
