# Implementation Plan: Single-Community Architecture Refactor (Base Sepolia Staging)

**Branch**: `004-single-community-architecture` | **Date**: 2026-03-09 | **Spec**: `specs/004-single-community-architecture/spec.md`
**Input**: Feature specification from `specs/004-single-community-architecture/spec.md`

## Summary

Main objective: refactor each deploy stack contract to single-community internals while preserving protocol security invariants. The deployment model becomes per-community authority bootstrap: deploy local `AccessManager`, configure selector permissions during bootstrap, then transfer admin authority to local `TimelockController`. After handoff, privileged changes are governance/timelock-only. Base Sepolia runs clean-slate only (no legacy support, no migration/backfill, no mixed-mode runtime).

Blocking defect recorded on 2026-03-16: Manager wizard deploy runtime currently resolves mutable deploy-step targets through static deployment JSON lookup (`apps/web/lib/contracts.ts` -> `deployments/base_sepolia.json`) instead of run-scoped deployment outputs. Branch closure now requires replacing this path with true run-scoped deployment target resolution.

## Technical Context

**Language/Version**: Solidity `^0.8.24`, TypeScript (Node 22), Next.js app stack  
**Primary Dependencies**: OpenZeppelin 5.x (AccessManager/AccessManaged/Governor/Timelock), Foundry, Hardhat, wagmi/viem  
**Storage**: On-chain EVM storage; deployments JSON files; indexer Postgres derived state  
**Testing**: Foundry (`pnpm forge:test`, `pnpm forge:cov`, `pnpm cov:gate`), web unit/integration tests, deploy flow integration checks  
**Target Platform**: Base Sepolia staging and local test environments  
**Project Type**: Monorepo (contracts + indexer + manager app + scripts + docs)  
**Performance Goals**: Keep deploy and verification deterministic; no additional unbounded loops in refactors  
**Constraints**: Preserve timelock-only privileged path post-handoff; no cross-community authority leakage; no staging migrations  
**Scale/Scope**: 19 per-community contracts + shared `CommunityRegistry`; deploy scripts, Manager Wizard, indexer compatibility, tests, docs/status sync

## Constitution Check

*GATE: Pass before Phase 0 research. Re-check after Phase 1 design.*

- Protocol infrastructure first: PASS. Refactor keeps protocol primitives generic while moving community-local state to per-community instances.
- Contract-first authority: PASS. Authority is enforced on contracts via per-community `AccessManager` bootstrap and timelock handoff; no app/indexer authority path.
- Security/invariant preservation: PASS WITH STRICT CONTROLS. Affected invariants: post-handoff timelock-only privileged writes, no cross-community leakage, TreasuryAdapter guardrails, no staking verifier model.
- Event/indexer discipline: PASS WITH ACTIONS. ABI/event changes likely for contracts dropping `communityId` internals; requires indexer mapping updates and replay validation.
- Monorepo vertical-slice scope: PASS. Plan includes contracts, scripts, app, indexer, tests, docs.
- Project-management docs sync: REQUIRED. Update `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` with architecture/policy deltas.
- Compatibility discipline: PASS BY POLICY. Breaking changes accepted in staging with explicit clean redeploy; no mixed-mode compatibility.

## Workstreams (Dependency-Ordered)

### WS1 Contracts (Critical Path)

1. Remove multi-community keyed internals from each per-community contract.
2. Keep `CommunityRegistry` shared and remove `AccessManaged` dependency, enforcing explicit internal guards.
3. Convert `ParamController` from shared deployment model to per-community deployment model.
4. Confirm post-handoff authorization paths for all privileged mutations.

Per-contract conversion strategy (from spec matrix):
- `RequestHub`: flatten internal state to local community instance; remove internal `communityId` branch paths.
- `DraftsManager`: localize draft/request/proposal linkage state.
- `ValuableActionRegistry`: localize action templates and issuance paths.
- `Engagements`: localize engagement lifecycle and verifier decision state.
- `CredentialManager`: localize course/application state.
- `PositionManager`: localize position types and lifecycle state.
- `ValuableActionSBT`: localize token metadata/reputation accounting assumptions.
- `VerifierPowerToken1155`: localize verifier power scope to contract instance.
- `VerifierElection`: localize roster/election state.
- `VerifierManager`: localize panel selection and reporting state.
- `CommunityToken`: localize treasury/payment state assumptions.
- `CohortRegistry`: localize cohort lifecycle and accounting.
- `RevenueRouter`: localize distribution accounting and claims.
- `TreasuryAdapter`: localize spend controls and governance linkage.
- `InvestmentCohortManager`: localize issuance and cohort wiring.
- `Marketplace`: localize offers/orders/dispute references.
- `CommerceDisputes`: localize dispute lifecycle state.
- `HousingManager`: localize units/reservations accounting.
- `ProjectFactory`: localize project lifecycle state.

