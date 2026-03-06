# Implementation Plan: Manager Home Deploy Wizard And Communities Index

**Branch**: `003-manager-home-deploy` | **Date**: 2026-03-06 | **Spec**: `/Users/core/Code/shift/specs/003-manager-home-deploy/spec.md`
**Input**: Feature specification from `/Users/core/Code/shift/specs/003-manager-home-deploy/spec.md`

## Summary

Implement a Manager home vertical slice that puts a user-signed, multi-step community deploy wizard above a communities index, with deterministic preflight checks, interruption-safe resume behavior, and verification output equivalent to `verifyCommunityDeployment` script checks. The implementation will not change protocol contracts; it will orchestrate existing staged deployment behavior in the Next.js app using on-chain reads/writes and existing GraphQL community list queries.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js App Router (16.x), Node 22  
**Primary Dependencies**: wagmi 2.x, viem 2.x, @tanstack/react-query 5.x, graphql-request, zod, Vitest, Testing Library, MSW  
**Storage**: On-chain state (CommunityRegistry + module contracts) as canonical source; browser local/session storage for pre-registration in-progress metadata only  
**Testing**: Vitest + Testing Library + MSW for unit/integration; existing app test harness `apps/web/tests/unit`  
**Target Platform**: Manager dApp in browser (desktop/mobile responsive) on supported EVM networks (Base Sepolia currently configured)
**Project Type**: Monorepo web app slice (no contract ABI/event changes)  
**Performance Goals**: Preflight read path under 2s on healthy RPC; wizard step status refresh under 1s after tx receipt; communities list first render under 1s with cached query  
**Constraints**: User-signed tx flow only, no backend deployer key, shared infra hard precondition, no local JSON as authority after registration, deterministic verification parity with script checks  
**Scale/Scope**: Single feature slice on `apps/web/app/page.tsx` plus supporting hooks/services/components and tests; multi-community safe (no hidden single-community assumptions)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

- Protocol infrastructure first: PASS
  The feature is Manager UX orchestration over existing protocol primitives. No new protocol or vertical-specific contract behavior is introduced.
- Contract-first authority: PASS
  Resume and verification decisions are derived from `CommunityRegistry` and role/module contract reads once community is registered.
- Security/invariant preservation: PASS
  No privileged mutation path changes. Existing authority boundaries remain (AccessManager/Timelock/Governor).
- Event/indexer discipline: PASS
  No ABI/event changes. Communities index continues using existing GraphQL projection; deployment completion truth remains on-chain.
- Monorepo vertical-slice scope: PASS
  Planned across Manager UI, app service layer, tests, docs, and project-management docs; contracts remain untouched.
- Project-management docs sync: PASS (REQUIRED UPDATE)
  Feature changes Manager capability/status. Update both `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` in same change set.
- Compatibility discipline: PASS
  No contract/event breakage. Home-route UX change is intentional and covered by tests/docs updates.

### Post-Design Re-Check

- Protocol infrastructure first: PASS
- Contract-first authority: PASS
- Security/invariant preservation: PASS
- Event/indexer discipline: PASS
- Monorepo vertical-slice scope: PASS
- Project-management docs sync: PASS (planned)
- Compatibility discipline: PASS

## Project Structure

### Documentation (this feature)

```text
specs/003-manager-home-deploy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── manager-home.graphql
│   └── manager-home-read-api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
  app/page.tsx
  components/communities/community-list.tsx
  components/home/*
  hooks/*
  lib/contracts.ts
  lib/graphql/queries.ts
  tests/unit/components/*
  tests/unit/routes/*
docs/EN/guides/MANAGEMENT_TOOLS.md
.github/project-management/IMPLEMENTATION_STATUS.md
.github/project-management/STATUS_REVIEW.md
scripts/hardhat/community-deploy-lib.ts
scripts/hardhat/deploy-community-stack.ts
scripts/hardhat/post-deploy-role-wiring.ts
scripts/hardhat/verify-community-deployment.ts
```

**Structure Decision**: Implement as a Manager-app-only orchestration layer that mirrors staged script behavior. No new contract deployments or protocol changes; script behavior is treated as authoritative reference for step order, checks, and completion criteria.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | No | `contracts/**` | No ABI/event/functionality changes. |
| Indexer (Ponder) | No (optional) | `apps/indexer/**` | Existing communities list query reused; no mandatory indexer schema changes. |
| Manager App (Next.js) | Yes | `apps/web/app/page.tsx`, `apps/web/components/home/**`, `apps/web/components/communities/community-list.tsx`, `apps/web/hooks/**`, `apps/web/lib/**`, `apps/web/tests/unit/**` | Adds wizard state machine and preflight/read models. User-signed tx only. |
| Downstream dApp Surface | Low | `apps/web/lib/graphql/queries.ts` | GraphQL read contract remains backward-compatible; extensions are additive. |
| Documentation | Yes | `docs/EN/guides/MANAGEMENT_TOOLS.md`, `.github/project-management/IMPLEMENTATION_STATUS.md`, `.github/project-management/STATUS_REVIEW.md` | Required by DT-001/DT-003 and constitution doc-sync gate. |

