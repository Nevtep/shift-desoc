# Implementation Plan: Security Fixes (Shift)

**Branch**: `001-security-fixes` | **Date**: 2026-02-15 | **Spec**: `/specs/001-security-fixes/spec.md`
**Input**: Feature specification from `/specs/001-security-fixes/spec.md`

## Summary

Implement a security-first remediation program for all CRITICAL/HIGH/MEDIUM findings from `contracts/SECURITY_AUDIT.md` plus ops controls for Design-Awareness items. Execution order is severity-driven with dependency edges enforced (authority model and financial invariants first), followed by liveness/correctness, hardening, and operational safeguards.

## Technical Context

**Language/Version**: Solidity `^0.8.24`, TypeScript (ops/deploy/test scripts), Node 22  
**Primary Dependencies**: OpenZeppelin 5.x (`AccessManaged`, `ReentrancyGuard`, `SafeERC20`), Foundry, Hardhat 2.22.x  
**Storage**: EVM on-chain contract storage + JSON deployments under `deployments/`  
**Testing**: Foundry Solidity tests in `test/*.t.sol`; TS e2e tests in `test/*.test.ts`  
**Target Platform**: Base Sepolia staging now; Base mainnet pre-launch target  
**Project Type**: Smart-contract monorepo with web/indexer consumers  
**Performance Goals**: Preserve settlement/revenue liveness; bound gas for engagement and housing flows  
**Constraints**: Timelock-only privileged mutations, no verifier staking model, no behavior changes for D-1/D-2  
**Scale/Scope**: 13 code remediation items + 2 ops-control items across modules/tokens/interfaces/docs/tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- `.specify/memory/constitution.md` contains placeholder template text (no ratified enforceable principles).
- Enforced gates for this plan therefore derive from repo operating manual and spec invariants:
  - Timelock/governance authority is the only privileged mutation path.
  - Verifier model remains governance-controlled (no staking/bonding introduction).
  - Commerce disputes remain separated from work verification logic.
  - Treasury/backing guardrails cannot be bypassed.

**Gate Status (Pre-Phase 0)**: PASS (no constitutional contradiction detected)

**Gate Status (Post-Phase 1 Design)**: PASS (design artifacts preserve all listed invariants)

## Project Structure

### Documentation (this feature)

```text
specs/001-security-fixes/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── security-fixes-contracts.md
└── tasks.md             # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
contracts/
├── modules/
│   ├── CohortRegistry.sol
│   ├── Engagements.sol
│   ├── HousingManager.sol
│   ├── Marketplace.sol
│   ├── RequestHub.sol
│   ├── RevenueRouter.sol
│   ├── ValuableActionRegistry.sol
│   ├── VerifierManager.sol
│   └── interfaces/ICohortRegistry.sol
├── tokens/
│   └── CommunityToken.sol
└── FEATURES.md

test/
├── CohortRegistry.t.sol
├── CommunityToken.t.sol
├── Engagements.t.sol
├── HousingManager*.t.sol
├── Marketplace*.t.sol
├── RequestHub.t.sol
├── RevenueRouterCohort.t.sol
└── ValuableActionRegistry.t.sol

docs/EN/
├── Architecture.md
├── Whitepaper.md
└── contracts/
```

**Structure Decision**: Contract-first remediation with test updates in existing Foundry suite and mandatory docs sync under `docs/EN/` and `contracts/FEATURES.md`.

## Phase 0: Research & Decisions

All ambiguities were resolved; no `NEEDS CLARIFICATION` items remain.

Decision records are documented in `research.md` and include:
- C-1 signature alignment approach
- C-2 collateral floor invariant definition
- C-3 payout atomicity source-of-funds behavior
- H-4 deterministic settlement fallback strategy
- M-1 practical entropy hardening approach
- Ops controls for D-1 and D-2 without behavior change

## Phase 1: Design Artifacts

- `data-model.md`: security invariants, governance action model, test-case model, and ops-control model.
- `contracts/security-fixes-contracts.md`: interface/contract delta and governance migration call sequencing.
- `quickstart.md`: exact command flow for targeted tests, full regression, ABI sync, and rollout validation.

## Implementation Sequence (Phase 2 Planning)

### Dependency Edges (must respect order)

1. **Authority & invariant safety first**: C-1, C-2, M-3
2. **Fund flow correctness**: C-3, H-4
3. **Verification liveness/correctness**: H-1, H-2, H-3, M-2
4. **Hardening controls**: M-4, M-5, M-1
5. **Operational controls + documentation**: D-1, D-2, FR-016 docs sync