### WS2 Deploy Scripts

1. Update deploy pipeline to create per-community `AccessManager`, `ParamController`, `ShiftGovernor`, `TimelockController`.
2. Add deterministic bootstrap permission wiring step in local `AccessManager`.
3. Add explicit `HANDOFF_ADMIN_TO_TIMELOCK` action and receipt verification.
4. Write finalized addresses to deployments JSON without reading legacy staged state.

### WS3 Manager Wizard

1. Implement state machine exactly:
   `PRECHECKS -> DEPLOY_STACK -> CONFIGURE_ACCESS_PERMISSIONS -> HANDOFF_ADMIN_TO_TIMELOCK -> VERIFY_DEPLOYMENT`.
2. Enforce one active run lock and deterministic restart from `PRECHECKS`.
3. Block completion unless handoff is confirmed on-chain.
4. Ensure no proposal-driven wiring path remains in deploy bootstrap flow.
5. Ensure mutable deploy-step targets are run-scoped addresses produced during the current deploy run (or returned by canonical deploy API), not static `deployments/*.json` values.

### WS4 Tests

1. Contract tests per refactored contract (SC-001).
2. Cross-community isolation and authorization leakage tests (SC-002).
3. Deploy flow tests for bootstrap wiring + handoff + post-handoff restricted mutation failures (SC-003, SC-005).
4. Wizard state transition tests for required states and failure/retry handling (SC-004).
5. Staging policy tests/assertions: no migration/backfill required (SC-006).

### WS5 Docs and Status

1. Update docs reflecting per-community `ParamController` and access bootstrap-handoff model.
2. Sync `contracts/FEATURES.md` and `neuromancer/SHIFT_SYSTEM.md` to shipped behavior (DT-001/DT-002).
3. Update `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` (DT-003).

## Authority Model and Invariants

### Bootstrap Phase (Pre-Handoff)

- Deployer has temporary authority to configure selector permissions in community-local `AccessManager`.
- Scope is limited to deployment bootstrap steps required for initial wiring.

### Operational Phase (Post-Handoff)

- `AccessManager` admin is transferred to community `TimelockController`.
- Privileged mutations execute only through governance/timelock path.
- Direct deployer/manager privileged writes must fail.

### Non-Negotiable Invariants

- No cross-community authority leakage.
- TreasuryAdapter guardrails unchanged.
- Verifier governance model remains non-staking.
- No mixed-mode runtime in Base Sepolia staging.

## Wizard State Implementation Plan

1. `PRECHECKS`: network, wallet, session freshness, target config validation.
2. `DEPLOY_STACK`: deploy contract stack and persist run addresses.
3. `CONFIGURE_ACCESS_PERMISSIONS`: set selector-role permissions in local `AccessManager`.
4. `HANDOFF_ADMIN_TO_TIMELOCK`: transfer admin to local timelock and verify receipt.
5. `VERIFY_DEPLOYMENT`: validate role wiring, module references, and post-handoff constraints.

## Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| Partial refactor leaves hidden multi-community paths | High | Contract-by-contract test gates and code search checks for legacy keyed internals | Contracts |
| Handoff failure leaves deployer with admin authority | High | Mandatory handoff step + blocking completion + explicit test assertions | Scripts/Web |
| ABI/event drift breaks indexer | Medium/High | Event delta checklist + indexer mapping updates + replay verification before merge | Contracts/Indexer |
| Cross-community privilege leakage | High | Two-community negative tests on privileged selectors and module wiring | Contracts/Tests |
| Spec/app drift in wizard states | Medium | Exact state enum contract + web tests for all transition paths | Web |
| Wizard deploy path reuses static JSON addresses | High | Enforce FR-012 + SC-008, remove static-address mutable routing, add regression tests | Web/Scripts |

