import Link from "next/link";

import type { DraftView } from "./types";

export function RequestDetailDrafts({
  drafts,
  draftHrefBuilder,
  draftHrefBasePath
}: {
  drafts: DraftView[];
  draftHrefBuilder?: (draft: DraftView) => string;
  draftHrefBasePath?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Drafts</h2>
      {drafts.length ? (
        <ul className="space-y-2 text-sm">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex flex-wrap items-center gap-2">
              <Link
                className="underline"
                href={
                  draftHrefBasePath
                    ? `${draftHrefBasePath}/${draft.id}`
                    : draftHrefBuilder
                      ? draftHrefBuilder(draft)
                      : `/drafts/${draft.id}`
                }
              >
                Draft {draft.id}
              </Link>
              <span className="text-muted-foreground">Status: {draft.status}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No drafts linked yet.</p>
      )}
    </section>
  );
}