## Deployment Wizard Step Model

Source-of-truth mapping is derived from staged scripts and `scripts/hardhat/community-deploy-lib.ts`.

1. Step `Preflight`
  Purpose: validate wallet/network/shared infra/funds before any write.
  Reads:
  `communityRegistry`, `paramController`, `accessManager` bytecode presence and ABI probes.
  `wallet balance`, fee data, chain support.
  Blocking rules:
  missing shared infra, unsupported chain, disconnected wallet, insufficient funds.

2. Step `Deploy Community Stack`
  Purpose: deploy per-community contract set and register new community.
  Writes (user-signed):
  all deployments done from connected wallet; `registerCommunity`; ParamController configuration writes; `setModuleAddresses`.
  Completion condition:
  community registration confirmed and module pointers persisted.

3. Step `Wire Roles And Configuration`
  Purpose: perform AccessManager selector-role bindings, grants, module wiring, activation and final authority handoff.
  Writes (user-signed):
  `setTargetFunctionRole`, role grants/revokes, module-specific configuration (`initializeCommunity`, issuance modules, treasury/support tokens, marketplace active/token).
  Completion condition:
  expected role and module wiring present; deployer admin privileges revoked per script behavior.

4. Step `Verify Community Deployment`
  Purpose: deterministic read-only validation equivalent to `verifyCommunityDeployment`.
  Reads:
  module wiring, VPT initialization, required roles, marketplace active, treasury configured.
  Completion condition:
  all checks pass; otherwise step fails with explicit reason per check.

## Resume Inference Model

1. Resume target identity
  `registered`: by `communityId`.
  `pre-registration`: by local session id.

2. Authorization
  Resume allowed only if connected wallet equals `deployerAddress` recorded in session metadata.

3. Source of truth
  Before registration: local session metadata may track progress.
  After registration: infer completion from chain state only (`CommunityRegistry` pointers + role/check reads).

4. Next-step inference
  If no communityId and local preflight/deploy started: resume from first incomplete pre-registration checkpoint.
  If communityId exists: run deterministic step predicates in order and resume at first failing predicate.
  If all predicates pass: return `completed` with verification summary, no writes.

5. Reconciliation rules
  On page reload, always reconcile local session with chain-derived status.
  If conflict, chain state wins and local session is rewritten to reconciled state.

## Preflight Funds Estimation Model

1. Inputs
  `wallet balance`, `gasPrice`/EIP-1559 fee estimates, estimated tx count by step, safety multiplier.

2. Estimated tx count strategy
  Base constants derived from script behavior:
  Deploy stack: high tx count (contract deployments + registration + ParamController + module addresses).
  Wiring: high tx count (role and linkage calls, token support loops).
  Verify: read-only (0 tx).
  Preflight: read-only (0 tx).

3. Formula
  `requiredWei = (estimatedTxCount * estimatedGasPerTx * maxFeePerGas) * volatilityBuffer`.
  Volatility buffer default: 1.25x.

4. Blocking threshold
  Start blocked if `balanceWei < requiredWei`.
  UI shows: required, current balance, recommended additional safety amount.

## Shared Infra Detection Model

Shared infra is a hard precondition and never deployed by wizard.

Checks mirror `isUsableSharedInfra` behavior:

1. Required addresses present (config/deployment source):
  `accessManager`, `paramController`, `communityRegistry`.
2. Bytecode exists at each address.
3. ABI probes succeed:
  `ShiftAccessManager.ADMIN_ROLE()`
  `ParamController.communityRegistry()`
  `CommunityRegistry.nextCommunityId()`

Failure behavior:
  block wizard start and show remediation:
  run shared infra deployment pipeline first (`deploy-shared-infra`) and reload.

## Verification Parity Mapping

Wizard check list must be 1:1 with `verifyCommunityDeployment` semantics:

