"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIpfsDocument, type IpfsDocumentResponse } from "../../hooks/useIpfsDocument";
import {
  ClaimQuery,
  type ClaimQueryResult
} from "../../lib/graphql/queries";

export type ClaimDetailProps = {
  claimId: string;
};

export function ClaimDetail({ claimId }: ClaimDetailProps) {
  const { data, isLoading, isError, refetch } = useGraphQLQuery<ClaimQueryResult, { id: string }>(
    ["claim", claimId],
    ClaimQuery,
    { id: claimId }
  );

  const claim = data?.claim ?? null;
  const manifestCid = claim?.evidenceManifestCid ?? undefined;
  const { data: manifest, isLoading: isManifestLoading, isError: isManifestError } = useIpfsDocument(
    manifestCid,
    Boolean(manifestCid)
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading claim…</p>;
  }

  if (isError || !claim) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">Failed to load claim.</p>
        <button className="text-xs underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Metadata</h2>
          <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <MetadataItem label="Valuable Action" value={claim.valuableActionId} />
            <MetadataItem label="Claimant" value={claim.claimant} />
            <MetadataItem label="Status" value={claim.status} />
            <MetadataItem
              label="Submitted"
              value={formatDistanceToNow(new Date(claim.submittedAt), { addSuffix: true })}
            />
            {claim.resolvedAt ? (
              <MetadataItem
                label="Resolved"
                value={formatDistanceToNow(new Date(claim.resolvedAt), { addSuffix: true })}
              />
            ) : null}
          </dl>
          <div className="mt-3 text-xs">
            <Link className="underline" href={`/governance/proposals?claimId=${claim.id}`}>
              View related governance proposals
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Evidence</h2>
        {isManifestLoading ? (
          <p className="text-sm text-muted-foreground">Loading manifest…</p>
        ) : isManifestError ? (
          <p className="text-sm text-destructive">Failed to load evidence manifest.</p>
        ) : manifest ? (
          <EvidenceManifest manifest={manifest} />
        ) : (
          <p className="text-sm text-muted-foreground">No evidence manifest uploaded.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Juror Panel</h2>
        {(claim.jurorAssignments ?? []).length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">Juror</th>
                <th>Weight</th>
                <th>Decision</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {(claim.jurorAssignments ?? []).map((assignment) => (
                <tr key={`${assignment.juror}-${assignment.decision ?? "pending"}`} className="border-t border-border">
                  <td className="py-2 align-top font-medium">{assignment.juror}</td>
                  <td className="py-2 align-top text-muted-foreground">{assignment.weight}</td>
                  <td className="py-2 align-top text-muted-foreground">{assignment.decision ?? "Pending"}</td>
                  <td className="py-2 align-top text-muted-foreground">
                    {assignment.decidedAt
                      ? formatDistanceToNow(new Date(assignment.decidedAt), { addSuffix: true })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">Juror assignments will appear once selection occurs.</p>
        )}
      </section>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <dt className="font-medium text-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EvidenceManifest({ manifest }: { manifest: IpfsDocumentResponse }) {
  if (manifest.data.type !== "claimEvidence") {
    return <p className="text-sm text-muted-foreground">Manifest is not a claim evidence document.</p>;
  }

  const evidence = manifest.data.evidence ?? [];

  if (!evidence.length) {
    return <p className="text-sm text-muted-foreground">Manifest contains no evidence entries.</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {evidence.map((item, index) => (
        <li key={`${item.cid ?? index}`} className="rounded border border-border p-3">
          <p className="font-medium">{item.title ?? `Evidence ${index + 1}`}</p>
          <p className="text-xs text-muted-foreground">Type: {item.type ?? "unknown"}</p>
          {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
          {item.cid ? (
            <a className="mt-2 inline-flex text-xs underline" href={`/api/ipfs/${item.cid}`} target="_blank" rel="noreferrer">
              Fetch sanitized content
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
