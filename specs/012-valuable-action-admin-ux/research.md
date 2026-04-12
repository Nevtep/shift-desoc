# Phase 0 Research: ValuableAction Registry Admin UX + Projection Readiness

## Decision 1: Authority-aware operation routing

- Decision: Use a fail-closed runtime authority classifier with three outcomes per operation: `direct_write`, `governance_required`, `blocked`.
- Rationale: This keeps contracts as authority source-of-truth and prevents UI from implying powers that are not available on-chain.
- Alternatives considered:
  - Static role mapping in UI config: Rejected due to drift risk after deployments/role rewiring.
  - Simulate write-only probing (`estimateGas`/`callStatic`) as primary authority check: Rejected because failures are ambiguous and not reliably explainable.
  - Governance-only UX for all writes: Rejected because it reduces operator velocity where direct authority exists in staging/admin configurations.

## Decision 2: Projection readiness model

- Decision: Use explicit readiness states `healthy`, `lagging`, `unavailable`, derived from indexer process health plus projection freshness watermark.
- Rationale: Ponder health/readiness and projection lag are distinct; combining them avoids stale read-model data being presented as canonical state.
- Alternatives considered:
  - Binary ready/not-ready state: Rejected because it hides actionable intermediate lag conditions.
  - Entity timestamp heuristics only: Rejected because low activity can look stale while projection is fully synced.
  - Head-only without confidence signal: Rejected due to reorg ambiguity and operator confusion.

## Decision 3: Compatibility strategy (default no ABI/event changes)

- Decision: Implement feature first with existing ValuableAction events and read surfaces; escalate to ABI/event changes only when a deterministic blocker is proven.
- Rationale: Existing lifecycle events (`created`, `updated`, `activated`, `deactivated`) should support deterministic projection for catalog/admin UX without breaking downstream consumers.
- Alternatives considered:
  - Immediate ABI/event redesign for richer indexing: Rejected because it increases migration burden before proving need.
  - Full on-demand on-chain reads in Manager without projection additions: Rejected due to weaker operability/readiness transparency and poor list performance.

## Decision 4: Community boundary enforcement

- Decision: Enforce community scoping in both projection queries and mutation guardrails; any route mismatch becomes hard-blocked with corrective UX.
- Rationale: Prevents cross-community leakage and unauthorized mutation from copied/deep links.
- Alternatives considered:
  - UI-only community filtering: Rejected due to insufficient defense if query/mutation layer is not scoped.
  - Soft warning on mismatch: Rejected because mutation attempts must fail closed.

## Decision 5: Testing and validation scope

- Decision: Require a vertical test slice: indexer replay/projection tests, Manager authority/readiness unit tests, and integration checks for no-shadow-authority behavior.
- Rationale: Constitution requires monorepo consistency; app-only testing cannot detect projection drift or authority mismatch.
- Alternatives considered:
  - Web-only unit tests: Rejected due to blind spots around replay determinism.
  - Manual staging verification only: Rejected due to non-repeatability and weaker regression protection.

## Final Clarification Resolution

All `NEEDS CLARIFICATION` items from planning were resolved during Phase 0:

1. Authority routing: Resolved to runtime fail-closed classifier.
2. Readiness semantics: Resolved to healthy/lagging/unavailable model with watermark inputs.
3. Contract compatibility path: Resolved to no-ABI first, blocker-driven escalation.

No unresolved planning clarifications remain.
