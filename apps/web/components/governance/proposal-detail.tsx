"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "../../hooks/useCommunityModules";
import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIndexerHealth } from "../../hooks/useIndexerHealth";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import {
  type ProposalQueryResult,
  ProposalQuery
} from "../../lib/graphql/queries";
import {
  deriveReadinessFromIndexer,
  mergeFallbackReadiness,
  needsReadinessFallback,
  type ProposalReadiness
} from "../../lib/governance/proposal-readiness";
import { proposalStatusBadgeLabel } from "../../lib/governance/proposal-status";
import {
  bpsToPercentLabel,
  isExactTotalBps,
  percentToBps,
  sumBps,
  toContractWeightsBps,
  TOTAL_BPS
} from "../../lib/governance/weighted-vote";

export type ProposalDetailProps = {
  proposalId: string;
  expectedCommunityId?: number;
};

export function ProposalDetail({ proposalId, expectedCommunityId }: ProposalDetailProps) {
  const { data, isLoading, isError, refetch } = useGraphQLQuery<ProposalQueryResult, { id: string }>(
    ["proposal", proposalId],
    ProposalQuery,
    { id: proposalId }
  );

  const proposal = data?.proposal ?? null;
  const cid = proposal?.descriptionCid ?? undefined;
  const { data: ipfsData, isLoading: isIpfsLoading, isError: isIpfsError } = useIpfsDocument(cid, Boolean(cid));
  const ipfsDoc = useMemo(() => (isIpfsDocumentResponse(ipfsData) ? ipfsData : null), [ipfsData]);

  const statusLabel = proposalStatusBadgeLabel(proposal?.state);
  const mismatch =
    proposal &&
    typeof expectedCommunityId === "number" &&
    Number.isFinite(expectedCommunityId) &&
    expectedCommunityId > 0 &&
    Number(proposal.communityId) !== expectedCommunityId;

  const correctedHref = proposal
    ? `/communities/${proposal.communityId}/governance/proposals/${proposal.id}`
    : null;

  const fallbackListHref = `/communities/${proposal?.communityId ?? expectedCommunityId ?? 0}/governance/proposals`;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading proposal...</p>;
  }

  if (isError || !proposal) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">Failed to load proposal.</p>
        <button className="text-xs underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {mismatch ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This proposal belongs to Community #{proposal.communityId}, not Community #{expectedCommunityId}. {" "}
          {correctedHref ? (
            <a className="underline" href={correctedHref}>
              Open the correct route
            </a>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="card">
          <h2 className="text-lg font-medium">Metadata</h2>
          <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <MetadataItem label="Community" value={String(proposal.communityId)} />
            <MetadataItem label="Proposer" value={proposal.proposer} />
            <MetadataItem label="State" value={statusLabel} />
            <MetadataItem
              label="Created"
              value={formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}
            />
          </dl>
        </div>
      </section>

      <section className="space-y-3">
        <ReadinessPanel proposal={proposal} />
      </section>

      <section className="space-y-3">
        <VoteForm
          proposalId={proposal.id}
          communityId={Number(proposal.communityId)}
          multiChoiceOptions={proposal.multiChoiceOptions ?? []}
          proposalState={statusLabel}
          listHref={fallbackListHref}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Description</h2>
        {isIpfsLoading ? (
          <p className="text-sm text-muted-foreground">Loading description...</p>
        ) : isIpfsError ? (
          <p className="text-sm text-destructive">Failed to load IPFS description.</p>
        ) : ipfsDoc?.html?.body ? (
          <article className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: ipfsDoc.html.body }} />
        ) : (
          <p className="text-sm text-muted-foreground">No description available.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Votes</h2>
        {(proposal.votes ?? []).length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">Voter</th>
                <th>Weight</th>
                <th>Option</th>
                <th>Cast</th>
              </tr>
            </thead>
            <tbody>
              {(proposal.votes ?? []).map((vote, index) => (
                <tr key={`${vote.voter}-${index}`} className="border-t border-border">
                  <td className="py-2 align-top font-medium">{vote.voter}</td>
                  <td className="py-2 align-top text-muted-foreground">{vote.weight}</td>
                  <td className="py-2 align-top text-muted-foreground">{formatVoteOption(vote.optionIndex)}</td>
                  <td className="py-2 align-top text-muted-foreground">{formatDistanceToNow(new Date(vote.castAt), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No votes recorded yet.</p>
        )}
      </section>
    </div>
  );
}

function ReadinessPanel({ proposal }: { proposal: NonNullable<ProposalQueryResult["proposal"]> }) {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { modules } = useCommunityModules({ communityId: Number(proposal.communityId), chainId, enabled: true });
  const health = useIndexerHealth(new Date().toISOString());
  const governorAddress = modules?.governor;

  const [readiness, setReadiness] = useState<ProposalReadiness>(() =>
    deriveReadinessFromIndexer({
      state: proposalStatusBadgeLabel(proposal.state),
      queuedAt: proposal.queuedAt,
      executedAt: proposal.executedAt
    })
  );

  useEffect(() => {
    const indexerReadiness = deriveReadinessFromIndexer({
      state: proposalStatusBadgeLabel(proposal.state),
      queuedAt: proposal.queuedAt,
      executedAt: proposal.executedAt
    });

    const staleReason = needsReadinessFallback({
      state: proposalStatusBadgeLabel(proposal.state),
      queuedAt: proposal.queuedAt,
      executedAt: proposal.executedAt,
      indexerHealth: health.state
    });

    if (staleReason === "none" || !publicClient || !governorAddress) {
      setReadiness(indexerReadiness);
      return;
    }

    const fallbackClient = publicClient;

    let cancelled = false;

    async function hydrateFallback() {
      const result = await Promise.allSettled([
        fallbackClient.readContract({
          address: governorAddress,
          abi: COMMUNITY_MODULE_ABIS.governor,
          functionName: "state",
          args: [BigInt(proposal.id)]
        } as any),
        fallbackClient.readContract({
          address: governorAddress,
          abi: COMMUNITY_MODULE_ABIS.governor,
          functionName: "proposalEta",
          args: [BigInt(proposal.id)]
        } as any),
        fallbackClient.readContract({
          address: governorAddress,
          abi: COMMUNITY_MODULE_ABIS.governor,
          functionName: "proposalNeedsQueuing",
          args: [BigInt(proposal.id)]
        } as any)
      ]);

      if (cancelled) return;

      const stateRaw = result[0].status === "fulfilled" ? Number(result[0].value) : undefined;
      const etaRaw = result[1].status === "fulfilled" ? BigInt(result[1].value as bigint) : null;
      const needsQueuingRaw = result[2].status === "fulfilled" ? Boolean(result[2].value) : undefined;

      const queued = needsQueuingRaw === undefined ? indexerReadiness.queued : !needsQueuingRaw;
      const executed = stateRaw === 7 || proposalStatusBadgeLabel(proposal.state) === "Executed";
      const executableNow = queued && !executed;

      setReadiness(
        mergeFallbackReadiness(
          { ...indexerReadiness, staleReason },
          {
            queued,
            executed,
            executableNow,
            eta: etaRaw
          }
        )
      );
    }

    void hydrateFallback();

    return () => {
      cancelled = true;
    };
  }, [governorAddress, health.state, proposal.executedAt, proposal.id, proposal.queuedAt, proposal.state, publicClient]);

  return (
    <div className="card text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">Execution readiness</span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">{readiness.source}</span>
        {readiness.staleReason !== "none" ? (
          <span className="text-xs text-amber-700">Fallback reason: {readiness.staleReason}</span>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1 text-muted-foreground">
        <li>Queued: {readiness.queued ? "Yes" : "No"}</li>
        <li>Executable now: {readiness.executableNow ? "Yes" : "No"}</li>
        <li>Executed: {readiness.executed ? "Yes" : "No"}</li>
        <li>ETA: {readiness.eta === null ? "N/A" : readiness.eta.toString()}</li>
      </ul>
    </div>
  );
}

function VoteForm({
  proposalId,
  communityId,
  multiChoiceOptions,
  proposalState,
  listHref
}: {
  proposalId: string;
  communityId: number;
  multiChoiceOptions: string[];
  proposalState: string;
  listHref: string;
}) {
  const chainId = useChainId();
  const { status } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const { modules } = useCommunityModules({ communityId, chainId, enabled: true });
  const [reason, setReason] = useState("");
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [weightsBps, setWeightsBps] = useState<number[]>(() => {
    const optionsCount = Math.max(multiChoiceOptions.length, 2);
    return Array.from({ length: optionsCount }, (_, idx) => (idx === 0 ? TOTAL_BPS : 0));
  });

  const options = useMemo(() => {
    if (multiChoiceOptions.length) return multiChoiceOptions;
    return ["For", "Against"];
  }, [multiChoiceOptions]);

  useEffect(() => {
    setWeightsBps(Array.from({ length: Math.max(options.length, 2) }, (_, idx) => (idx === 0 ? TOTAL_BPS : 0)));
  }, [options.length]);

  const isConnected = status === "connected";
  const totalBps = sumBps(weightsBps);
  const exactTotal = isExactTotalBps(weightsBps);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUiMessage(null);

    if (!modules?.governor) {
      setUiMessage("Governor module is not registered for this community.");
      return;
    }

    if (!exactTotal) {
      setUiMessage("Allocations must sum to exactly 100.00% (10,000 bps).");
      return;
    }

    try {
      setUiMessage("Vote pending wallet confirmation...");
      const txHash = await writeContractAsync({
        address: modules.governor,
        abi: COMMUNITY_MODULE_ABIS.governor,
        functionName: "castVoteMultiChoice",
        args: [BigInt(proposalId), toContractWeightsBps(weightsBps), reason]
      });

      setUiMessage(`Vote submitted: ${txHash}`);
      setReason("");
    } catch (err) {
      setUiMessage(formatVoteError(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Cast Vote</h3>
          <p className="text-sm text-muted-foreground">Weighted allocations must sum to exactly 100.00%.</p>
        </div>
        <span className="text-xs text-muted-foreground">State: {proposalState}</span>
      </div>

      <div className="mt-4 space-y-3">
        {options.map((option, idx) => (
          <label key={`${option}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
            <span>{option}</span>
            <div className="flex items-center gap-2">
              <input
                aria-label={`Allocation ${option}`}
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={(weightsBps[idx] / 100).toFixed(2)}
                onChange={(event) => {
                  const next = [...weightsBps];
                  next[idx] = percentToBps(event.target.value);
                  setWeightsBps(next);
                }}
                className="w-24 rounded border border-border bg-background px-2 py-1 text-right"
              />
              <span className="text-xs text-muted-foreground">{bpsToPercentLabel(weightsBps[idx])}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">Total: {bpsToPercentLabel(totalBps)} ({totalBps} bps)</div>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Reason (optional)</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-[80px] rounded border border-border bg-background px-3 py-2"
          placeholder="Why are you voting this way?"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!isConnected || isPending || !exactTotal} className="btn-primary">
          {isPending ? "Submitting..." : "Submit vote"}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to vote.</span> : null}
        {!exactTotal ? <span className="text-xs text-destructive">Total must be exactly 10,000 bps.</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {uiMessage ? <span className="text-xs text-muted-foreground">{uiMessage}</span> : null}
        <a className="text-xs underline" href={listHref}>
          Back to proposals
        </a>
      </div>
    </form>
  );
}

function MetadataItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <dt className="font-medium text-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatVoteOption(optionIndex?: number | null) {
  if (optionIndex === null || optionIndex === undefined) {
    return "N/A";
  }
  if (optionIndex === 0) return "Against";
  if (optionIndex === 1) return "For";
  if (optionIndex === 2) return "Abstain";
  return `Option ${optionIndex}`;
}

function formatVoteError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("rejected")) {
    return "Signature rejected.";
  }

  if (lower.includes("chain") || lower.includes("network")) {
    return "Wrong network selected for this community.";
  }

  return message.replace(/execution reverted: ?/i, "");
}

function isIpfsDocumentResponse(value: unknown): value is {
  cid: string;
  html: { body: string } | null;
  data: unknown;
  type: string;
  version: string;
  retrievedAt: string;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    cid?: unknown;
    html?: unknown;
    data?: unknown;
    type?: unknown;
    version?: unknown;
    retrievedAt?: unknown;
  };
  return Boolean(candidate.cid && "html" in candidate && "data" in candidate && candidate.type && candidate.version && candidate.retrievedAt);
}
