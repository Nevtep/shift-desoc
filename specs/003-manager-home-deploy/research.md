# Phase 0 Research: Manager Home Deploy Wizard + Communities Index

## Decision 1: Use user-signed transaction orchestration in Manager (no backend deployer key)

- Decision: All deploy/configure/wire transactions are initiated and signed by the connected wallet via wagmi/viem.
- Rationale: Matches clarification decision and preserves contract-first authority boundaries without introducing privileged backend trust.
- Alternatives considered:
  - Backend signer deployment pipeline: rejected due to key custody risk and mismatch with explicit user-signed requirement.
  - Hybrid signer model: rejected because it complicates trust and failure semantics without requirement support.

## Decision 2: Treat shared infrastructure as hard precondition and block wizard start if missing

- Decision: Preflight validates `accessManager`, `paramController`, and `communityRegistry` presence + bytecode + ABI probes; start is blocked when invalid.
- Rationale: Aligns with scripts and clarification outcome (`deploySharedInfraIfMissing` is script behavior; wizard must not deploy shared infra).
- Alternatives considered:
  - Deploy shared infra from wizard: rejected because scope is per-community stack only.
  - Partial warning and continue: rejected due to deterministic failure risk in downstream steps.

## Decision 3: Mirror staged deployment order from hardhat scripts

- Decision: Wizard step order is `Preflight` -> `Deploy Community Stack` -> `Wire Roles` -> `Verify`.
- Rationale: Maintains parity with `deploy-community-stack`, `post-deploy-role-wiring`, and `verify-community-deployment` behavior.
- Alternatives considered:
  - Merge deploy and wire into one opaque step: rejected because it reduces failure localization and resume precision.
  - Add extra optional steps before verification: rejected to keep strict parity and avoid behavior drift.

## Decision 4: Resume authority and targeting are scoped to initiating wallet and target session/community

- Decision: Resume requires explicit target (`communityId` or pre-registration session id) and connected wallet must match initiating deployer.
- Rationale: Matches clarification decisions FR-015a/b/c and prevents cross-wallet takeover of in-progress flows.
- Alternatives considered:
  - Auto-resume latest unfinished deployment for any wallet: rejected as unsafe and ambiguous.
  - Global resume list without wallet filtering: rejected for authorization drift.

## Decision 5: Use on-chain state as source of truth after registration

- Decision: Once `communityId` exists, infer completion from `CommunityRegistry` + role/module checks; local state is advisory only for pre-registration progress.
- Rationale: Satisfies contract-first authority and MR-004; avoids stale local/deployment-json assumptions.
- Alternatives considered:
  - Continue relying on local deployment JSON after registration: rejected due to non-authoritative drift risk.
  - Persist all state remotely in app API: rejected as unnecessary authority layer.

## Decision 6: Funds preflight uses conservative tx-count x gas model with volatility buffer

- Decision: Compute required native token with a step-aware tx count estimate and 1.25x volatility buffer; block start when balance is below threshold.
- Rationale: Meets FR-004/FR-005 and handles gas volatility edge case.
- Alternatives considered:
  - Static minimum balance constant: rejected because it is network- and fee-insensitive.
  - No buffer: rejected due to increased mid-flow insufficiency failures.

## Decision 7: Verification output must match deterministic script scope and reasons

- Decision: Wizard verification runs the same 9 read checks used by `verifyCommunityDeployment` and presents check-level pass/fail reasons.
- Rationale: Clarification requires parity with deterministic script behavior; supports deterministic operator recovery.
- Alternatives considered:
  - High-level single status only: rejected due to poor diagnosability.
  - Expanded custom checks beyond script parity: rejected to avoid divergence.

## Decision 8: Communities index continues to use GraphQL query-based projection with robust states

- Decision: Keep communities index powered by GraphQL `Communities` query and preserve explicit loading/empty/error rendering.
- Rationale: Existing tested path in `CommunityList` already satisfies P3 baseline and avoids unnecessary backend work.
- Alternatives considered:
  - Replace with direct chain reads on home route: rejected due to extra complexity and pagination ergonomics.
  - Hide list during wizard operations: rejected by FR-018 requirement.

## Decision 9: No contract/indexer schema changes in this feature slice

- Decision: Implement this feature entirely in Manager app and docs/status layers.
- Rationale: Scope is orchestration/UI; no new protocol capabilities are needed.
- Alternatives considered:
  - Add new events/contracts for deployment sessions: rejected as overreach.
  - Add new indexer schema for deployment sessions: deferred unless later needed for analytics.

## Latest Implementation Findings (2026-03-06)

Current `apps/web` state was reviewed against `spec.md`, `plan.md`, `tasks.md`, and deploy-script behavior in `scripts/hardhat/community-deploy-lib.ts`.

1. Home route does not yet include deploy wizard + communities index composition (current page is static links).
  - Impact: FR-001/FR-018 are not implemented yet.
  - Task coverage: T001, T023, T024, T035, T040.

2. Deploy wizard core modules are not present yet (`components/home/*`, `hooks/useDeployWizard.ts`, `hooks/useDeployResume.ts`, `lib/deploy/*`).
  - Impact: FR-007, FR-012, FR-016, FR-017 remain unimplemented.
  - Task coverage: T005-T012, T018-T022, T025-T033.

3. Address/config resolution in web currently imports `deployments/base_sepolia.json` via `apps/web/lib/contracts.ts`.
  - Impact: acceptable for known/shared addresses, but post-registration completion authority must still come from on-chain checks (not deployment JSON).
  - Task coverage: T027, T029, T032, T022.
  - Note: no dedicated task currently states whether `contracts.ts` sourcing should remain static-manifest-based or be replaced by a different runtime source.

4. Script-parity verification evaluator is not implemented in web yet.
  - Impact: wizard cannot yet reproduce deterministic `verifyCommunityDeployment` checks in UI.
  - Required parity set: CommunityRegistry module pointer, VPT initialization, required role grants, marketplace active flag, and RevenueRouter treasury configured.
  - Task coverage: T009, T012, T021.

5. Communities index is GraphQL-projection based and correctly handles loading/empty/error, but no implemented boundary yet ties deploy completion messaging to on-chain truth.
  - Impact: must ensure no indexer freshness lag can incorrectly imply deployment completion.
  - Task coverage: T022, T027, T029, T038, T047.

6. Communities list currently exists on `/communities`, while home page does not yet host wizard-above-index layout.
  - Impact: target home journey is not yet implemented.
  - Task coverage: T024, T035, T040.

### Task Sufficiency Summary For The 6 Findings

- Findings 1, 2, 4, and 6: explicitly covered by existing tasks.
- Findings 3 and 5: mostly covered by existing tasks, but implementation must enforce that deployment completion and resume authority are chain-derived after registration; avoid accidental reliance on deployment JSON or index freshness.
- Optional tightening: add one explicit task sentence (or sub-bullet under T029/T046) confirming post-registration authority checks are derived from on-chain reads, not manifest/indexer state.
