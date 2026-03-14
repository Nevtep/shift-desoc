# Feature Specification: Single-Community Architecture Refactor (Base Sepolia Staging)

**Feature Branch**: `004-single-community-architecture`  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: User description: "Single-Community Architecture Refactor (Base Sepolia Staging)"

## User Scenarios & Testing *(mandatory)*

### Primary Objective

This feature's main objective is to refactor each deploy stack contract to a single-community internal model. Deploy wizard and permission handoff requirements are supporting objectives that enable safe rollout and verification.

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Refactor Deploy Stack Contracts (Priority: P1)

As protocol maintainers, we can refactor each deploy stack contract from multi-community internals to single-community internals, so the architecture is coherent, auditable, and aligned with per-community deployment.

**Why this priority**: This is the core architectural objective and highest-impact scope item for this feature.

**Independent Test**: Can be independently tested by validating each contract in the refactor matrix has merged single-community internals and passing contract-level tests.

**Acceptance Scenarios**:

1. **Given** a contract listed in the deploy stack refactor matrix, **When** refactor is complete, **Then** core internal state is single-community and no multi-community keyed internal path is required.
2. **Given** all contracts in the deploy stack matrix, **When** test suite runs, **Then** each contract has passing unit or integration tests proving refactored behavior.
3. **Given** two independently deployed communities, **When** privileged action is attempted across community boundaries, **Then** action fails and authority remains isolated.

---

### User Story 2 - Deploy New Community Safely (Priority: P2)

As a community manager, I can deploy a full community stack where the deployer configures permissions in the local AccessManager during deployment and then hands off admin authority to the community timelock, so post-deploy privileged changes are governance-only.

**Why this priority**: This is the core risk and usability path. If this fails, deployment is blocked or unsafe.

**Independent Test**: Can be fully tested by running a fresh deploy in Base Sepolia staging and verifying permissions are configured at deploy time, admin is handed off to timelock, and post-deploy restricted changes require governance.

**Acceptance Scenarios**:

1. **Given** no prior dependency on old staged deployments, **When** manager starts a fresh deploy, **Then** wizard progresses through defined states and applies permission wiring in the community-local AccessManager.
2. **Given** deploy-time wiring is completed, **When** admin handoff runs, **Then** AccessManager admin is assigned to the community timelock.
3. **Given** deploy is finalized, **When** manager wallet attempts restricted mutation, **Then** mutation is rejected and governance/timelock path is required.

---

### User Story 3 - Operate Clear Wizard State Machine (Priority: P3)

As a manager, I can see a strict deploy state contract with no ambiguous or mixed-mode states, so I always know whether I must sign, wait for governance, or verify results.

**Why this priority**: Prevents operator error and race-condition confusion during staged deployments.

**Independent Test**: Can be independently tested by driving wizard through success, unauthorized, cancellation, and restart paths and validating state transitions.

**Acceptance Scenarios**:

1. **Given** deploy started, **When** stack deployment completes, **Then** wizard enters `CONFIGURE_ACCESS_PERMISSIONS`.
2. **Given** permission setup succeeds, **When** handoff runs, **Then** wizard enters `HANDOFF_ADMIN_TO_TIMELOCK` and completes admin transfer.
3. **Given** user starts a new deploy, **When** previous run exists, **Then** old run state is not resumed unless user explicitly selects resume.

---

### User Story 4 - Remove Legacy Coupling in Staging (Priority: P4)

As protocol maintainers, we can remove staging assumptions tied to old deployments, so clean-slate redeploy remains the default operating mode for Base Sepolia.

**Why this priority**: This protects delivery speed and keeps the refactor unconstrained by compatibility baggage.

**Independent Test**: Can be independently tested by running deploy flows without migration/backfill steps and validating no legacy dependency is required.

**Acceptance Scenarios**:

1. **Given** a fresh staged environment, **When** deployment is executed, **Then** no migration step is required.
2. **Given** previous staged deployments exist, **When** new deployment runs, **Then** old state is not required for correctness.

---

### Edge Cases

