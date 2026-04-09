# Research: Wizard Permission Parity + Allowlist Refresh

## Decision 1: Canonical wiring source is selectorRoleAssignments in factory wizard
- Decision: Use apps/web/lib/deploy/factory-step-executor.ts selectorRoleAssignments as canonical permission assignment source.
- Rationale: This is the exact payload mapped into bootstrapAccessAndRuntime via selector(signature) in CONFIGURE_ACCESS_PERMISSIONS flow, and therefore reflects deployed authority intent.
- Alternatives considered:
  - Parse allowlist JSON as source: rejected because allowlist is a derived artifact and can drift.
  - Infer from contract ABIs only: rejected because ABIs do not encode role assignments.

## Decision 2: Handoff truth includes static step proof plus optional runtime verification
- Decision: Confirm timelock ADMIN_ROLE eligibility from both:
  1) static handoff sequence in executeHandoffAdminToTimelock
  2) optional runtime hasRole checks against deployment addresses.
- Rationale: Static proof defines intended behavior; runtime proof verifies actual post-run chain state.
- Alternatives considered:
  - Static-only: rejected because it cannot detect deployment/runtime anomalies.
  - Runtime-only: rejected because plan must remain testable in offline/unit contexts.

## Decision 3: ABI baseline is apps/web/abis artifacts used by composer runtime
- Decision: Validate signatures against apps/web/abis/*.json artifacts.
- Rationale: Composer and target registry already import these ABIs, so this is the closest executable truth for UX and calldata encoding.
- Alternatives considered:
  - Hardhat artifacts in artifacts/contracts: rejected for this feature because web runtime can diverge if ABI copy sync is stale.
  - Inline minimal ABIs in script: rejected due to drift risk.

## Decision 4: Signature validation is exact-string plus selector equality
- Decision: For each matrix row, require exact function signature match in ABI and selector(signature) equality check.
- Rationale: Prevents overload/tuple ambiguity and enforces no-heuristics requirement.
- Alternatives considered:
  - Function-name-only match: rejected due to overload ambiguity.
  - Selector-only lookup: rejected because selector collisions and human readability/auditability are weaker.

## Decision 5: Fail-closed artifact contract
- Decision: On any ABI mismatch, emit signature-not-found.json and terminate generation non-zero; do not update allowlist profile.
- Rationale: Prevents partial or stale profile writes that can silently widen/narrow permissions.
- Alternatives considered:
  - Best-effort generation with warnings: rejected by FR-005/FR-009.

## Decision 6: Timelock surface derivation strictly ADMIN_ROLE + verified timelock holder
- Decision: Include only rows where roleName is ADMIN_ROLE and handoff evidence proves Timelock owns ADMIN_ROLE at end-state.
- Rationale: Direct implementation of FR-006.
- Alternatives considered:
  - Include other governance-related roles: rejected because role ownership can belong to modules, not timelock.

## Decision 7: Determinism policy for generated artifacts
- Decision: Deterministic JSON output with stable key ordering, sorted targets/signatures/selectors, and deterministic metadata counts/hash.
- Rationale: Enables CI drift checks and reproducible profile generation.
- Alternatives considered:
  - Timestamped generation metadata: rejected for committed outputs; use stable synthetic generatedAt in profile.

## Decision 8: Expert target gating remains visible-but-disabled
- Decision: Keep targets visible in Expert mode and disable with deterministic reason when module missing or no allowlisted functions.
- Rationale: Aligns with Flows guidance and FR-010/FR-011.
- Alternatives considered:
  - Hide unavailable targets: rejected because it obscures why capabilities are unavailable.

## Decision 9: Guided template catalog is layer-crucial and allowlist-gated
- Decision: Build/refresh crucial-flow catalog per layer from docs/EN/Layers.md and docs/EN/Flows.md; templates enabled only when corresponding signature is allowlisted.
- Rationale: Ensures safety and consistency without assuming unsupported authority.
- Alternatives considered:
  - Hardcode always-enabled templates: rejected due to authority drift risk.
  - Remove non-executable crucial flows from catalog: rejected because gap visibility is required.

## Decision 10: Report placement and format
- Decision: Publish human-readable matrix report at docs/permission-matrix.md and structured JSON artifacts under specs/010-wizard-permission-parity/contracts/.
- Rationale: docs path supports audit/readability; spec path supports task reproducibility and schema-bound validation.
- Alternatives considered:
  - Keep reports only in CI logs: rejected due to poor traceability.
