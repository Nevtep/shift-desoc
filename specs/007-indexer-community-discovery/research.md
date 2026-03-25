# Research: Indexer Dynamic Multi-Community Discovery

## Decision 1: Discovery source remains on-chain only via CommunityRegistry lifecycle events
- Decision: Use `CommunityRegistered` and `ModuleAddressUpdated` as the sole source of module discovery.
- Rationale: Satisfies contract-first authority and avoids drift with off-chain deployment artifacts.
- Alternatives considered:
  - Deployment JSON bootstrap for module discovery: rejected by spec constraint (on-chain only).
  - Manual static address lists per network: rejected as non-scalable and error-prone.

## Decision 2: Use hybrid factory strategy for module contract types
- Decision: Configure single-level `factory()` sources per module contract type using `ModuleAddressUpdated.newAddress` as discovered parameter, then enforce moduleKey filtering/validation in attribution resolver and handlers.
- Rationale: CommunityRegistry event emits one address field for many module keys; hybrid strategy keeps factory design simple while preserving module correctness.
- Alternatives considered:
  - Strict per-moduleKey factory filter only: may be limited by factory event-arg filtering support and increases config fragility.
  - One giant generic module factory: loses ABI-specific handler typing and increases accidental decode risk.

## Decision 3: Deterministic attribution must be resolver-first and windowed
- Decision: Introduce `resolveCommunityFromEmitter({ emitterAddress, blockNumber })` backed by mapping windows and an active projection.
- Rationale: Supports replay determinism and rotation correctness across block boundaries.
- Alternatives considered:
  - Keep event-arg communityId as primary source: rejected because many event families lack communityId.
  - Keep static defaultCommunityId fallback: rejected by spec and causes cross-community drift.

## Decision 4: Rotation handling via close/open windows keyed by event order
- Decision: On `ModuleAddressUpdated`, close previous `(communityId,moduleKey)` window and open new window from current block/log position.
- Rationale: Correct attribution across rotations and replay idempotency.
- Alternatives considered:
  - Replace-in-place active mapping only: rejected because it loses historical attribution for prior blocks.

## Decision 5: Unmapped emitters produce telemetry and are not silently attributed
- Decision: Persist unmapped emitter alerts and structured logs, skip business writes when attribution cannot be resolved.
- Rationale: Prevents silent data corruption and enables operational response.
- Alternatives considered:
  - Assign to fallback community: rejected (explicitly forbidden by spec).
  - Drop silently without telemetry: rejected (operational blind spot).

## Decision 6: Governor/proposal attribution from emitter mapping + proposal row linkage
- Decision: Resolve community at proposal creation from governor emitter mapping; votes/lifecycle reuse stored proposal community with consistency checks.
- Rationale: Counting/vote events may not carry community directly; proposal row is canonical bridge.
- Alternatives considered:
  - Infer from deployment default community only: rejected as single-community assumption.

## Decision 7: Replay/backfill relies on start block and idempotent upserts
- Decision: Replay from `COMMUNITY_REGISTRY_START_BLOCK` reconstructs discovery windows then ingests module events; all mapping/entity writes use deterministic conflict targets.
- Rationale: Required for historical communities and repeatable operations.
- Alternatives considered:
  - Partial backfill by latest active mappings only: rejected because historical events before rotations may misattribute.