- Manager rejects signature during `DEPLOY_STACK`: wizard records failure reason and allows retry from current safe boundary.
- Manager rejects signature during `CONFIGURE_ACCESS_PERMISSIONS`: wizard records failure reason and preserves deterministic retry from permission step.
- Admin handoff to timelock fails: wizard blocks completion and marks deployment as non-finalized until handoff succeeds.
- Multiple browser sessions trigger deploy actions: only one active run can advance state for a session at a time.
- Contract wiring partially completes before a revert: verification detects incomplete wiring and reports exact missing links.
- Old staging addresses are present in local cache: new deploy ignores them unless explicitly selected for read-only inspection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Architecture MUST be consistent with per-community deployment such that each community has isolated governance authority and module-local state.
- **FR-002**: Each community deployment MUST instantiate its own `AccessManager`, `ParamController`, `ShiftGovernor`, and `TimelockController`.
- **FR-003**: Per-community deployed modules MUST use single-community internals and MUST NOT depend on multi-community keyed internal state for core operations.
- **FR-004**: Deploy Wizard MUST implement the following explicit state contract: `PRECHECKS`, `DEPLOY_STACK`, `CONFIGURE_ACCESS_PERMISSIONS`, `HANDOFF_ADMIN_TO_TIMELOCK`, `VERIFY_DEPLOYMENT`.
- **FR-005**: Deploy-time permission wiring MAY be executed by deployer in the community-local `AccessManager`, but post-deploy restricted changes MUST be executable only via community governance through timelock authority.
- **FR-006**: System MUST prevent cross-community authority leakage; governance authority from one community MUST NOT mutate privileged state in another community deployment.
- **FR-007**: Base Sepolia staging flow MUST assume clean-slate redeploy behavior and MUST NOT require backward compatibility or migration of prior staged state.
- **FR-008**: Refactor scope MUST include explicit contract-level task definitions for every contract identified for single-community internal conversion.
- **FR-009**: Implementation delivery MUST be complete for targeted refactor scope; no placeholder or stub runtime paths are allowed in deploy and wiring flows.
- **FR-010**: Deployment verification MUST report deterministic pass/fail outputs for contract wiring, role assignment, and policy invariants.
- **FR-011**: `CommunityRegistry` MUST NOT depend on `AccessManaged`; it MUST enforce authorization through explicit internal security checks and community-scoped validation guards.

### Deploy Wizard Screen/UX Contract

- **UX-001 `PRECHECKS`**: Validate wallet connectivity, network, required inputs, and session freshness before any transaction intent is generated.
- **UX-002 `DEPLOY_STACK`**: Execute deployment of required contracts for the new community and persist deployed addresses for this run.
- **UX-003 `CONFIGURE_ACCESS_PERMISSIONS`**: Apply per-selector permission and role wiring in community-local `AccessManager`.
- **UX-004 `HANDOFF_ADMIN_TO_TIMELOCK`**: Transfer `AccessManager` admin authority from deployer bootstrap authority to community timelock.
- **UX-005 `VERIFY_DEPLOYMENT`**: Verify role wiring, module references, and authorization invariants after admin handoff is confirmed.
- **UX-006**: Wizard transitions MUST be one-way for a run except explicit restart from `PRECHECKS`.
- **UX-007**: Restarting a deploy MUST create a fresh run context unless user explicitly selects resume.

### Contract Boundary Matrix (Target-State)

| Boundary | Contract | Target Classification | Required Action |
|---|---|---|---|
| Per-community | `AccessManager` | Per-community authority router | Deploy one per community, bootstrap permissions at deploy time, then hand off admin to local timelock |
| Shared | `CommunityRegistry` | Shared registry | Keep shared, retain registration and metadata index responsibilities, enforce explicit internal auth checks (no `AccessManaged`) |
| Per-community | `ParamController` | Per-community policy oracle | Deploy one per community and enforce local governance-timelock authority model |
| Per-community | `ShiftGovernor` | Per-community | Deploy one per community and wire only to local timelock/token |
| Per-community | `TimelockController` | Per-community | Deploy one per community and use as sole privileged executor |
| Per-community | `MembershipTokenERC20Votes` | Per-community | Keep local governance token authority wiring only |
| Per-community | `RequestHub` | Per-community | Refactor internals to single-community state model |
| Per-community | `DraftsManager` | Per-community | Refactor internals to single-community state model |
| Per-community | `ValuableActionRegistry` | Per-community | Refactor internals to single-community state model |
| Per-community | `Engagements` | Per-community | Refactor internals to single-community state model |
| Per-community | `CredentialManager` | Per-community | Refactor internals to single-community state model |
| Per-community | `PositionManager` | Per-community | Refactor internals to single-community state model |
| Per-community | `ValuableActionSBT` | Per-community | Refactor internals to single-community state model |
| Per-community | `VerifierPowerToken1155` | Per-community | Refactor internals to single-community state model |
| Per-community | `VerifierElection` | Per-community | Refactor internals to single-community state model |
| Per-community | `VerifierManager` | Per-community | Refactor internals to single-community state model |
| Per-community | `CommunityToken` | Per-community | Refactor internals to single-community state model |
| Per-community | `CohortRegistry` | Per-community | Refactor internals to single-community state model |
| Per-community | `RevenueRouter` | Per-community | Refactor internals to single-community state model |
| Per-community | `TreasuryAdapter` | Per-community | Refactor internals to single-community state model |
| Per-community | `InvestmentCohortManager` | Per-community | Refactor internals to single-community state model |
| Per-community | `Marketplace` | Per-community | Refactor internals to single-community state model |
| Per-community | `CommerceDisputes` | Per-community | Refactor internals to single-community state model |
| Per-community | `HousingManager` | Per-community | Refactor internals to single-community state model |
| Per-community | `ProjectFactory` | Per-community | Refactor internals to single-community state model |

