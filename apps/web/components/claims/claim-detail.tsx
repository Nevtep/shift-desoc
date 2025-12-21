"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIpfsDocument, type IpfsDocumentResponse } from "../../hooks/useIpfsDocument";
import {
  ClaimQuery,
  type ClaimQueryResult
} from "../../lib/graphql/queries";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { getContractConfig } from "../../lib/contracts";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
    return <p className="text-sm text-muted-foreground">Loading claim...</p>;
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
          <p className="text-sm text-muted-foreground">Loading manifest...</p>
        ) : isManifestError ? (
          <p className="text-sm text-destructive">Failed to load evidence manifest.</p>
        ) : manifest ? (
          <EvidenceManifest manifest={manifest} />
        ) : (
          <p className="text-sm text-muted-foreground">No evidence manifest uploaded.</p>
        )}
      </section>

      <section className="space-y-3">
        <VerifyClaimForm
          claimId={claim.id}
          claimStatus={claim.status}
          assignments={claim.jurorAssignments ?? []}
        />
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

type JurorAssignment = NonNullable<ClaimQueryResult["claim"]>["jurorAssignments"][number];

function VerifyClaimForm({
  claimId,
  claimStatus,
  assignments
}: {
  claimId: string;
  claimStatus: string;
  assignments: JurorAssignment[];
}) {
  const router = useRouter();
  const chainId = useChainId();
  const { status, address } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [success, setSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isConnected = status === "connected";
  const jurorAssignment = useMemo(() => {
    if (!address) return null;
    return assignments.find((a) => a.juror.toLowerCase() === address.toLowerCase()) ?? null;
  }, [address, assignments]);

  const alreadyDecided = Boolean(jurorAssignment?.decision);
  const isEligible = isConnected && Boolean(jurorAssignment) && !alreadyDecided && claimStatus !== "Resolved";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    if (!jurorAssignment) {
      setActionError("You are not assigned as a juror for this claim.");
      return;
    }
    try {
      const { address, abi } = getContractConfig("claims", chainId);
      await writeContractAsync({
        address,
        abi,
        functionName: "verify",
        args: [BigInt(claimId), decision === "approve"]
      });
      setSuccess("Verification submitted.");
      router.refresh();
    } catch (err) {
      console.error(err);
      setActionError(formatClaimTxError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Verify Claim</h3>
          <p className="text-sm text-muted-foreground">Only assigned jurors can verify on-chain.</p>
        </div>
        <span className="text-xs text-muted-foreground">Claim {claimId}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="decision"
            value="approve"
            checked={decision === "approve"}
            onChange={() => setDecision("approve")}
          />
          <span>Approve</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="decision"
            value="reject"
            checked={decision === "reject"}
            onChange={() => setDecision("reject")}
          />
          <span>Reject</span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!isEligible || isPending}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Submitting..." : "Submit verification"}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to verify.</span> : null}
        {isConnected && !jurorAssignment ? (
          <span className="text-xs text-destructive">You are not assigned as a juror for this claim.</span>
        ) : null}
        {alreadyDecided ? (
          <span className="text-xs text-muted-foreground">Decision already submitted.</span>
        ) : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {success ? <span className="text-xs text-emerald-600">{success}</span> : null}
        {actionError ? <span className="text-xs text-destructive">{actionError}</span> : null}
      </div>
    </form>
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

function formatClaimTxError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("not selected") || lower.includes("not juror") || lower.includes("notauthorized")) {
    return "You are not an assigned juror for this claim.";
  }
  if (lower.includes("already verified") || lower.includes("decision recorded")) {
    return "You have already submitted a decision for this claim.";
  }
  return message.replace(/execution reverted: ?/i, "");
}
