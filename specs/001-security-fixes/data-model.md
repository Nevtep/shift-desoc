# Data Model — Security Fixes (Shift)

## 1) SecurityFindingWorkItem
Represents a remediation unit mapped 1:1 to an audit finding.

- **id**: string (`C-1`, `H-3`, `M-4`, etc.)
- **severityBucket**: enum (`Immediate`, `BeforeMainnet`, `PreProductionHardening`, `OperationalControls`)
- **category**: enum (`Funds`, `Authorization`, `Liveness`, `Complexity`, `Reentrancy`, `Randomness`, `Ops`)
- **contractsImpacted**: list[path]
- **definitionOfDone**: string
- **testPlan**: object
  - **unitTests**: list[string]
  - **integrationTests**: list[string]
  - **regressions**: list[string]
- **rolloutRisk**: string
- **dependencies**: list[id]

### State transitions
`Planned -> InProgress -> Implemented -> Validated -> RolledOut`

Validation rule: cannot move to `Validated` until unit + integration + regression checks pass.

## 2) SecurityInvariant
Represents protocol properties that must always hold.

- **name**: string
- **scope**: enum (`Authorization`, `Collateral`, `Settlement`, `Liveness`, `Performance`, `Reentrancy`, `Fairness`)
- **statement**: string
- **enforcedBy**: list[contract/function]
- **verifiedBy**: list[test/spec scenario]

### Critical invariants for this feature
- Timelock-only privileged mutation
- Liability-preserving emergency withdrawal
- Non-trapping settlement behavior
- Guaranteed terminal path for engagements
- Bounded execution for high-volume loops

## 3) GovernanceMigrationAction
Tracks governance/timelock actions required to apply fixes.

- **actionId**: string
- **targetContract**: path/symbol
- **changeType**: enum (`DeployPatch`, `SetModuleAddress`, `SetRole`, `SetTokenSupport`, `ParamUpdate`, `DocsSync`)
- **requiresTimelock**: bool (always true for privileged mutations)
- **preconditions**: list[string]
- **postconditions**: list[string]
- **rollbackPlan**: string

### State transitions
`Prepared -> Queued -> Executed -> Verified`

## 4) OperationalSafeguardControl
For Design-Awareness items D-1 and D-2 (no functional change).

- **controlId**: string (`D-1`, `D-2`)
- **objective**: string
- **metricSignal**: string
- **alertThreshold**: string
- **ownerRole**: string
- **runbookPath**: path
- **verificationProcedure**: string

### State transitions
`Defined -> Instrumented -> AlertTested -> Operational`

## 5) AcceptanceScenario
Executable acceptance definition per work item.

- **scenarioId**: string
- **workItemId**: string
- **type**: enum (`Primary`, `EdgeCase`)
- **given**: string
- **when**: string
- **then**: string
- **evidence**: test name / output artifact

Validation rule: each SecurityFindingWorkItem must have >=1 Primary scenario and >=1 EdgeCase scenario.

## Finding-to-Test Traceability

| Finding | Unit/Targeted Tests | Integration/Regression Coverage |
|---|---|---|
| C-1 | `RevenueRouterCohort.t.sol`, `CohortRegistry.t.sol` | `MarketplaceRevenueRouter.t.sol` fund-flow regression |
| C-2 | `CommunityToken.t.sol` | Staging emergency-withdraw replay checklist |
| C-3 | `RequestHub.t.sol` | Request completion + payout integration scenario |
| H-1 | `Engagements.t.sol` (expired resolver) | Lifecycle submit-vote-expire-resolve scenario |
| H-2 | `Engagements.t.sol` (selection failure revert) | Integration path asserting no silent fallback |
| H-3 | `Engagements.t.sol` (`jurorsMin` threshold) | End-to-end verification threshold regression |
| H-4 | `MarketplaceRevenueRouter.t.sol`, `MarketplaceDisputes.t.sol` | Non-trapping settlement path under unsupported routing token |
| H-5 | `RequestHub.t.sol` (day-boundary reset) | Rate-limit day-boundary integration scenario |
| M-1 | `VerifierManager.t.sol` entropy anti-timing tests | Fairness regression across entropy windows |
| M-2 | `Engagements.t.sol` bounded gas-trend test | Full-suite/cov gate to detect performance drift |
| M-3 | `ValuableActionRegistry.t.sol` auth tests | Governance path + unauthorized moderator regression |
| M-4 | `MarketplaceHousing.t.sol` reentrancy attack tests | Housing staking/unstaking integration scenario |
| M-5 | `MarketplaceHousing.t.sol` max-stay tests | Reservation boundary integration scenario |
| D-1 | `scripts/check-balance.ts` helper checks | `docs/EN/guides/security-runbook-d1.md` drill |
| D-2 | `scripts/check-claim-status.ts` anomaly checks | `docs/EN/guides/security-runbook-d2.md` drill |
