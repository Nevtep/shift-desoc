# Contracts & Interface Plan — Security Fixes (Shift)

## Scope
Contract-level deltas and integration points required by the Security Fixes implementation plan.

## Remediation Tracking Matrix

| Finding | Severity Bucket | Category | Primary Contracts | Status | Primary Tests |
|---|---|---|---|---|---|
| C-1 | Immediate | Funds | `ICohortRegistry`, `CohortRegistry`, `RevenueRouter` | Implemented/Validated | `RevenueRouterCohort.t.sol`, `CohortRegistry.t.sol` |
| C-2 | BeforeMainnet | Funds | `CommunityToken` | Implemented/Validated | `CommunityToken.t.sol` |
| C-3 | BeforeMainnet | Funds | `RequestHub` | Implemented/Validated | `RequestHub.t.sol` |
| H-1 | BeforeMainnet | Liveness | `Engagements` | Implemented/Validated | `Engagements.t.sol` |
| H-2 | BeforeMainnet | Liveness | `Engagements` | Implemented/Validated | `Engagements.t.sol` |
| H-3 | BeforeMainnet | Correctness | `Engagements` | Implemented/Validated | `Engagements.t.sol` |
| H-4 | PreProductionHardening | Settlement | `Marketplace` | Implemented/Validated | `MarketplaceRevenueRouter.t.sol`, `MarketplaceDisputes.t.sol` |
| H-5 | BeforeMainnet | Liveness | `RequestHub` | Implemented/Validated | `RequestHub.t.sol` |
| M-1 | PreProductionHardening | Randomness | `VerifierManager` | Implemented/Validated | `VerifierManager.t.sol` |
| M-2 | PreProductionHardening | Performance | `Engagements` | Implemented/Validated | `Engagements.t.sol` |
| M-3 | BeforeMainnet | Authorization | `ValuableActionRegistry` | Implemented/Validated | `ValuableActionRegistry.t.sol` |
| M-4 | PreProductionHardening | Reentrancy | `HousingManager` | Implemented/Validated | `MarketplaceHousing.t.sol` |
| M-5 | PreProductionHardening | Availability | `HousingManager` | Implemented/Validated | `MarketplaceHousing.t.sol` |
| D-1 | OperationalControls | Ops | docs + scripts | InProgress | runbook + helper script |
| D-2 | OperationalControls | Ops | docs + scripts | InProgress | runbook + helper script |

## Contract/Interface Change Map

## Immediate
1. **C-1**
- `contracts/modules/interfaces/ICohortRegistry.sol`
- `contracts/modules/CohortRegistry.sol`
- `contracts/modules/RevenueRouter.sol`
- **Goal**: selector-compatible cohort weight lookup for active cohort revenue routing.

## Before mainnet
2. **C-2**
- `contracts/tokens/CommunityToken.sol`
- **Goal**: enforce collateral liability floor in emergency withdrawal path.

3. **C-3**
- `contracts/modules/RequestHub.sol`
- **Goal**: atomic payout + engagement completion semantics.

4. **H-1 / H-2 / H-3 / M-2**
- `contracts/modules/Engagements.sol`
- **Goal**: deterministic liveness, threshold correctness, bounded active-count checks.

5. **H-5**
- `contracts/modules/RequestHub.sol`
- **Goal**: period-based rate-limit reset.

6. **M-3**
- `contracts/modules/ValuableActionRegistry.sol`
- **Goal**: timelock-only privileged mutations.

## Pre-production hardening
7. **H-4**
- `contracts/modules/Marketplace.sol`
- `contracts/modules/RevenueRouter.sol`
- **Goal**: deterministic settlement without trapped escrow under token routing incompatibility.

8. **M-1**
- `contracts/modules/VerifierManager.sol`
- (seed call path in `contracts/modules/Engagements.sol` if needed)
- **Goal**: stronger anti-manipulation selection entropy.

9. **M-4 / M-5**
- `contracts/modules/HousingManager.sol`
- **Goal**: reentrancy protection + bounded booking window.

## Governance / Migration Actions
- Queue and execute changes through governor/timelock.
- Re-wire module addresses if upgraded module deployments are used.
- Validate role permissions post-upgrade (especially for M-3).
- Sync ABIs for indexer/web consumers after interface/event changes.

### Governance Migration Action Checklist

- [ ] Prepare calldata for each privileged mutation and map to finding IDs.
- [ ] Confirm `ShiftGovernor -> TimelockController -> target` path for every privileged change.
- [ ] Queue timelock operations in severity order: Immediate -> BeforeMainnet -> PreProductionHardening.
- [ ] Execute queued operations after delay and verify emitted events + state deltas.
- [ ] Confirm no direct owner/operator bypass remains for privileged mutations.
- [ ] Re-validate `ParamController` wiring and policy reads after module updates.
- [ ] Re-validate `TreasuryAdapter` guardrails (weekly cap, 10% cap, allowlist, pause path).
- [ ] Run ABI sync and dependent app/indexer checks before staging sign-off.

## Required Test Surfaces
- `test/RevenueRouterCohort.t.sol`
- `test/CommunityToken.t.sol`
- `test/RequestHub.t.sol`
- `test/Engagements.t.sol`
- `test/ValuableActionRegistry.t.sol`
- `test/MarketplaceRevenueRouter.t.sol`
- `test/MarketplaceDisputes.t.sol`
- `test/VerifierManager.t.sol`
- `test/MarketplaceHousing.t.sol`

## Non-Functional Contract Constraints
- Preserve timelock authority model.
- No staking-based verifier eligibility introduced.
- No behavior changes for D-1/D-2; controls are operational/documentation only.
