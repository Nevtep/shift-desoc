"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { keccak256, toBytes } from "viem";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import {
  ProposalQuery,
  type ProposalQueryResult
} from "../../lib/graphql/queries";
import { getContractConfig } from "../../lib/contracts";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { useRouter } from "next/navigation";

export type ProposalDetailProps = {
  proposalId: string;
};

type ProposalActions = {
  targets: `0x${string}`[];
  values: bigint[];
  calldatas: `0x${string}`[];
  descriptionHash: `0x${string}`;
};

export function ProposalDetail({ proposalId }: ProposalDetailProps) {
  const { data, isLoading, isError, refetch } = useGraphQLQuery<ProposalQueryResult, { id: string }>(
    ["proposal", proposalId],
    ProposalQuery,
    { id: proposalId }
  );

  const proposal = data?.proposal ?? null;
  const cid = proposal?.descriptionCid ?? undefined;
  const {
    data: ipfsData,
    isLoading: isIpfsLoading,
    isError: isIpfsError
  } = useIpfsDocument(cid, Boolean(cid));

  const votes = useMemo(() => proposal?.votes ?? [], [proposal]);
  const actionBundle = useMemo<ProposalActions | null>(() => {
    if (!proposal) return null;
    if (!proposal.targets || !proposal.values || !proposal.calldatas) return null;
    if (proposal.targets.length === 0) return null;

    const parsedTargets = proposal.targets as `0x${string}`[];
    const parsedValues = proposal.values.map((val) => BigInt(val));
    const parsedCalldatas = (proposal.calldatas as string[]).map((data) =>
      data.startsWith("0x") ? (data as `0x${string}`) : (`0x${data}` as `0x${string}`)
    );

    const computedHash = proposal.descriptionHash
      ? (proposal.descriptionHash as `0x${string}`)
      : proposal.descriptionCid
        ? (keccak256(toBytes(proposal.descriptionCid)) as `0x${string}`)
        : null;

    if (!computedHash) return null;

    return {
      targets: parsedTargets,
      values: parsedValues,
      calldatas: parsedCalldatas,
      descriptionHash: computedHash
    } satisfies ProposalActions;
  }, [proposal]);

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
      <section className="space-y-3">
        <div className="rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-lg font-medium">Metadata</h2>
          <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <MetadataItem label="Community" value={String(proposal.communityId)} />
            <MetadataItem label="Proposer" value={proposal.proposer} />
            <MetadataItem label="State" value={proposal.state} />
            <MetadataItem
              label="Created"
              value={formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}
            />
          </dl>
        </div>
      </section>

      <section className="space-y-3">
        <VoteForm
          proposalId={proposal.id}
          multiChoiceOptions={proposal.multiChoiceOptions ?? []}
          actionBundle={actionBundle}
          proposalState={proposal.state}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Description</h2>
        {isIpfsLoading ? (
          <p className="text-sm text-muted-foreground">Loading description...</p>
        ) : isIpfsError ? (
          <p className="text-sm text-destructive">Failed to load IPFS description.</p>
        ) : ipfsData?.html?.body ? (
          <article
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: ipfsData.html.body }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No description available.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Votes</h2>
        {votes.length ? (
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
              {votes.map((vote) => (
                <tr key={`${vote.voter}-${vote.optionIndex ?? 0}`} className="border-t border-border">
                  <td className="py-2 align-top font-medium">{vote.voter}</td>
                  <td className="py-2 align-top text-muted-foreground">{vote.weight}</td>
                  <td className="py-2 align-top text-muted-foreground">{formatVoteOption(vote.optionIndex)}</td>
                  <td className="py-2 align-top text-muted-foreground">
                    {formatDistanceToNow(new Date(vote.castAt), { addSuffix: true })}
                  </td>
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

function VoteForm({
  proposalId,
  multiChoiceOptions,
  actionBundle,
  proposalState
}: {
  proposalId: string;
  multiChoiceOptions: string[];
  actionBundle: ProposalActions | null;
  proposalState: string;
}) {
  const router = useRouter();
  const chainId = useChainId();
  const { status } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const [support, setSupport] = useState<"0" | "1" | "2">("1");
  const [selectedOption, setSelectedOption] = useState(0);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isQueueing, setIsQueueing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const isMultiChoice = multiChoiceOptions.length > 0;
  const isConnected = status === "connected";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    try {
      const { address, abi } = getContractConfig("governor", chainId);

      if (isMultiChoice) {
        const weights = multiChoiceOptions.map((_, idx) => (idx === selectedOption ? 1_000_000_000_000_000_000n : 0n));
        await writeContractAsync({
          address,
          abi,
          functionName: "castVoteMultiChoice",
          args: [BigInt(proposalId), weights, reason]
        });
      } else {
        await writeContractAsync({
          address,
          abi,
          functionName: "castVoteWithReason",
          args: [BigInt(proposalId), Number(support), reason]
        });
      }

      setSuccess("Vote submitted. It will appear once the indexer updates.");
      setReason("");
      router.refresh();
    } catch (err) {
      console.error(err);
      setActionError(formatTxError(err));
    }
  }

  async function handleQueue() {
    if (!actionBundle) {
      setActionError("Proposal actions not indexed yet.");
      return;
    }
    setIsQueueing(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const { address, abi } = getContractConfig("governor", chainId);
      await writeContractAsync({
        address,
        abi,
        functionName: "queue",
        args: [actionBundle.targets, actionBundle.values, actionBundle.calldatas, actionBundle.descriptionHash]
      });
      setActionMessage("Queued in timelock. Execution unlocks after the delay.");
      router.refresh();
    } catch (err) {
      console.error(err);
      setActionError(formatTxError(err));
    } finally {
      setIsQueueing(false);
    }
  }

  async function handleExecute() {
    if (!actionBundle) {
      setActionError("Proposal actions not indexed yet.");
      return;
    }
    setIsExecuting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const { address, abi } = getContractConfig("governor", chainId);
      await writeContractAsync({
        address,
        abi,
        functionName: "execute",
        args: [actionBundle.targets, actionBundle.values, actionBundle.calldatas, actionBundle.descriptionHash],
        value: 0n
      });
      setActionMessage("Execution sent. Timelock will release once ready.");
      router.refresh();
    } catch (err) {
      console.error(err);
      setActionError(formatTxError(err));
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Cast Vote</h3>
          <p className="text-sm text-muted-foreground">
            Votes are sent directly to the Governor contract on the active network.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Proposal {proposalId}</span>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        {isMultiChoice ? (
          <div className="space-y-2">
            <p className="text-muted-foreground">Select one option to allocate full weight.</p>
            <div className="flex flex-wrap gap-2">
              {multiChoiceOptions.map((option, idx) => (
                <button
                  key={option + idx}
                  type="button"
                  onClick={() => setSelectedOption(idx)}
                  className={`rounded border px-3 py-2 ${
                    selectedOption === idx ? "border-primary" : "border-border"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="support"
                value="1"
                checked={support === "1"}
                onChange={() => setSupport("1")}
              />
              <span>For</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="support"
                value="0"
                checked={support === "0"}
                onChange={() => setSupport("0")}
              />
              <span>Against</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="support"
                value="2"
                checked={support === "2"}
                onChange={() => setSupport("2")}
              />
              <span>Abstain</span>
            </label>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Reason (optional)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[80px] rounded border border-border bg-background px-3 py-2"
            placeholder="Why are you voting this way?"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!isConnected || isPending}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Submitting..." : "Submit vote"}
        </button>
        {!isConnected ? <span className="text-xs text-destructive">Connect a wallet to vote.</span> : null}
        {error ? <span className="text-xs text-destructive">{error.message ?? "Transaction failed"}</span> : null}
        {success ? <span className="text-xs text-emerald-600">{success}</span> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          disabled={!isConnected || isQueueing || !actionBundle}
          onClick={() => void handleQueue()}
          className="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isQueueing ? "Queueing..." : "Queue in timelock"}
        </button>
        <button
          type="button"
          disabled={!isConnected || isExecuting || !actionBundle}
          onClick={() => void handleExecute()}
          className="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {isExecuting ? "Executing..." : "Execute"}
        </button>
        {!actionBundle ? (
          <span className="text-xs text-muted-foreground">Waiting for action bundle indexing.</span>
        ) : null}
        {proposalState === "Queued" ? (
          <span className="text-xs text-muted-foreground">Proposal queued; execute after timelock delay.</span>
        ) : null}
        {actionMessage ? <span className="text-xs text-emerald-600">{actionMessage}</span> : null}
        {actionError ? <span className="text-xs text-destructive">{actionError}</span> : null}
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

function formatTxError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("not selected") || lower.includes("not a juror") || lower.includes("notauthorized")) {
    return "You are not authorized to perform this action.";
  }
  if (lower.includes("voting is closed") || lower.includes("vote not currently active")) {
    return "Voting window is closed for this proposal.";
  }
  if (lower.includes("has no voting units") || lower.includes("voting power")) {
    return "You have no voting power for this proposal.";
  }
  if (lower.includes("proposal not successful") || lower.includes("succeeded")) {
    return "Proposal must be succeeded before queueing or executing.";
  }
  if (lower.includes("locked") || lower.includes("timelock")) {
    return "Timelock delay has not elapsed yet.";
  }

  return message.replace(/execution reverted: ?/i, "");
}