### Immediate (blocks usage)

1) **C-1 Selector mismatch**  
  - **Impacted contracts**: `contracts/modules/interfaces/ICohortRegistry.sol`, `contracts/modules/CohortRegistry.sol`, `contracts/modules/RevenueRouter.sol`  
  - **Definition of done**: Revenue routing with active cohorts no longer reverts due to ABI mismatch  
  - **Tests**: Update/add `test/RevenueRouterCohort.t.sol` and `test/CohortRegistry.t.sol` selector-compat regression  
  - **Risk/Rollout**: Low code risk, high blast radius if wrong ABI; deploy only after staging revenue route replay

### Before mainnet

2) **C-2 Emergency withdrawal liability floor**  
  - **Impacted**: `contracts/tokens/CommunityToken.sol`  
  - **DoD**: Emergency withdrawal cannot reduce collateral below outstanding redeemable obligations  
  - **Tests**: `test/CommunityToken.t.sol` (reject undercollateralizing withdrawal, allow surplus-only)  
  - **Risk/Rollout**: Medium; ensure governance emergency procedures account for new bound

3) **C-3 Atomic bounty payout on completion**  
  - **Impacted**: `contracts/modules/RequestHub.sol` (+ possible treasury allowance assumptions)  
  - **DoD**: Successful completion mints SBT and transfers bounty atomically, or reverts fully  
  - **Tests**: `test/RequestHub.t.sol` payout success/failure atomicity regression  
  - **Risk/Rollout**: Medium-high; depends on allowance flow and token behavior

4) **H-1 Expired engagement resolution**  
  - **Impacted**: `contracts/modules/Engagements.sol`  
  - **DoD**: Any expired pending engagement can transition to terminal state and free participant slot  
  - **Tests**: `test/Engagements.t.sol` timeout resolution and concurrency release  
  - **Risk/Rollout**: Medium; ensure no unintended revocation side effects

5) **H-2 Revert on juror selection failure**  
  - **Impacted**: `contracts/modules/Engagements.sol`  
  - **DoD**: Failed juror selection causes submit revert with no persisted engagement  
  - **Tests**: `test/Engagements.t.sol` mocked selection failure path  
  - **Risk/Rollout**: Low-medium; availability now depends on verifier selection availability

6) **H-3 Use `jurorsMin` threshold**  
  - **Impacted**: `contracts/modules/Engagements.sol`, `contracts/modules/ValuableActionRegistry.sol` (read path only)  
  - **DoD**: Verification resolution respects action-configured threshold  
  - **Tests**: `test/Engagements.t.sol` multi-threshold matrix (1-of-N, M-of-N, N-of-N)  
  - **Risk/Rollout**: Medium; behavior change can alter prior expected outcomes

7) **H-5 Daily rate-limit reset correctness**  
  - **Impacted**: `contracts/modules/RequestHub.sol`  
  - **DoD**: User can post again after period rollover; intra-day cap still enforced  
  - **Tests**: `test/RequestHub.t.sol` day-boundary, first-post, and cap tests  
  - **Risk/Rollout**: Low

8) **M-3 Timelock-only update/deactivate**  
  - **Impacted**: `contracts/modules/ValuableActionRegistry.sol`  
  - **DoD**: Moderator-only bypass removed; only governance authority succeeds  
  - **Tests**: `test/ValuableActionRegistry.t.sol` authorization regression tests  
  - **Risk/Rollout**: Medium; requires governance role path verified in staging

### Pre-production hardening

9) **H-4 Non-trapping settlement for unsupported router token**  
  - **Impacted**: `contracts/modules/Marketplace.sol`, `contracts/modules/RevenueRouter.sol`  
  - **DoD**: Settlement resolves deterministically even when router token unsupported (pre-check/fallback)  
  - **Tests**: `test/MarketplaceRevenueRouter.t.sol`, `test/MarketplaceDisputes.t.sol` unsupported token scenarios  
  - **Risk/Rollout**: Medium-high; verify accounting consistency between routed and fallback settlements

10) **M-1 Juror selection entropy hardening**  
  - **Impacted**: `contracts/modules/VerifierManager.sol`, `contracts/modules/Engagements.sol` (seed call path)  
  - **DoD**: Selection entropy cannot be materially biased by simple timing control in defined threat model  
  - **Tests**: Statistical regression harness in `test/VerifierManager.t.sol` + seed reproducibility checks  
  - **Risk/Rollout**: Medium; avoid introducing liveness regressions

