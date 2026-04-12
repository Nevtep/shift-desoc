# Data Model: ValuableAction Registry Admin UX + Projection Readiness

## Entity: ValuableActionDefinition

Purpose: Canonical community-scoped action definition used by operators and later Engagement flows.

Fields:
- `communityId` (uint256, required): Community scope key.
- `actionId` (uint256, required): Stable action identifier within community.
- `title` (string, required): Operator-facing action title.
- `metadataCid` (string, optional): Off-chain metadata pointer when present.
- `ruleSummary` (string, optional): Human-readable rule summary for admin detail.
- `isActive` (boolean, required): Activation state for downstream consumption.
- `createdAtBlock` (uint64, required): Block where action was created.
- `updatedAtBlock` (uint64, required): Last mutation block.
- `lastEventTxHash` (bytes32/string, required): Last event transaction hash for traceability.

Validation rules:
- `communityId` must equal active Manager route community context.
- `actionId` must be unique per `communityId`.
- `title` cannot be empty for create and edit.
- Mutation requests are rejected on community mismatch.

State transitions:
- `created` -> `active` or `inactive` (depending on creation defaults).
- `active` -> `inactive` via deactivate operation.
- `inactive` -> `active` via activate operation.
- Any mutable field update transitions state version and updates `updatedAtBlock`.

## Entity: ActionAuthorityMode

Purpose: Operation-level authority contract for create/edit/activate/deactivate.

Fields:
- `communityId` (uint256, required)
- `operation` (enum, required): `create`, `edit`, `activate`, `deactivate`
- `mode` (enum, required): `direct_write`, `governance_required`, `blocked`
- `reasonCode` (string, required when blocked): Deterministic explainability code.
- `evaluatedAtBlock` (uint64, optional): On-chain context block for evaluation.

Validation rules:
- `mode=direct_write` requires positive on-chain authorization check.
- `mode=governance_required` must not expose direct-write call-to-action.
- `mode=blocked` must include user-readable guidance mapped from `reasonCode`.

State transitions:
- Mode may change as roles/governance wiring changes.
- Transitions are non-persistent UI/runtime evaluations and must not become stored authority.

## Entity: ProjectionReadinessState

Purpose: Explicit health/freshness indicator for projected ValuableAction data.

Fields:
- `status` (enum, required): `healthy`, `lagging`, `unavailable`
- `indexedBlock` (uint64, optional)
- `chainHeadBlock` (uint64, optional)
- `blockLag` (uint64, optional)
- `indexedAt` (timestamp, optional)
- `details` (string, optional): Human-readable guidance

Validation rules:
- `healthy` requires indexer reachable and lag under threshold.
- `lagging` indicates partial trust; UI must show warning and freshness metadata.
- `unavailable` blocks privileged submissions that depend on projection confirmation.

State transitions:
- `unavailable` -> `lagging` -> `healthy` during recovery/backfill.
- `healthy` -> `lagging` when lag exceeds threshold.
- `lagging` -> `unavailable` on transport/query failures.

## Entity: CommunityScopeContext

Purpose: Shared guard context to prevent cross-community reads/writes.

Fields:
- `activeCommunityId` (uint256, required)
- `routeActionId` (uint256, optional)
- `resolvedActionCommunityId` (uint256, optional)
- `isBoundaryValid` (boolean, required)

Validation rules:
- If `routeActionId` resolves to different community than `activeCommunityId`, `isBoundaryValid=false`.
- Any mutation requires `isBoundaryValid=true`.

State transitions:
- Recomputed on route change, community switch, or action selection.

## Relationships

- `CommunityScopeContext 1 -> many ValuableActionDefinition`
- `ValuableActionDefinition 1 -> many ActionAuthorityMode` (one per operation)
- `CommunityScopeContext 1 -> 1 ProjectionReadinessState` (for current catalog view)
