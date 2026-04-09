# Research: Draft Action Composer Timelock Surface

## Decision 1: Runtime allowlist source
- Decision: Use one committed versioned allowlist file in-repo for v1 runtime authority.
- Rationale: Deterministic behavior, PR-reviewable changes, no runtime drift from environment artifacts, explicit governance safety boundary.
- Alternatives considered:
  - Dynamic startup derivation from deploy artifacts: rejected for runtime drift and weaker reviewability.
  - Hybrid base + dynamic extension: rejected for v1 due to increased complexity and ambiguity.

## Decision 2: Allowlist authority extraction input
- Decision: Generate allowlist from canonical selector-role assignments in `apps/web/lib/deploy/factory-step-executor.ts`, selecting signatures bound to `ADMIN_ROLE` that are handed to Timelock after handoff.
- Rationale: Matches approved spec source-of-truth and existing wizard wiring semantics.
- Alternatives considered:
  - Scanning all mutable ABI functions: rejected (heuristic, violates FR-002).
  - Manual hand-maintained list only: rejected as error-prone without generation pipeline.

## Decision 3: Allowlist generation and reviewability
- Decision: Add a deterministic generator script (proposed path: `scripts/generate-draft-composer-allowlist.ts`) that outputs stable-sorted JSON and validates signatures against ABI artifacts.
- Rationale: Satisfies FR-004A and makes diffs reviewable/reproducible.
- Alternatives considered:
  - Runtime schema-free object literal in app code: rejected for poor auditability and update ergonomics.
  - Script output without ABI validation: rejected for signature drift risk.

## Decision 4: Overload handling
- Decision: Represent overloads as exact signatures (e.g., `setTokenAllowed(uint256,address,bool)` and `setTokenAllowed(address,bool)`) and treat each as independent allowlist entry.
- Rationale: Explicitness and deterministic selection; no ambiguity from function-name-only matching.
- Alternatives considered:
  - Function-name-only allowlist: rejected because overload ambiguity can cause unsafe call encoding.

## Decision 5: Expert-mode target UX for unavailable actions
- Decision: Keep targets visible and disabled with explicit reason when module missing or when allowlisted signatures for that target are empty.
- Rationale: Operational transparency and explicit permission-gap signaling.
- Alternatives considered:
  - Hide unavailable targets: rejected because it obscures governance capability gaps.

## Decision 6: Guided template safety model
- Decision: Guided templates are schema-driven, bounded inputs, and deterministic encoders that always choose community-scoped overloads when available.
- Rationale: Enforces SAFE-only behavior and prevents accidental global writes.
- Alternatives considered:
  - User overload toggle in guided mode: rejected due to footgun risk and added complexity.

## Decision 7: Deterministic bundle hashing
- Decision: Keep `actionsHash = keccak256(encodePacked(address[] targets, uint256[] values, bytes[] calldatas))` in strict queue order.
- Rationale: Matches existing implementation and approved clarification; avoids compatibility drift.
- Alternatives considered:
  - `abi.encode` variant: rejected because it would alter existing hash semantics.

## Decision 8: Scope boundaries
- Decision: Restrict implementation to web app + script + docs + tests; no contracts/indexer/proposal execution changes.
- Rationale: Matches approved non-goals and reduces delivery risk.
- Alternatives considered:
  - Permission rewiring or protocol changes in same feature: rejected as out-of-scope.