1. `valuableActionRegistry` module pointer matches registry modules view.
2. `VerifierPowerToken1155.communityInitialized(communityId)` is true.
3. `REVENUE_ROUTER_POSITION_MANAGER_ROLE` granted to PositionManager.
4. `REVENUE_ROUTER_DISTRIBUTOR_ROLE` granted to Marketplace.
5. `COMMERCE_DISPUTES_CALLER_ROLE` granted to Marketplace.
6. `HOUSING_MARKETPLACE_CALLER_ROLE` granted to Marketplace.
7. `VALUABLE_ACTION_REGISTRY_ISSUER_ROLE` granted to RequestHub.
8. `Marketplace.communityActive(communityId)` is true.
9. `RevenueRouter.communityTreasuries(communityId) != ZeroAddress`.

UI output per check:
  check name, pass/fail boolean, explicit fail reason string.

## Implementation Phases

1. Phase A: Home Composition And UX Shell
  Add home layout sections with wizard panel first and communities index below.
  Keep existing community list behaviors (loading/empty/error) intact.

2. Phase B: Wizard State Machine + Preflight
  Add typed wizard model/hook/service for deterministic step transitions.
  Implement wallet/network/shared infra/funds preflight and start gating.

3. Phase C: User-Signed Execution + Resume
  Implement write orchestration with wagmi/viem tx lifecycle tracking.
  Persist minimal session metadata and implement strict deployer-only resume.
  Add on-chain inference for post-registration step completion.

4. Phase D: Deterministic Verification + Docs
  Implement script-parity read checks and human-readable results.
  Update docs and project-management status files in lockstep.

## Impacted Files (Planned)

1. `apps/web/app/page.tsx`
2. `apps/web/components/home/deploy-wizard.tsx`
3. `apps/web/components/home/deploy-step-list.tsx`
4. `apps/web/components/home/deploy-preflight.tsx`
5. `apps/web/components/home/deploy-verification-results.tsx`
6. `apps/web/components/communities/community-list.tsx`
7. `apps/web/hooks/useDeployWizard.ts`
8. `apps/web/hooks/useDeployResume.ts`
9. `apps/web/lib/deploy/wizard-machine.ts`
10. `apps/web/lib/deploy/preflight.ts`
11. `apps/web/lib/deploy/verification.ts`
12. `apps/web/lib/deploy/session-store.ts`
13. `apps/web/lib/graphql/queries.ts` (only if list shape extension needed)
14. `apps/web/tests/unit/components/deploy-wizard.test.tsx`
15. `apps/web/tests/unit/lib/deploy/wizard-machine.test.ts`
16. `apps/web/tests/unit/lib/deploy/preflight.test.ts`
17. `apps/web/tests/unit/lib/deploy/verification.test.ts`
18. `docs/EN/guides/MANAGEMENT_TOOLS.md`
19. `.github/project-management/IMPLEMENTATION_STATUS.md`
20. `.github/project-management/STATUS_REVIEW.md`

## Testing Strategy

1. Unit tests
  Wizard state machine transitions (idle->preflight->deploy->wire->verify->done/failure).
  Resume inference logic (pre-registration vs registered).
  Shared infra detection check matrix.
  Funds estimation threshold and buffer behavior.
  Verification parity mapping (9 checks + reason strings).

2. Component tests
  Home page ordering: wizard above communities list.
  Preflight blocking UI for disconnected wallet, wrong chain, missing shared infra, insufficient funds.
  Step progress rendering (purpose, expected tx count, completed tx count).
  Failure/retry/resume UX.
  Communities list loading/empty/error/populated states and route links.

3. Integration tests (MSW + wagmi mocks)
  Complete happy-path deterministic flow with mocked receipts.
  Interrupted flow resume from first incomplete step.
  Deployer mismatch blocks resume.
  Registered-complete resume returns completed verification and does not send tx.

4. Non-goals in this slice
  No new Foundry/contract tests (no contract modifications).
  No indexer schema migration required.

## Definition Of Done Mapping

| Requirement Group | Done When | Validation |
|---|---|---|
| FR-001 to FR-003 | Home displays wizard first with clear upfront guidance | component tests + snapshot/assertion |
| FR-004 to FR-006a | Preflight performs funds/network/shared-infra checks and blocks start on failure | unit tests for preflight + UI tests |
| FR-007 to FR-010 | Step sequence mirrors staged scripts with tx progress and stop-on-failure behavior | state machine tests + integration flow |
| FR-011 to FR-015c | Resume available and authorized only for initiating wallet with deterministic next-step inference | resume tests + wagmi mock auth tests |
| FR-016 to FR-017 | Verification checks match script parity and gate completion state | verification unit tests |
| FR-018 to FR-021 | Communities index visible below wizard with all states and link behavior | existing + updated list tests |
| FR-022 to FR-023 | Multi-community-safe state model and canonical terminology usage | type/model review + copy checks |
| MR/CM/DT | No contract changes; docs and project status files synchronized | changed-files review + docs assertions |

## Complexity Tracking

No constitution violations requiring exception.
