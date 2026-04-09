import type { IndexerHealthState } from "../community-overview/types";

export type ProposalReadinessSource = "indexer" | "chain-fallback";

export type ProposalReadiness = {
  source: ProposalReadinessSource;
  queued: boolean;
  executableNow: boolean;
  executed: boolean;
  eta: bigint | null;
  staleReason: "none" | "indexer-lag" | "missing-readiness-fields";
};

export function needsReadinessFallback(input: {
  state: string;
  queuedAt?: string | null;
  executedAt?: string | null;
  indexerHealth: IndexerHealthState;
}): ProposalReadiness["staleReason"] {
  if (input.indexerHealth === "lagging" || input.indexerHealth === "error") {
    return "indexer-lag";
  }

  if (input.state === "Queued" && !input.queuedAt) {
    return "missing-readiness-fields";
  }

  if (input.state === "Executed" && !input.executedAt) {
    return "missing-readiness-fields";
  }

  return "none";
}

export function deriveReadinessFromIndexer(input: {
  state: string;
  queuedAt?: string | null;
  executedAt?: string | null;
}): ProposalReadiness {
  const queued = input.state === "Queued" || Boolean(input.queuedAt);
  const executed = input.state === "Executed" || Boolean(input.executedAt);
  const executableNow = queued && !executed;

  return {
    source: "indexer",
    queued,
    executableNow,
    executed,
    eta: null,
    staleReason: "none"
  };
}

export function mergeFallbackReadiness(base: ProposalReadiness, fallback: Partial<Omit<ProposalReadiness, "source">>): ProposalReadiness {
  return {
    source: "chain-fallback",
    queued: fallback.queued ?? base.queued,
    executableNow: fallback.executableNow ?? base.executableNow,
    executed: fallback.executed ?? base.executed,
    eta: fallback.eta ?? base.eta,
    staleReason: base.staleReason === "none" ? "missing-readiness-fields" : base.staleReason
  };
}
