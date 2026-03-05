# Security Closeout Evidence Bundle (001-security-fixes)

Date: 2026-03-05
Feature: `specs/001-security-fixes/spec.md`
Checklist: `specs/001-security-fixes/checklists/security-closeout.md`

## 1) Finding-to-Code/Test Trace Matrix

| Finding | Code Evidence | Test Evidence |
|---------|---------------|---------------|
| C-1 | `contracts/modules/interfaces/ICohortRegistry.sol`, `contracts/modules/CohortRegistry.sol`, `contracts/modules/RevenueRouter.sol` | `test/CohortRegistry.t.sol`, `test/RevenueRouterCohort.t.sol` |
| C-2 | `contracts/tokens/CommunityToken.sol` | `test/CommunityToken.t.sol` |
| C-3 | `contracts/modules/RequestHub.sol` | `test/RequestHub.t.sol` |
| H-1 | `contracts/modules/Engagements.sol` (`resolveExpired`) | `test/Engagements.t.sol` |
| H-2 | `contracts/modules/Engagements.sol` (submit revert on juror select fail) | `test/Engagements.t.sol` |
| H-3 | `contracts/modules/Engagements.sol` (`jurorsMin` threshold) | `test/Engagements.t.sol` |
| H-4 | `contracts/modules/Marketplace.sol` (fallback settlement path) | `test/MarketplaceRevenueRouter.t.sol`, `test/MarketplaceDisputes.t.sol` |
| H-5 | `contracts/modules/RequestHub.sol` (daily counter reset) | `test/RequestHub.t.sol` |
| M-2 | `contracts/modules/Engagements.sol` (active counters) | `test/Engagements.t.sol` |
| M-3 | `contracts/modules/ValuableActionRegistry.sol` (`restricted` gates) | `test/ValuableActionRegistry.t.sol` |
| M-4 | `contracts/modules/HousingManager.sol` (`ReentrancyGuard` + `nonReentrant`) | `test/MarketplaceHousing.t.sol` |
| M-5 | `contracts/modules/HousingManager.sol` (`MAX_STAY_NIGHTS`) | `test/MarketplaceHousing.t.sol` |
| M-1 | `contracts/modules/VerifierManager.sol` (entropy hardening path) | `test/VerifierManager.t.sol` |

## 2) Governance/Authorization Evidence

- Privileged-path policy is defined in `specs/001-security-fixes/spec.md` (`FR-008`) and `specs/001-security-fixes/plan.md` (Constitution Check).
- Authorization boundary test coverage is tracked in `test/ValuableActionRegistry.t.sol` and `test/Engagements.t.sol`.

## 3) ABI Sync Evidence

- ABI sync commands required by release gate:
  - `node scripts/copy-ponder-abis.js`
  - `node scripts/copy-web-abis.js`
- Validation workflow recorded in `specs/001-security-fixes/quickstart.md`.

## 4) Rollout and Recovery Evidence

- Staging replay and migration validation checklists are in `specs/001-security-fixes/quickstart.md`.
- Final rollout notes tracked in `.github/project-management/STATUS_REVIEW.md`.

## 5) M-1 Closeout Decision Record

- Decision: `RESIDUAL_RISK_ACCEPTED`
- Reason: entropy hardening was implemented and regression-tested, but no VRF/commit-reveal upgrade is currently in this scope; timing-manipulation risk is reduced but not eliminated to cryptographic unpredictability level.
- Owner: Protocol Governance (Governor/Timelock authority)
- Approval Authority: Security/Governance signoff via standard governance process and release review.
- Compensating Controls:
  - Quantitative thresholds and methodology codified in `specs/001-security-fixes/spec.md`.
  - Periodic fairness regression re-runs and staging replay checks from `specs/001-security-fixes/quickstart.md`.

## 6) Command/Test Proof (Latest)

- Targeted regression command used during closeout validation:
  - `pnpm forge:test --match-contract 'CommunityTokenTest|RequestHubTest|EngagementsTest|CohortRegistryTest|HousingManagerTest|RevenueRouterCohortTest'`
- Result reference: previously validated pass run in this feature workflow; full-suite/coverage gate remains required by release checklist.
