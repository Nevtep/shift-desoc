# Phase 0 Research: Single-Community Architecture Refactor

## Decision 1: Primary refactor strategy is contract-by-contract conversion to single-community internals
- Decision: Refactor each deploy stack contract to remove internal multi-community keyed state and treat each deployment as one community scope.
- Rationale: Aligns architecture with per-community deployments and minimizes authority/state leakage risk.
- Alternatives considered:
  - Keep mixed internals and rely on deployment conventions: rejected because drift risk remains high.
  - Partial refactor of only high-risk modules: rejected because spec main objective is full stack refactor.

## Decision 2: Shared vs per-community boundary
- Decision: Keep `CommunityRegistry` shared; move `ParamController` to per-community deployment model.
- Rationale: `CommunityRegistry` remains coordination index, while policy authority belongs to local governance context.
- Alternatives considered:
  - Keep both shared: rejected due to policy coupling and cross-community authority complexity.
  - Make both per-community: rejected due to loss of shared discovery/index responsibilities.

## Decision 3: Authorization model for CommunityRegistry
- Decision: `CommunityRegistry` does not use `AccessManaged`; enforce explicit internal authorization guards and community-scoped checks.
- Rationale: Current inheritance without `restricted` is non-effective; explicit checks are auditable and intent-revealing.
- Alternatives considered:
  - Add `restricted` selectors and keep AccessManaged: rejected for this shared module direction and simpler explicit guard objective.
  - Keep current pattern unchanged: rejected due to false security signaling.

## Decision 4: Deploy-time authority bootstrap model
- Decision: Deployment is not proposal-driven; deployer configures local `AccessManager` permissions during bootstrap, then performs mandatory admin handoff to community `TimelockController`.
- Rationale: Reduces setup friction while preserving strict post-deploy governance authority.
- Alternatives considered:
  - Proposal-driven wiring before first operation: rejected as unnecessary bootstrap overhead.
  - Permanent deployer admin: rejected as governance invariant violation.

## Decision 5: Wizard state contract
- Decision: Enforce exact state flow `PRECHECKS -> DEPLOY_STACK -> CONFIGURE_ACCESS_PERMISSIONS -> HANDOFF_ADMIN_TO_TIMELOCK -> VERIFY_DEPLOYMENT`.
- Rationale: Deterministic operational model with explicit bootstrap and authority transfer checkpoints.
- Alternatives considered:
  - Collapse states into fewer steps: rejected due to reduced observability and weaker failure recovery.
  - Keep old proposal states: rejected by updated architecture.

## Decision 6: Base Sepolia policy handling
- Decision: No legacy support, no incremental migration, no mixed-mode runtime.
- Rationale: Staging environment prioritizes target-state correctness over compatibility.
- Alternatives considered:
  - Transitional adapters/migrations: rejected as out of scope and velocity drag.

## Decision 7: Validation and quality gates
- Decision: Success requires per-contract tests, cross-community isolation tests, deploy bootstrap/handoff tests, and synchronized docs/indexer/app updates.
- Rationale: Prevents vertical-slice drift and catches authority/security regressions early.
- Alternatives considered:
  - Contracts-only testing: rejected due to monorepo integration risks.
