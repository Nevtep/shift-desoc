"use client";

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";

import { useGraphQLQuery } from "../../hooks/useGraphQLQuery";
import { useIpfsDocument } from "../../hooks/useIpfsDocument";
import {
  ProposalQuery,
  type ProposalQueryResult
} from "../../lib/graphql/queries";

export type ProposalDetailProps = {
  proposalId: string;
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

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading proposal…</p>;
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
            <MetadataItem label="Community" value={proposal.communityId} />
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
        <h2 className="text-lg font-medium">Description</h2>
        {isIpfsLoading ? (
          <p className="text-sm text-muted-foreground">Loading description…</p>
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
