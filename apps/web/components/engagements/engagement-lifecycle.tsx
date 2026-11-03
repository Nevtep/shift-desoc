"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useAccount, useChainId, useWriteContract } from "wagmi";

import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "../../hooks/useCommunityModules";
import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { txExplorerUrl } from "../../lib/engagements/explorer";
import { normalizeEngagementStatus } from "../../lib/engagements/engagement-status";
import {
  EngagementSbtsQuery,
  type EngagementAppeal,
  type EngagementNode,
  type EngagementSbtsQueryResult
} from "../../lib/graphql/queries";

function TxLink({ txHash }: { txHash: string }) {
  const chainId = useChainId();
  return (
    <a className="underline" href={txExplorerUrl(chainId, txHash)} target="_blank" rel="noreferrer">
      {txHash}
    </a>
  );
}

export function EngagementLifecycle({
  engagement,
  appeals
}: {
  engagement: EngagementNode;
  appeals: EngagementAppeal[];
}) {
  const status = normalizeEngagementStatus(engagement.status);
  const hasTallies = engagement.approvalsCount != null && engagement.rejectionsCount != null;

  return (
    <section className="space-y-3" aria-label="engagement-lifecycle">
      <h2 className="text-lg font-medium">Lifecycle evidence</h2>
      <div className="card space-y-2 text-sm text-muted-foreground">
        {hasTallies ? (
          <p>
            Final vote: {engagement.approvalsCount} {engagement.approvalsCount === 1 ? "approval" : "approvals"} /{" "}
            {engagement.rejectionsCount} {engagement.rejectionsCount === 1 ? "rejection" : "rejections"}
          </p>
        ) : null}
        {engagement.lastEventName && engagement.lastEventTxHash ? (
          <p>
            Last on-chain event: <span className="font-medium text-foreground">{engagement.lastEventName}</span>
            {engagement.lastEventBlock ? ` (block ${engagement.lastEventBlock})` : ""} — <TxLink txHash={engagement.lastEventTxHash} />
          </p>
        ) : (
          <p>No on-chain lifecycle event has been indexed for this engagement yet.</p>
        )}
        {status === "REVOKED" ? (
          <p>
            Revoked by <span className="font-medium text-foreground">{engagement.revokedBy ?? "unknown"}</span>. Revocation
            is governance-only; use the community governance proposals below to act on it.
          </p>
        ) : null}
        {status === "APPROVED" ? <EngagementSbtRecord engagement={engagement} /> : null}
      </div>
      <EngagementAppeals engagement={engagement} appeals={appeals} />
    </section>
  );
}

function EngagementSbtRecord({ engagement }: { engagement: EngagementNode }) {
  const enabled = Boolean(engagement.resolvedTxHash);
  const { data, isLoading } = useGraphQLQuery<
    EngagementSbtsQueryResult,
    { communityId: number; subject: string; txHash: string }
  >(
    ["engagement-sbts", engagement.id, engagement.resolvedTxHash],
    EngagementSbtsQuery,
    enabled
      ? { communityId: engagement.communityId, subject: engagement.participant, txHash: engagement.resolvedTxHash as string }
      : undefined,
    { enabled }
  );
  if (isLoading) return <p>Checking SBT record…</p>;
  const sbt = data?.sbts.items[0];
  if (!sbt) return <p>No SBT record indexed for this engagement.</p>;
  return (
    <p>
      SBT minted: token #{sbt.tokenId} ({sbt.kind}) — <TxLink txHash={sbt.txHash} />
    </p>
  );
}

function EngagementAppeals({ engagement, appeals }: { engagement: EngagementNode; appeals: EngagementAppeal[] }) {
  const { address, status: walletStatus } = useAccount();
  const status = normalizeEngagementStatus(engagement.status);
  const isParticipant =
    walletStatus === "connected" && Boolean(address) && address!.toLowerCase() === engagement.participant.toLowerCase();
  const hasPendingAppeal = appeals.some((a) => a.status === "PENDING");
  const canAppeal = status === "REJECTED" && isParticipant && !hasPendingAppeal;

  if (!appeals.length && !canAppeal && status !== "REJECTED") return null;

  return (
    <div className="card space-y-3">
      <h3 className="text-base font-semibold">Appeals</h3>
      {appeals.length ? (
        <ul className="space-y-2 text-sm">
          {appeals.map((appeal) => (
            <li key={appeal.id} className="card-tight">
              <p className="font-medium">
                Appeal {appeal.appealId} — {appeal.status}
              </p>
              <p className="mt-1 text-muted-foreground">{appeal.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(appeal.submittedAt), { addSuffix: true })} — <TxLink txHash={appeal.txHash} />
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No appeals submitted.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Appeal resolution is not available on-chain yet: the contract has no function to resolve an appeal, so appeals
        stay pending.
      </p>
      {canAppeal ? <AppealForm engagement={engagement} /> : null}
    </div>
  );
}

function AppealForm({ engagement }: { engagement: EngagementNode }) {
  const chainId = useChainId();
  const { writeContractAsync, isPending } = useWriteContract();
  const { modules } = useCommunityModules({ communityId: engagement.communityId, chainId, enabled: true });
  const [reason, setReason] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!modules?.engagementsManager) {
      setError("Engagements module is not registered for this community.");
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: modules.engagementsManager,
        abi: COMMUNITY_MODULE_ABIS.engagements,
        functionName: "submitAppeal",
        args: [BigInt(engagement.engagementId), reason.trim()]
      });
      setTxHash(hash);
      setReason("");
    } catch (err) {
      console.error(err);
      setError((err instanceof Error ? err.message : String(err)).replace(/execution reverted: ?/i, ""));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Appeal reason</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-[80px] rounded border border-border bg-background px-3 py-2"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={!reason.trim() || isPending}>
          {isPending ? "Submitting..." : "Submit appeal"}
        </button>
        {txHash ? (
          <span className="text-xs text-emerald-600">
            Appeal submitted ({txHash}). It will show above once the indexer catches up.
          </span>
        ) : null}
        {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
      </div>
    </form>
  );
}
