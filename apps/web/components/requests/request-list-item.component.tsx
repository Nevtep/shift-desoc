
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import { formatDate, isIpfsDocumentResponse, shortAddress, statusBadge } from "./helpers";

export type RequestNode = {
  id: number;
  communityId: number;
  author: string;
  status: string;
  cid: string;
  tags: string[];
  createdAt: string;
};

export function RequestListItem({ request, communityName }: { request: RequestNode; communityName?: string }) {
  const { data: ipfs } = useIpfsDocument(request.cid, Boolean(request.cid));
  const ipfsDoc = isIpfsDocumentResponse(ipfs) ? ipfs : null;
  const title =
    ipfsDoc?.data && typeof ipfsDoc.data === "object" && "type" in ipfsDoc.data && (ipfsDoc.data as { type?: string }).type === "request"
      ? (ipfsDoc.data as { title?: string }).title ?? null
      : null;

  return (
    <li className="rounded-lg border border-border p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {communityName ?? `Community ${request.communityId}`}
          </span>
          <span className="text-xs text-muted-foreground">
            Created {formatDate(request.createdAt)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(request.status).className}`}
          >
            {statusBadge(request.status).label}
          </span>
        </div>
        <p className="text-sm font-medium">{title || `Request #${request.id}`}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">{shortAddress(request.author)}</span>
          <span>Author</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {request.tags?.length
            ? request.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wide"
                >
                  {tag}
                </span>
              ))
            : null}
        </div>
        <a className="text-sm underline" href={`/requests/${request.id}`}>
          View details
        </a>
      </div>
    </li>
  );
}