### Security Invariants

- **SI-001**: After admin handoff is completed, all privileged mutations MUST execute via local community timelock authority.
- **SI-002**: Deployer wallet may execute bootstrap permission wiring only before admin handoff; after handoff, direct restricted writes by deployer/manager wallet MUST fail.
- **SI-003**: No cross-community authority leakage is permitted across independently deployed communities.
- **SI-004**: TreasuryAdapter guardrails remain enforced under refactor (frequency, percentage cap, allowlist, emergency controls).
- **SI-005**: Verification authority remains governance-controlled (no staking/bonding reintroduction).
- **SI-006**: `CommunityRegistry` authorization MUST be enforced by explicit internal guards (`require`/custom reverts) and MUST NOT rely on `AccessManaged` policy wiring.

### Base Sepolia Staging Policy Statement

- **SP-001**: Base Sepolia staging explicitly requires no legacy support.
- **SP-002**: Base Sepolia staging explicitly requires no incremental migration path.
- **SP-003**: Core architecture changes in staging are expected to use full clean-slate redeploy.
- **SP-004**: Any requirement conflicting with `SP-001` to `SP-003` is out of scope for this feature.

### Contract Refactor Task Plan (Per Contract)

Priority rule: Completion of this table is the main delivery objective of the feature. Wizard and deployment orchestration work is considered complete only if it supports successful delivery and verification of all rows below.

| Contract | Refactor Task | Completion Evidence |
|---|---|---|
| `RequestHub` | Remove internal multi-community keyed state from core request/comment lifecycle | Unit tests prove behavior without `communityId` keyed internals |
| `DraftsManager` | Convert draft lifecycle internals to single-community state | Unit tests for create/review/escalate in local scope |
| `ValuableActionRegistry` | Convert action definitions and issuance internals to single-community model | Unit tests for create/activate/issue paths |
| `Engagements` | Convert engagement storage and verification internals to single-community model | Unit + integration tests for submit/verify/resolve/appeal |
| `CredentialManager` | Convert course/application internals to single-community model | Unit tests for define/apply/approve/revoke |
| `PositionManager` | Convert position type/application internals to single-community model | Unit tests for define/apply/approve/close |
| `ValuableActionSBT` | Convert token metadata/accounting internals to single-community model | Unit tests for issuance/revocation and token kind invariants |
| `VerifierPowerToken1155` | Convert verifier power internals to single-community deployment model | Unit tests for mint/burn/transfer restrictions |
| `VerifierElection` | Convert roster and election internals to single-community model | Unit tests for set/remove/ban/unban flows |
| `VerifierManager` | Convert juror selection internals to single-community model | Unit tests for panel selection and fraud reporting |
| `CommunityToken` | Convert treasury/payment internals to single-community model | Unit tests for mint/redeem/treasury paths |
| `CohortRegistry` | Convert cohort internals to single-community model | Unit tests for create/invest/recovery/close |
| `RevenueRouter` | Convert distribution internals to single-community model | Unit + integration tests for routing and claims |
| `TreasuryAdapter` | Convert treasury control internals to single-community model | Unit tests for guardrails and emergency flows |
| `InvestmentCohortManager` | Convert investment issuance internals to single-community model | Unit tests for cohort create/issue/activate |
| `Marketplace` | Convert offer/order internals to single-community model | Unit + integration tests for purchase/settle/dispute |
| `CommerceDisputes` | Convert dispute internals to single-community model | Unit tests for open/finalize and receiver callbacks |
| `HousingManager` | Convert housing inventory/reservation internals to single-community model | Unit tests for quote/consume/settlement callbacks |
| `ProjectFactory` | Convert project/crowdfunding internals to single-community model | Unit tests for create/activate/milestone-related flows |

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Feature spec MUST identify impact across contracts, indexer,
  Manager app, tests, and documentation.
