"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

import { COMMUNITY_MODULE_ABIS, useCommunityModules } from "../../hooks/useCommunityModules";
import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIndexerHealth } from "../../hooks/useIndexerHealth";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import { formatDistanceToNowSafe } from "../../lib/date";
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
import { getI18n } from "../../lib/i18n";

export type ProposalDetailProps = {
  proposalId: string;
  expectedCommunityId?: number;
};

export function ProposalDetail({ proposalId, expectedCommunityId }: ProposalDetailProps) {
  const t = getI18n().governance;
  const normalizedProposalId = useMemo(() => normalizeRouteParam(proposalId), [proposalId]);
  const proposalNumericId = useMemo(() => extractOnchainProposalId(normalizedProposalId), [normalizedProposalId]);

  const { data, isLoading, isError, error, refetch } = useGraphQLQuery<
    ProposalQueryResult,
    { id: string; proposalNumericId: string }
  >(
    ["proposal", normalizedProposalId, proposalNumericId],
    ProposalQuery,
    { id: normalizedProposalId, proposalNumericId }
  );
  const queryErrorLoggedRef = useRef(false);
  const missingProposalLoggedRef = useRef(false);

  const proposal = data?.proposal ?? null;
  const cid = proposal?.descriptionCid ?? undefined;
  const { data: ipfsData, isLoading: isIpfsLoading, isError: isIpfsError } = useIpfsDocument(cid, Boolean(cid));
  const ipfsDoc = useMemo(() => (isIpfsDocumentResponse(ipfsData) ? ipfsData : null), [ipfsData]);
  const votes = useMemo(
    () => data?.proposalVotes?.nodes ?? proposal?.votes ?? [],
    [data?.proposalVotes?.nodes, proposal?.votes]
  );
  const onchainProposalId = useMemo(() => {
    if (!proposal) return null;
    return parseOnchainProposalId(proposal.proposalId ?? proposal.id);
  }, [proposal]);
  const actionPayload = useMemo(() => buildActionPayload(proposal, ipfsDoc?.data), [ipfsDoc?.data, proposal]);

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

  useEffect(() => {
    queryErrorLoggedRef.current = false;
    missingProposalLoggedRef.current = false;
  }, [proposalId]);

  useEffect(() => {
    if (!isError || queryErrorLoggedRef.current) return;
    console.error("[ProposalDetail] Failed to load proposal query", {
      proposalId: normalizedProposalId,
      expectedCommunityId,
      error
    });
    queryErrorLoggedRef.current = true;
  }, [error, expectedCommunityId, isError, normalizedProposalId]);

  useEffect(() => {
    if (isLoading || isError || proposal || missingProposalLoggedRef.current) return;
    console.error("[ProposalDetail] Proposal payload is null", {
      proposalId: normalizedProposalId,
      expectedCommunityId,
      data
    });
    missingProposalLoggedRef.current = true;
  }, [data, expectedCommunityId, isError, isLoading, normalizedProposalId, proposal]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t.loadingProposal}</p>;
  }

  if (isError || !proposal) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{t.loadProposalError}</p>
        <button className="text-xs underline" onClick={() => void refetch()}>
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {mismatch ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t.proposalMismatch
            .replace("{actual}", String(proposal.communityId))
            .replace("{expected}", String(expectedCommunityId))}{" "}
          {correctedHref ? (
            <a className="underline" href={correctedHref}>
              {t.openCorrectRoute}
            </a>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="card-tight space-y-3 border-primary/15">
          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-foreground ring-1 ring-border">
              {statusLabel}
            </span>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">#{proposal.communityId}</span>
              <span className="mx-2 text-border">·</span>
              {formatDistanceToNowSafe(proposal.createdAt)}
            </p>
          </div>
          <details className="rounded-xl border border-border bg-background/60 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-primary transition-colors hover:text-primaryDark">
              {t.participantInfoSummary}
            </summary>
            <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <MetadataItem label={t.communityLabel} value={String(proposal.communityId)} />
              <MetadataItem label={t.proposerLabel} value={proposal.proposer} />
              <MetadataItem label={t.stateLabel} value={statusLabel} />
              <MetadataItem label={t.createdLabel} value={formatDistanceToNowSafe(proposal.createdAt)} />
            </dl>
          </details>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-primary">{t.description}</h2>
        {isIpfsLoading ? (
          <p className="text-sm text-muted-foreground">{t.descriptionLoading}</p>
        ) : isIpfsError ? (
          <p className="text-sm text-destructive">{t.descriptionError}</p>
        ) : ipfsDoc?.html?.body ? (
          <article
            className="card-tight prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: ipfsDoc.html.body }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t.descriptionEmpty}</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-primary">{t.castVoteTitle}</h2>
        <VoteForm
          onchainProposalId={onchainProposalId}
          communityId={Number(proposal.communityId)}
          multiChoiceOptions={proposal.multiChoiceOptions ?? []}
          proposalState={statusLabel}
          listHref={fallbackListHref}
          onVoteConfirmed={() => {
            void refetch();
          }}
        />
      </section>

      <section className="space-y-3">
        <ReadinessPanel proposal={proposal} />
      </section>

      <section className="space-y-3">
        {actionPayload.length ? (
          <details className="card-tight rounded-2xl border border-primary/15 p-4 open:bg-background/80">
            <summary className="cursor-pointer text-xl font-semibold text-primary transition-colors hover:text-primaryDark">
              {t.onChainActionsSummaryLine.replace("{count}", String(actionPayload.length))}
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">
              {t.onChainActionsBlurb.replace("{count}", String(actionPayload.length))}
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background/50">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2">#</th>
                    <th>Target</th>
                    <th>Value</th>
                    <th>Function</th>
                    <th>Calldata</th>
                  </tr>
                </thead>
                <tbody>
                  {actionPayload.map((action, index) => (
                    <tr key={`${action.target}-${index}`} className="border-t border-border align-top">
                      <td className="py-2 text-muted-foreground">{index + 1}</td>
                      <td className="py-2 font-mono text-xs text-foreground">{action.target}</td>
                      <td className="py-2 text-muted-foreground">{action.value}</td>
                      <td className="py-2 text-muted-foreground">{action.functionSignature ?? "N/A"}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground break-all">{action.calldata}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : (
          <p className="text-sm text-muted-foreground">{t.onChainActionsEmpty}</p>
        )}
      </section>

      <section className="space-y-3">
        {votes.length ? (
          <details className="card-tight rounded-2xl border border-primary/15 p-4">
            <summary className="cursor-pointer text-xl font-semibold text-primary transition-colors hover:text-primaryDark">
              {t.votesWithCount.replace("{count}", String(votes.length))}
            </summary>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Voter</th>
                  <th>Weight</th>
                  <th>Option</th>
                  <th>Cast</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((vote, index) => (
                  <tr key={`${vote.voter}-${index}`} className="border-t border-border">
                    <td className="py-2 align-top font-medium">{vote.voter}</td>
                    <td className="py-2 align-top text-muted-foreground">{vote.weight}</td>
                    <td className="py-2 align-top text-muted-foreground">{formatVoteOption(vote.optionIndex)}</td>
                    <td className="py-2 align-top text-muted-foreground">{formatDistanceToNowSafe(vote.castAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : (
          <p className="text-sm text-muted-foreground">{t.votesEmpty}</p>
        )}
      </section>
    </div>
  );
}

function ReadinessPanel({ proposal }: { proposal: NonNullable<ProposalQueryResult["proposal"]> }) {
  const t = getI18n().governance;
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { modules } = useCommunityModules({ communityId: Number(proposal.communityId), chainId, enabled: true });
  const health = useIndexerHealth(new Date().toISOString());
  const governorAddress = modules?.governor;
  const onchainProposalId = useMemo(
    () => parseOnchainProposalId(proposal.proposalId ?? proposal.id),
    [proposal.id, proposal.proposalId]
  );

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

    if (staleReason === "none" || !publicClient || !governorAddress || onchainProposalId === null) {
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
          args: [onchainProposalId]
        } as any),
        fallbackClient.readContract({
          address: governorAddress,
          abi: COMMUNITY_MODULE_ABIS.governor,
          functionName: "proposalEta",
          args: [onchainProposalId]
        } as any),
        fallbackClient.readContract({
          address: governorAddress,
          abi: COMMUNITY_MODULE_ABIS.governor,
          functionName: "proposalNeedsQueuing",
          args: [onchainProposalId]
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
  }, [
    governorAddress,
    health.state,
    onchainProposalId,
    proposal.executedAt,
    proposal.id,
    proposal.proposalId,
    proposal.queuedAt,
    proposal.state,
    publicClient
  ]);

  return (
    <div className="card text-sm space-y-3">
      <div>
        <span className="font-medium">{t.executionReadiness}</span>
        <p className="mt-2 text-muted-foreground">{readinessHumanLine(readiness, t)}</p>
      </div>
      <details className="rounded-xl border border-border bg-background/70 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-primary transition-colors hover:text-primaryDark">
          {t.readinessTechnical}
        </summary>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase tracking-wide">{readiness.source}</span>
          {readiness.staleReason !== "none" ? (
            <span className="text-xs text-amber-700">
              {t.readinessFallback}: {readiness.staleReason}
            </span>
          ) : null}
        </div>
        <ul className="mt-3 space-y-1 text-muted-foreground">
          <li>
            {t.readinessQueued}: {readiness.queued ? t.readinessYes : t.readinessNo}
          </li>
          <li>
            {t.readinessExecutable}: {readiness.executableNow ? t.readinessYes : t.readinessNo}
          </li>
          <li>
            {t.readinessExecuted}: {readiness.executed ? t.readinessYes : t.readinessNo}
          </li>
          <li>
            {t.readinessEta}: {readiness.eta === null ? "N/A" : readiness.eta.toString()}
          </li>
        </ul>
      </details>
    </div>
  );
}

function readinessHumanLine(
  readiness: ProposalReadiness,
  t: ReturnType<typeof getI18n>["governance"]
): string {
  if (readiness.executed) return t.readinessHumanExecuted;
  if (readiness.executableNow) return t.readinessHumanExecutable;
  if (readiness.queued) return t.readinessHumanQueued;
  return t.readinessHumanPending;
}

function VoteForm({
  onchainProposalId,
  communityId,
  multiChoiceOptions,
  proposalState,
  listHref,
  onVoteConfirmed
}: {
  onchainProposalId: bigint | null;
  communityId: number;
  multiChoiceOptions: string[];
  proposalState: string;
  listHref: string;
  onVoteConfirmed: () => void;
}) {
  const t = getI18n().governance;
  const chainId = useChainId();
  const { status, address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const { modules } = useCommunityModules({ communityId, chainId, enabled: true });
  const [reason, setReason] = useState("");
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [isMultiChoiceEnabled, setIsMultiChoiceEnabled] = useState<boolean | null>(
    multiChoiceOptions.length ? true : null
  );
  const [isProposalActiveOnChain, setIsProposalActiveOnChain] = useState<boolean | null>(
    proposalState.toLowerCase() === "active"
  );
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

  useEffect(() => {
    let cancelled = false;

    if (!publicClient || !modules?.governor || onchainProposalId === null) {
      setIsMultiChoiceEnabled(multiChoiceOptions.length ? true : null);
      return;
    }

    (async () => {
      try {
        const raw = await publicClient.readContract({
          address: modules.governor,
          abi: COMMUNITY_MODULE_ABIS.governor,
          functionName: "isMultiChoice",
          args: [onchainProposalId]
        } as any);

        if (cancelled) return;
        setIsMultiChoiceEnabled(raw === true || raw === 1n);
      } catch {
        if (cancelled) return;
        setIsMultiChoiceEnabled(multiChoiceOptions.length ? true : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modules?.governor, multiChoiceOptions.length, onchainProposalId, publicClient]);

  useEffect(() => {
    let cancelled = false;

    if (!publicClient || !modules?.governor || onchainProposalId === null) {
      setIsProposalActiveOnChain(proposalState.toLowerCase() === "active");
      return;
    }

    (async () => {
      try {
        const state = await publicClient.readContract({
          address: modules.governor,
          abi: COMMUNITY_MODULE_ABIS.governor,
          functionName: "state",
          args: [onchainProposalId]
        } as any);

        if (cancelled) return;
        setIsProposalActiveOnChain(state === 1n || state === 1);
      } catch {
        if (cancelled) return;
        setIsProposalActiveOnChain(proposalState.toLowerCase() === "active");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modules?.governor, onchainProposalId, proposalState, publicClient]);

  const isConnected = status === "connected";
  const totalBps = sumBps(weightsBps);
  const exactTotal = isExactTotalBps(weightsBps);
  const voteMode = isMultiChoiceEnabled ?? (multiChoiceOptions.length > 0);
  const canVoteNow = isProposalActiveOnChain ?? (proposalState.toLowerCase() === "active");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUiMessage(null);

    if (!modules?.governor) {
      setUiMessage(t.governorNotRegistered);
      return;
    }

    if (!exactTotal) {
      setUiMessage(`${t.totalMustExactPercent} ${t.totalMustBpsDetail}`);
      return;
    }

    if (onchainProposalId === null) {
      setUiMessage(t.invalidProposalId);
      return;
    }

    try {
      let txHash: `0x${string}`;

      if (voteMode) {
        const contractWeights = toContractWeightsBps(weightsBps);
        const gas = await resolveVoteGasLimit({
          publicClient,
          account: address,
          governor: modules.governor,
          functionName: "castVoteMultiChoice",
          args: [onchainProposalId, contractWeights, reason]
        });

        setUiMessage(t.votePendingWallet);
        txHash = await writeContractAsync({
          address: modules.governor,
          abi: COMMUNITY_MODULE_ABIS.governor,
          functionName: "castVoteMultiChoice",
          args: [onchainProposalId, contractWeights, reason],
          ...(gas ? { gas } : {})
        });
      } else {
        const support = deriveBinarySupport(weightsBps);
        const gas = await resolveVoteGasLimit({
          publicClient,
          account: address,
          governor: modules.governor,
          functionName: "castVoteWithReason",
          args: [onchainProposalId, support, reason]
        });

        setUiMessage(t.votePendingWallet);
        txHash = await writeContractAsync({
          address: modules.governor,
          abi: COMMUNITY_MODULE_ABIS.governor,
          functionName: "castVoteWithReason",
          args: [onchainProposalId, support, reason],
          ...(gas ? { gas } : {})
        });
      }

      setUiMessage(t.voteWaitingConfirm.replace("{hash}", txHash));

      if (!publicClient) {
        setUiMessage(t.voteSubmittedNoConfirm.replace("{hash}", txHash));
        return;
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === "success") {
        onVoteConfirmed();
        setUiMessage(t.voteConfirmed.replace("{hash}", txHash));
      } else {
        setUiMessage(t.voteReverted.replace("{hash}", txHash));
      }
      setReason("");
    } catch (err) {
      setUiMessage(formatVoteError(err, t));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-tight border-primary/10">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t.castVoteHint}</p>
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

      <div className="mt-3">
        <p className="text-xs text-muted-foreground">{t.totalPercent.replace("{percent}", bpsToPercentLabel(totalBps))}</p>
        <details className="mt-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">{t.voteTechnicalDetails}</summary>
          <div className="mt-2 space-y-2">
            <p>{t.castVoteState.replace("{state}", proposalState)}</p>
            <p className="text-[11px] text-muted-foreground">Total: {totalBps} bps</p>
          </div>
        </details>
      </div>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t.reasonLabel}</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-[80px] rounded border border-border bg-background px-3 py-2"
          placeholder={t.reasonPlaceholder}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!isConnected || isPending || !exactTotal || !canVoteNow} className="btn-primary">
          {isPending ? t.submitting : t.submitVote}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">{t.connectWallet}</span> : null}
        {!exactTotal ? (
          <span className="text-xs text-destructive">
            {t.totalMustExactPercent} {t.totalMustBpsDetail}
          </span>
        ) : null}
        {!canVoteNow ? <span className="text-xs text-destructive">{t.votingNotOpen}</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {uiMessage ? <span className="text-xs text-muted-foreground">{uiMessage}</span> : null}
        <a className="text-xs underline" href={listHref}>
          {t.backToProposals}
        </a>
      </div>
    </form>
  );
}

const VOTE_GAS_FALLBACK = 900_000n;
const VOTE_GAS_CAP = 3_000_000n;

async function resolveVoteGasLimit({
  publicClient,
  account,
  governor,
  functionName,
  args
}: {
  publicClient: ReturnType<typeof usePublicClient>;
  account?: `0x${string}`;
  governor: `0x${string}`;
  functionName: "castVoteMultiChoice" | "castVoteWithReason";
  args: readonly unknown[];
}) {
  if (!publicClient || !account) {
    return undefined;
  }

  try {
    const estimate = await publicClient.estimateContractGas({
      account,
      address: governor,
      abi: COMMUNITY_MODULE_ABIS.governor,
      functionName,
      args
    } as any);

    const padded = (estimate * 12n) / 10n;
    return padded > VOTE_GAS_CAP ? VOTE_GAS_CAP : padded;
  } catch {
    return VOTE_GAS_FALLBACK;
  }
}

function deriveBinarySupport(weightsBps: number[]) {
  const forVotes = weightsBps[0] ?? 0;
  const againstVotes = weightsBps[1] ?? 0;
  return againstVotes > forVotes ? 0 : 1;
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

function formatVoteError(err: unknown, t: ReturnType<typeof getI18n>["governance"]) {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("governoralreadycastvote") || lower.includes("already cast vote")) {
    return t.voteAlreadyCast;
  }

  if (lower.includes("governorunexpectedproposalstate") || lower.includes("unexpected proposal state")) {
    return t.voteUnexpectedState;
  }

  if (lower.includes("user rejected") || lower.includes("rejected")) {
    return t.signatureRejected;
  }

  if (lower.includes("chain") || lower.includes("network")) {
    return t.wrongNetwork;
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

function normalizeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractOnchainProposalId(value: string) {
  return value.includes(":") ? (value.split(":").pop() ?? value) : value;
}

function parseOnchainProposalId(value: string) {
  try {
    return BigInt(extractOnchainProposalId(normalizeRouteParam(value)));
  } catch {
    return null;
  }
}

type ActionPayloadRow = {
  target: string;
  value: string;
  calldata: string;
  functionSignature?: string;
};

function buildActionPayload(
  proposal: ProposalQueryResult["proposal"],
  ipfsData: unknown
): ActionPayloadRow[] {
  if (!proposal) return [];

  const targets = proposal.targets ?? [];
  const values = proposal.values ?? [];
  const calldatas = proposal.calldatas ?? [];

  const actionsFromIpfs = extractGovernanceActions(ipfsData);

  return targets.map((target, index) => {
    const ipfsAction = actionsFromIpfs[index];
    return {
      target,
      value: values[index] ?? "0",
      calldata: calldatas[index] ?? "0x",
      functionSignature:
        typeof ipfsAction?.functionSignature === "string"
          ? ipfsAction.functionSignature
          : undefined
    };
  });
}

function extractGovernanceActions(value: unknown): Array<{ functionSignature?: string }> {
  if (!value || typeof value !== "object") return [];
  const candidate = value as { type?: unknown; actions?: unknown };
  if (candidate.type !== "governanceProposal") return [];
  if (!Array.isArray(candidate.actions)) return [];
  return candidate.actions
    .filter((item): item is { functionSignature?: unknown } => Boolean(item && typeof item === "object"))
    .map((item) => ({
      functionSignature:
        typeof item.functionSignature === "string" && item.functionSignature.length
          ? item.functionSignature
          : undefined
    }));
}
