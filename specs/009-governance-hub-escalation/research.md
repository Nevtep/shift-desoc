# Phase 0 Research: Governance Hub (Community-scoped) + Draft to Proposal Escalation

## Input Artifacts

- [spec.md](./spec.md)
- [requirements.md](./requirements.md)
- [.specify/memory/constitution.md](../../.specify/memory/constitution.md)
- Existing web sources under `apps/web`

## Decision 1: Route architecture is community-first App Router pages

- Decision: Implement three new community-scoped pages under `app/communities/[communityId]/governance/**` and keep existing global governance pages untouched but no longer used for community entry paths.
- Rationale: Meets FR-001 and prevents route/query drift caused by global `?communityId=` filtering.
- Alternatives considered:
  - Reuse global pages with query-param filtering: rejected due to mismatch risks and weaker route guarantees.
  - Redirect global pages to scoped pages immediately: deferred to avoid unrelated routing behavior changes.

## Decision 2: GraphQL-first proposal data with explicit community scoping

- Decision: Query proposals using `communityId` filter from indexer GraphQL and fetch proposal detail by `proposalId` plus runtime community mismatch guard.
- Rationale: Aligns with canonical projection flow and existing `useGraphQLQuery` patterns in `apps/web`.
- Alternatives considered:
  - Chain-only reads for list/detail: rejected (higher RPC load and diverges from existing read model).
  - Server-side aggregation API in web app: rejected (adds unnecessary new authority layer).

## Decision 3: Execution readiness stale criteria and fallback

- Decision: Use indexer readiness fields (`state`, `queuedAt`, `executedAt`) first; treat readiness as stale when either:
  - indexer health state is `lagging` or `error`, using existing `INDEXER_LAG_THRESHOLD_SECONDS = 600`, or
  - readiness timestamps are missing for queued/executed states.
  Then perform minimal read-only chain reads.
- Rationale: Preserves deterministic indexer-first UX while reducing false readiness states during lag.
- Alternatives considered:
  - Indexer-only readiness: rejected due to lag ambiguity.
  - Chain-only readiness: rejected due to unnecessary RPC dependence and weaker consistency with list/query views.

## Decision 4: Minimal chain-read fallback contract methods

- Decision: Fallback reads use community governor module only:
  - `state(uint256)`
  - `proposalEta(uint256)`
  - `proposalNeedsQueuing(uint256)`
  - `getMultiChoiceTotals(uint256)` (for current tallies when unavailable from indexer)
  - `getVoterMultiChoiceWeights(uint256,address)` (for connected voter prior vote if needed)
- Rationale: These are view methods exposed by existing ABI and avoid introducing execution semantics changes.
- Alternatives considered:
  - Timelock `getOperationState` direct reads: rejected for this phase because deriving operation IDs in UI adds complexity and duplicate semantics with governor-facing readiness methods.

## Decision 5: Weighted voting UX model

- Decision: Internally represent allocations as integer basis points and require exact sum `10_000`; render/edit in UI as percentage with exactly two decimals.
- Rationale: Matches clarified requirement, avoids float drift, and maps cleanly to integer contract args.
- Alternatives considered:
  - Float percentages only: rejected due to rounding ambiguity.
  - Tolerance-based totals: rejected because spec requires exact total.

## Decision 6: Draft escalation proposalId derivation

- Decision: Parse `ProposalEscalated(uint256 draftId,uint256 proposalId,bool isMultiChoice,uint8 numOptions)` from DraftsManager tx receipt logs for best-effort immediate navigation.
- Rationale: `writeContractAsync` does not directly return Solidity return values; event decoding is deterministic and ABI-backed.
- Alternatives considered:
  - Poll indexer only: rejected due to slower UX.
  - Assume direct return value from tx call: rejected (not available post-mining in wallet flow).

## Decision 7: CTA behavior in community overview

- Decision: Enable proposals `View all` CTA and keep proposals `Create new` disabled non-link; keep parameters CTA disabled non-link.
- Rationale: Matches feature scope and avoids exposing unsupported proposal creation path.
- Alternatives considered:
  - Enable proposal creation CTA: rejected (explicitly out of scope).

## Decision 8: Requirements input gap handling

- Decision: Add a canonical [requirements.md](./requirements.md) artifact in feature directory, derived from approved [spec.md](./spec.md) and checklist.
- Rationale: User requested spec + requirements as planning inputs; this file removes input ambiguity for downstream tasks.
- Alternatives considered:
  - Use only checklist requirements file: rejected because path did not match requested input name.
