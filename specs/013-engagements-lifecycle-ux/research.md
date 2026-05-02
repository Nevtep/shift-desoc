# Phase 0 Research: Engagements Rich Lifecycle UX

## Decision 1: Exact on-chain submit path and transaction count

- Decision: Use deployed Engagements write surface only: submit(typeId, evidenceCID), executed against the selected community engagements module address.
- Rationale: This is the existing canonical create path and satisfies the requirement for a real transaction-capable flow.
- Alternatives considered:
  - Local placeholder persistence before tx: Rejected due to shadow authority and false-created risk.
  - Multi-tx protocol redesign (pre-reserve then finalize): Rejected as out of scope and unsupported by deployed contracts.

## Decision 2: Submission step model (one tx plus preflight)

- Decision: Define submit as a two-step user flow with exactly one on-chain write:
  1. Build and upload structured evidence payload (off-chain preparation).
  2. Submit one on-chain transaction to Engagements.submit.
- Rationale: Evidence preparation is required for meaningful payloads but does not create protocol state. Engagement creation occurs only in tx step.
- Alternatives considered:
  - Treat upload as protocol step: Rejected because upload does not mutate chain state.
  - Skip structured evidence preparation: Rejected because it violates Valuable Action evidence-spec semantics.

## Decision 3: Canonical engagement identity recovery

- Decision: Recover engagementId by decoding EngagementSubmitted from the confirmed transaction receipt logs.
- Rationale: Event emission is canonical and deterministic for the successful submit transaction.
- Alternatives considered:
  - Infer ID from local counters or optimistic increments: Rejected due to race conditions and non-canonical behavior.
  - Wait only for indexer visibility: Rejected because deterministic post-submit routing is required before projection catches up.

## Decision 4: Post-submit truth model

- Decision: Separate immediate chain truth from delayed projection truth:
  - Chain truth: tx hash, block number, engagementId, submitted event payload.
  - Projection truth: list/detail enrichment, juror assignment visibility, later lifecycle updates.
- Rationale: Keeps UX truthful under indexer lag and avoids fabricated readiness claims.
- Alternatives considered:
  - Treat indexer as immediate authority for all fields: Rejected because projection is eventually consistent and non-authoritative.
  - Hide successful submit until indexer catches up: Rejected because user needs immediate deterministic confirmation.

## Decision 5: Community boundary enforcement

- Decision: Enforce community scope at every layer:
  - Create: selected community determines module address and eligible active Valuable Actions.
  - List: queries scoped by community only.
  - Detail: route community and engagement community must match, otherwise block/redirect.
- Rationale: Prevents cross-community data leakage and cross-scope writes.
- Alternatives considered:
  - UI-only filtering: Rejected as insufficient defense.
  - Soft warning on mismatches: Rejected because mutation and detail access must fail closed.

## Decision 6: Failure-mode normalization

- Decision: Map wallet, chain, and known contract-revert paths to deterministic user-facing states without creating engagement records on failure.
- Rationale: Complete functional slice requires explicit and truthful failure handling.
- Alternatives considered:
  - Generic failure toast only: Rejected as non-actionable and ambiguous.
  - Auto-retry failed writes in background: Rejected due to accidental duplicate transaction risk.

## Decision 7: Compatibility and migration posture

- Decision: No-ABI/event-change first. Use existing EngagementSubmitted, JurorsAssigned, EngagementResolved, and EngagementRevoked events.
- Rationale: Existing deployed protocol supports first complete slice without redesign.
- Alternatives considered:
  - Immediate event redesign for richer post-submit metadata: Rejected until a hard blocker is proven.

## Final Clarification Resolution

All planning clarifications are resolved:

1. Exact submit path: resolved to Engagements.submit(typeId, evidenceCID).
2. Transaction count: resolved to one on-chain tx per create submit.
3. Identity recovery: resolved to receipt-log decode of EngagementSubmitted.
4. Truth model: resolved to chain-first confirmation with projection readiness overlay.
5. Compatibility: resolved to no-ABI/event-change default.

No unresolved clarification remains for Phase 1 design.