## Rollback Strategy (Staging-Only)

- No data migration or mixed compatibility mode.
- On critical failure, discard staged deployment and perform full clean redeploy.
- Keep failed deployment artifacts only for diagnostics (logs/addresses), never as compatibility dependency.

## Test Strategy Mapped to Success Criteria

- SC-001: Contract-level tests for each refactor row in matrix.
- SC-002: Two-community isolation suite for privileged mutation and wiring calls.
- SC-003: Deploy integration tests validating permission bootstrap + admin handoff.
- SC-004: Wizard state-machine tests for exact sequence and restart behavior.
- SC-005: Post-handoff privileged mutation rejection tests for deployer/manager wallets.
- SC-006: Deploy path verification that no migration/backfill steps are required.
- SC-007: Merge checklist requiring zero unresolved contract/indexer/app drift items.

## ABI/Event/Indexer Impact Checkpoints

1. Contract refactor checkpoint: enumerate ABI/event changes per contract.
2. Indexer checkpoint: update `apps/indexer` schema/mappings and validate deterministic replay.
3. App checkpoint: update Manager app consumers to new ABI/event shape and role semantics.
4. Sync checkpoint: run ABI copy scripts for web and indexer consumers.

### ABI/Event Delta Checklist (T007)

- `Checkpoint A (Contracts, links: T009-T033, T047-T056)`: enumerate ABI signature changes per contract, including removed `communityId` arguments and immutable scope constructor updates.
- `Checkpoint B (Events, links: T009-T033, T047-T056)`: record event parameter changes, indexed-field changes, and any removed/renamed events that affect projections.
- `Checkpoint C (Indexer, links: T050-T056)`: update `apps/indexer` ABIs, mappings, and schema where event shape changed; verify deterministic replay from deployment `startBlock`.
- `Checkpoint D (Manager/Web, links: T039-T043, T057-T059)`: update wizard/runtime consumers to new ABI surfaces; ensure no proposal-wiring event assumptions remain.
- `Checkpoint E (ABI Sync, links: T003, T057-T059)`: run `node scripts/copy-ponder-abis.js` and `node scripts/copy-web-abis.js` and verify zero unresolved ABI drift before merge.

## Project Structure

### Documentation (this feature)

```text
specs/004-single-community-architecture/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
contracts/
test/
apps/indexer/
apps/web/
docs/
scripts/
deployments/
```

**Structure Decision**: Use monorepo vertical slices. Execute WS1-WS2 first (critical path), then WS3-WS4 in parallel where dependencies allow, and finish with WS5 synchronization.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | Yes | `contracts/modules/**`, `contracts/core/**`, `contracts/tokens/**` | Breaking ABI/event changes acceptable in staging; no compatibility mode |
| Indexer (Ponder) | Yes | `apps/indexer/src/**`, `apps/indexer/schema/**`, `apps/indexer/abis/**` | Update mappings for event shape changes; replay validation required |
| Manager App (Next.js) | Yes | `apps/web/lib/deploy/**`, `apps/web/hooks/**`, `apps/web/components/**`, tests | Replace proposal-driven wiring assumptions with bootstrap/handoff model |
| Downstream dApp Surface | Yes | ABI/event JSON outputs, deployment metadata JSON | Staging consumers must follow new ABIs; no migration guarantees |
| Documentation | Yes | `docs/EN/**`, `contracts/FEATURES.md`, project status docs | Must synchronize architecture and staging policy updates |

## Post-Design Constitution Re-Check

- Protocol infrastructure first: PASS. Shared vs per-community boundaries are explicit and align with target architecture.
- Contract-first authority: PASS. Bootstrap authority is temporary and post-handoff privileged path is timelock-only.
- Security and invariant preservation: PASS. Invariants SI-001..SI-006 are mapped to test strategy and deploy verification.
- Event-driven deterministic projection: PASS WITH ACTIONS. ABI/event checkpoints are included with indexer replay validation.
- Monorepo vertical-slice delivery: PASS. Plan includes contracts, scripts, app, indexer, tests, docs, and status synchronization.
- Compatibility discipline: PASS BY STAGING POLICY. No migration/backfill and no mixed-mode runtime are explicitly enforced.

## Complexity Tracking

No constitution violations accepted for this plan.