11) **M-2 Bounded active engagement checks**  
  - **Impacted**: `contracts/modules/Engagements.sol`  
  - **DoD**: Submit path complexity independent of full historical list length  
  - **Tests**: `test/Engagements.t.sol` gas trend regression under large history  
  - **Risk/Rollout**: Medium; requires careful state-counter consistency on all terminal transitions

12) **M-4 Reentrancy guard in housing stake/unstake**  
  - **Impacted**: `contracts/modules/HousingManager.sol`  
  - **DoD**: Reentrant callbacks cannot re-enter protected fund-moving paths  
  - **Tests**: `test/MarketplaceHousing.t.sol` + malicious token mock reentrancy tests  
  - **Risk/Rollout**: Low-medium

13) **M-5 Bounded reservation duration/loop costs**  
  - **Impacted**: `contracts/modules/HousingManager.sol`  
  - **DoD**: Accepted reservation windows remain bounded; over-limit requests reject deterministically  
  - **Tests**: boundary tests around max stay and gas-bound assertions  
  - **Risk/Rollout**: Medium; product behavior change for long stays requires communication

### Operational controls (no functional behavior change)

14) **D-1 Under-collateralization monitoring/runbook**  
  - **Impacted artifacts**: `docs/EN/Architecture.md`, `docs/EN/guides/*`, runbook docs; optional monitoring scripts in `scripts/`  
  - **DoD**: Documented mint+deposit governance procedure, backing-ratio alert thresholds, owner/on-call responsibilities  
  - **Validation**: tabletop runbook test + alert trigger dry run  
  - **Risk/Rollout**: Operational discipline dependent

15) **D-2 Position-claim behavior monitoring/runbook**  
  - **Impacted artifacts**: docs + monitoring queries/scripts for anomalous claim source detection  
  - **DoD**: Authorized issuance path documented; alerting for non-standard claim patterns and response SOP defined  
  - **Validation**: simulated anomaly detection test  
  - **Risk/Rollout**: Monitoring blind spots if indexer/event rules are incomplete

## Upgrade / Migration / Governance Execution Plan

1. Deploy patched contracts on Base Sepolia staging (or upgrade module addresses where architecture uses registry-swappable modules).
2. Execute governance-timelock actions in this order:
  - Module/interface wiring for C-1 compatibility
  - ValuableActionRegistry authorization boundary update (M-3)
  - CommunityToken invariant protections (C-2)
  - RequestHub payout/rate-limit fixes (C-3, H-5)
  - Engagements liveness/correctness updates (H-1/H-2/H-3/M-2)
  - Marketplace/Housing/Verifier hardening (H-4/M-1/M-4/M-5)
3. Update deployment JSON files and ABI sync:
  - `node scripts/copy-ponder-abis.js`
  - `node scripts/copy-web-abis.js`
4. Validate downstream consumers (apps/indexer, apps/web) for ABI/event impacts.
5. Update `contracts/FEATURES.md`, `docs/EN/Architecture.md`, and `docs/EN/Whitepaper.md` where behavior/security posture changed.

## Test & Validation Strategy

- **Targeted first**: run only contract-specific tests for each remediation item.
- **Then broad**: `pnpm forge:test`, `pnpm forge:cov`, `pnpm cov:gate` (>=86%).
- **Integration**: marketplace↔router, requesthub bounty completion, engagements lifecycle, governance authorization paths.
- **Regression focus**: each finding receives at least one fail-before / pass-after regression test.

## Complexity Tracking

No constitution violations identified requiring exception handling.

## Risk Sign-Off Checklist

- [ ] Authorization: Timelock/governance-only privileged mutations validated; no bypass path introduced.
- [ ] Funds safety: Emergency withdrawal liability floor and settlement non-trapping invariants validated.
- [ ] Liveness: Engagement lifecycle has deterministic terminal paths under failure/expiry conditions.
- [ ] Reentrancy/DoS: Housing staking flows guarded; reservation windows bounded; high-volume paths remain bounded.
- [ ] Fairness/manipulation: Verifier entropy path hardened and regression-tested against timing sensitivity.
- [ ] Cross-module invariants: ParamController remains policy source; commerce/work-verification separation preserved.
- [ ] Operational controls: D-1/D-2 runbooks and helper scripts documented and runnable.
- [ ] Delivery readiness: ABI sync complete; `forge:test`, `forge:cov`, and `cov:gate` green.