- **MR-002**: If contract interfaces or event schemas change, spec MUST define
  compatibility expectations for the indexer and downstream dApps in staging.
- **MR-003**: Spec MUST state how derived/indexed state maps back to canonical
  on-chain state and events without introducing shadow authority.
- **MR-004**: Spec MUST define role/authority implications for privileged flows
  and confirm Governor/Timelock governance path expectations.
- **MR-005**: Manager UI requirements MUST map to actual implemented contract
  capabilities and MUST NOT rely on aspirational protocol behavior.

### Monorepo Impact Summary

- Contracts: single-community internal refactor across per-community modules plus authority wiring updates.
- Contracts: include `ParamController` migration from shared deployment model to per-community deployment model.
- Manager app (`apps/web`): deploy wizard state contract with deploy-time access wiring and mandatory admin handoff to timelock.
- Indexer (`apps/indexer`): event/index mapping updates for changed event shapes or removed multi-community dimensions.
- Tests (`test/` and web unit tests): contract refactor coverage, wizard state machine regressions, authority-leakage tests.
- Documentation (`docs/EN/*`, `contracts/FEATURES.md`, status docs): synchronized architecture and staging policy narrative.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: Breaking changes MUST be explicitly marked and justified.
- **CM-002**: For Base Sepolia staging, migration/replay/backfill is explicitly out of scope; clean redeploy is required.
- **CM-003**: Event and ABI change impact on downstream niche dApps MUST be
  documented.

### Documentation And Terminology Requirements *(mandatory)*

- **DT-001**: `neuromancer/SHIFT_SYSTEM.md` and `contracts/FEATURES.md` MUST be
  updated when shipped behavior changes.
- **DT-002**: Specs MUST use current Shift terminology (Engagements,
  ValuableActionSBT, VPS, PositionManager, RevenueRouter, RequestHub, Drafts,
  Governor/Timelock, Target ROI).
- **DT-003**: If implementation status, drift risks, backlog priorities,
  architecture expectations, or workflow requirements change, specs MUST include
  synchronized update requirements for
  `.github/project-management/IMPLEMENTATION_STATUS.md` and
  `.github/project-management/STATUS_REVIEW.md`.

### Assumptions

- Base Sepolia remains staging-only for this feature lifecycle.
- Team can redeploy full stack without preserving prior staged addresses.
- Any ABI/event break in staging is acceptable when documented and synchronized across app/indexer/tests.

### Key Entities *(include if feature involves data)*

- **Community Deployment Unit**: One deployed stack with local governance authority (`AccessManager`, `ShiftGovernor`, `TimelockController`, `ParamController`) and bound per-community modules.
- **Deploy Wizard Run**: A stateful deployment execution record with explicit state machine transitions and verification outcomes.
- **Access Bootstrap Handoff**: Deployment-time phase where deployer configures selector permissions and then transfers admin authority to community timelock.
- **Contract Refactor Scope Item**: Per-contract conversion task definition and acceptance evidence for single-community internal model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of contracts listed in the Contract Refactor Task Plan include refactor implementation to single-community internals and passing contract-level tests.
- **SC-002**: In two-community isolation tests, 0 unauthorized cross-community privileged mutations succeed across refactored contracts.
- **SC-003**: 100% of successful deployments perform access permission wiring and complete admin handoff to the community timelock before deployment is marked complete.
- **SC-004**: 100% of successful wizard runs pass through the five required states in valid order, with no undefined intermediate state names.
- **SC-005**: 100% of post-handoff privileged mutation tests confirm execution only through local community timelock authority.
- **SC-006**: 0 required migration/backfill tasks remain for Base Sepolia staging rollout; full redeploy procedure is sufficient.
- **SC-007**: 0 unresolved contract/indexer/manager-app drift items remain at merge for this feature scope.

### Test Expectations

- Contract unit tests MUST cover each refactored contract listed in the task plan.
- Integration tests MUST cover deployment wiring, permission bootstrap, admin handoff, and post-handoff verification.
- Web unit/integration tests MUST validate wizard state transitions, restart behavior, and restricted-action handling.
- Negative tests MUST include unauthorized direct-write attempts and cross-community authority leakage attempts.
