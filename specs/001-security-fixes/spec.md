# Feature Specification: Security Fixes (Shift)

**Feature Branch**: `001-security-fixes`  
**Created**: 2026-02-15  
**Status**: Draft  
**Input**: User description: "Security hardening: implement fixes from the security audit (Shift)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Protect Treasury and User Funds (Priority: P1)

As a community member and treasury stakeholder, I need fund-handling paths to preserve collateralization, execute expected payouts, and prevent trapped or drainable funds.

**Why this priority**: Fund loss or inability to settle payments is business-critical and blocks safe operation.

**Independent Test**: Can be fully tested by executing emergency withdrawal, revenue routing, settlement, and bounty completion flows and verifying that funds are never drained, trapped, or silently withheld.

**Acceptance Scenarios**:

1. **Given** outstanding token liabilities and emergency withdrawal initiation, **When** emergency withdrawal executes, **Then** collateral needed to honor redemption obligations remains protected.
2. **Given** an approved bounty completion, **When** completion finalizes, **Then** the winner receives the configured bounty amount in the same completion transaction.
3. **Given** active revenue cohorts, **When** revenue is routed, **Then** distribution succeeds without interface-level reverts.

---

### User Story 2 - Ensure Liveness and Correct Verification Outcomes (Priority: P1)

As a participant in work verification, I need engagements to always progress to a terminal state using configured thresholds and without deadlocks.

**Why this priority**: Stuck engagements and incorrect pass/fail thresholds invalidate core verification workflows.

**Independent Test**: Can be fully tested by submitting engagements across normal, juror-failure, and timeout conditions and verifying deterministic resolution.

**Acceptance Scenarios**:

1. **Given** juror assignment failure, **When** engagement submission is attempted, **Then** submission fails atomically and no unresolved engagement is created.
2. **Given** a configured minimum-approval threshold, **When** jurors vote, **Then** outcome calculation uses the configured threshold rather than a hardcoded majority.
3. **Given** an engagement past verification deadline, **When** expiry resolution is triggered, **Then** engagement transitions to a terminal expired/cancelled state and participant concurrency is released.

---

### User Story 3 - Enforce Governance Authorization Boundaries (Priority: P1)

As governance participants, we need all privileged parameter and lifecycle mutations to remain timelock-governed with no moderator bypasses.

**Why this priority**: Permission bypass breaks constitutional invariants and enables unauthorized economic changes.

**Independent Test**: Can be fully tested by attempting privileged updates from non-governance actors and confirming only governance-authorized execution succeeds.

**Acceptance Scenarios**:

1. **Given** a non-governance moderator, **When** attempting valuable-action mutation or deactivation, **Then** the action is rejected.
2. **Given** timelock-authorized governance execution, **When** the same mutation is performed, **Then** the action succeeds and emits expected governance-traceable events.

---

### User Story 4 - Harden Against Availability and Manipulation Risks (Priority: P2)

As protocol operators, we need protections against gas-based denial-of-service, predictable selection manipulation, and reentrancy in fund-moving flows.

**Why this priority**: These risks degrade reliability and fairness and become severe at scale.

**Independent Test**: Can be fully tested using large-input and adversarial-flow scenarios that verify bounded execution, non-reentrant behavior, and resilient selection entropy.

**Acceptance Scenarios**:

1. **Given** high historical engagement volume, **When** submitting new engagements, **Then** processing remains within bounded gas complexity.
2. **Given** adversarial callback behavior during staking/unstaking, **When** fund-moving operations run, **Then** reentrant re-entry is blocked.
3. **Given** repeated timing attempts by adversaries, **When** juror selection occurs, **Then** selection cannot be predictably biased from block-timing control alone.

### Edge Cases

- Cohort list is non-empty while routing revenue and includes edge-weight values (0 or minimal positive) without causing distribution deadlock.
- Emergency withdrawal is requested while liabilities exceed immediately withdrawable surplus.
- Engagement is submitted near verification deadline boundary and expires without any juror vote.
- Settlement is attempted with payment assets that are unsupported by routing logic.
- High night-count reservation and high engagement history inputs are submitted concurrently in peak gas periods.

## Requirements *(mandatory)*

### Finding → Work Item Mapping

#### Immediate

1. **C-1 Cohort weight selector mismatch**  
  - **Problem**: Revenue distribution calls an interface signature that does not match implementation.  
  - **Impact**: Revenue routing and downstream settlements revert when cohorts are active.  
  - **Failure/Exploit Scenario**: Any revenue routing call with active cohorts fails, halting investor distributions and dependent settlement flows.  
  - **Fixed Means**: Cohort weight lookup is signature-consistent across callers and implementations; revenue routing succeeds with active cohorts.  
  - **Primary Acceptance Scenario**: Active cohort routing completes and distributes without selector mismatch reverts.  
  - **Edge Cases**: No active cohorts; single active cohort; mixed-weight cohorts.

#### Before mainnet

2. **C-2 Emergency withdrawal can drain backing collateral**  
  - **Problem**: Emergency withdrawal path can remove collateral required for outstanding redeemable supply.  
  - **Impact**: Users can be left with unredeemable liabilities.  
  - **Failure/Exploit Scenario**: Governance-executed emergency withdrawal empties collateral while tokens remain outstanding.  
  - **Fixed Means**: Emergency withdrawal never reduces collateral below required liability coverage.  
  - **Primary Acceptance Scenario**: Withdrawal request that would breach coverage is rejected.  
  - **Edge Cases**: Zero supply; exact surplus withdrawal; pending emergency delay boundary.

3. **C-3 Engagement completion missing atomic bounty payout**  
  - **Problem**: Completion emits readiness but does not execute token payout to winner.  
  - **Impact**: Funds remain stuck in treasury/vault and winners are unpaid.  
  - **Failure/Exploit Scenario**: Completed engagement mints reputation while bounty remains untransferred indefinitely.  
  - **Fixed Means**: Completion success guarantees immediate payout transfer to configured winner and amount.  
  - **Primary Acceptance Scenario**: Completion finalization transfers correct token and amount to winner in same transaction.  
  - **Edge Cases**: Zero bounty amount; token with fee behavior; insufficient approved spend.

4. **H-1 Missing expiry resolution for engagements**  
  - **Problem**: Pending engagements past deadline have no terminal resolution path.  
  - **Impact**: Liveness failure and participant slot exhaustion.  
  - **Failure/Exploit Scenario**: Non-voted engagement remains pending forever and blocks further submissions.  
  - **Fixed Means**: Every expired pending engagement can be deterministically transitioned to terminal state.  
  - **Primary Acceptance Scenario**: Expired pending engagement is resolved to terminal state and frees participant concurrency.  
  - **Edge Cases**: Multiple concurrent expired engagements; exact timestamp boundary.

5. **H-2 Juror selection failure silently accepted**  
  - **Problem**: Submission path swallows juror selection errors and creates unresolved records.  
  - **Impact**: Dead engagements with no possible voting path.  
  - **Failure/Exploit Scenario**: Submission records engagement with zero jurors and no terminal progression.  
  - **Fixed Means**: Submission fails atomically whenever juror selection fails.  
  - **Primary Acceptance Scenario**: Forced juror-selection failure causes full submit revert with no persisted engagement.  
  - **Edge Cases**: Temporary selection source outage; partial response from selector.

6. **H-3 Verification threshold ignores configured minimum**  
  - **Problem**: Outcome logic uses hardcoded majority instead of per-action configured minimum approvals.  
  - **Impact**: Verification outcomes can deviate from governance-configured policy.  
  - **Failure/Exploit Scenario**: Action requiring stricter or looser threshold resolves incorrectly under hardcoded majority.  
  - **Fixed Means**: Verification outcome always uses configured threshold for the selected action type.  
  - **Primary Acceptance Scenario**: Multiple action types with distinct thresholds resolve according to their own configuration.  
  - **Edge Cases**: Threshold equals panel size; threshold equals one.

7. **H-5 Request rate limit counter never resets**  
  - **Problem**: Rate-limit counters accumulate across days without reset.  
  - **Impact**: Legitimate users become permanently blocked after finite usage.  
  - **Failure/Exploit Scenario**: User crosses lifetime cap once and cannot create requests in future periods.  
  - **Fixed Means**: Rate limit applies per period and resets at period rollover.  
  - **Primary Acceptance Scenario**: User reaches daily cap, waits next period, and can create requests again.  
  - **Edge Cases**: Multiple requests at day boundary; clock drift tolerance assumptions.

8. **M-3 Valuable action mutations bypass timelock governance**  
  - **Problem**: Moderator role can perform privileged update/deactivate flows outside governance authority path.  
  - **Impact**: Unauthorized economic and policy mutation risk.  
  - **Failure/Exploit Scenario**: Moderator changes reward/verification parameters without timelock execution.  
  - **Fixed Means**: Only timelock-governed authority can execute privileged mutation/deactivation.  
  - **Primary Acceptance Scenario**: Moderator direct mutation fails; timelock-executed mutation succeeds.  
  - **Edge Cases**: Role revocation mid-proposal; queued governance execution after config change.

#### Hardening

9. **H-4 Settlement can trap escrow with unsupported routing token**  
  - **Problem**: Settlement path can enter non-settleable state when token is unsupported by routing stage.  
  - **Impact**: Escrow remains locked indefinitely for otherwise valid orders.  
  - **Failure/Exploit Scenario**: Seller settlement consistently reverts due to unsupported routing token.  
  - **Fixed Means**: Settlement either completes safely or falls back to a guaranteed non-trapping settlement path.  
  - **Primary Acceptance Scenario**: Unsupported routing token still allows deterministic settlement without trapped escrow.  
  - **Edge Cases**: Router unavailable; token support toggled between order and settlement.
  - **Deterministic Settlement Outcome Matrix**:

    | Condition | Settlement Path | Expected Outcome |
    |-----------|-----------------|------------------|
    | `revenueRouter` configured + token supported | Routed (`routeRevenue`) | Order settles; accrual accounted by router policy; no escrow remainder in marketplace |
    | `revenueRouter` configured + token unsupported | Direct fallback transfer | Order settles; seller paid directly; router accrual unchanged for that order |
    | `revenueRouter` unset/unavailable | Direct fallback transfer | Order settles; seller paid directly; no trapped escrow |
    | Routing revert due to unsupported compatibility | Must not leave order unsettled | Fallback path succeeds or tx reverts atomically pre-state-change |

10. **M-1 Predictable juror selection entropy**  
   - **Problem**: Selection inputs can be influenced or observed to bias juror outcomes.  
   - **Impact**: Fairness and anti-manipulation guarantees weaken.  
   - **Failure/Exploit Scenario**: Adversary repeatedly times submissions to increase favorable juror probability.  
   - **Fixed Means**: Selection uses unpredictability source and process that cannot be materially biased by simple timing control.  
   - **Primary Acceptance Scenario**: Repeated timing attempts do not yield statistically biased favorable selection in simulation bounds.  
   - **Edge Cases**: Low verifier population; repeated submissions in same block window.
  - **Closeout Decision Gate**: Final status MUST be explicitly classified as one of:
    - `FULLY_RESOLVED`: meets quantitative anti-bias threshold in reproducible tests, or
    - `RESIDUAL_RISK_ACCEPTED`: documented residual risk accepted by governance with rationale and compensating controls.
   - **Quantitative Methodology (Closeout Minimum)**:
     - Use fixed-seed reproducible harness with at least `N = 10,000` selections per mode.
     - Uniform mode threshold: maximum absolute per-juror selection deviation from expected probability MUST be `<= 5%` relative error for eligible jurors with expected frequency >= 1%.
     - Weighted mode threshold: observed selection rank MUST preserve expected weight rank with Spearman correlation `>= 0.95`.
     - Timing sensitivity check: repeated submission-time perturbation runs MUST NOT produce statistically significant directional advantage at `p < 0.01` for a fixed actor set.
     - If any threshold is not met, closeout MUST use `RESIDUAL_RISK_ACCEPTED` with compensating controls and ownership.

11. **M-2 Active engagement counting is unbounded complexity**  
   - **Problem**: Submission complexity grows with historical engagement count.  
   - **Impact**: Gas DoS risk for highly active participants.  
   - **Failure/Exploit Scenario**: Legitimate participant with long history cannot submit due to gas limits.  
   - **Fixed Means**: Active engagement checks execute with bounded complexity independent of total historical records.  
   - **Primary Acceptance Scenario**: Submission gas remains within defined bound even with large participant history.  
   - **Edge Cases**: Rapid create/resolve churn; many action types per participant.

12. **M-4 Reentrancy exposure in staking flows**  
   - **Problem**: Fund-moving staking/unstaking functions lack reentrancy protection boundary.  
   - **Impact**: Malicious token callback can re-enter state-changing logic.  
   - **Failure/Exploit Scenario**: Adversarial token triggers recursive call sequence to corrupt balances or lock flow integrity.  
   - **Fixed Means**: Reentrant entry into protected staking/unstaking paths is blocked.  
   - **Primary Acceptance Scenario**: Reentrant callback attempt fails and preserves pre-call invariants.  
   - **Edge Cases**: Nested approvals; partial transfer failures.

13. **M-5 Unbounded booking loops**  
   - **Problem**: Availability and occupancy operations scale linearly with stay length without explicit bound.  
   - **Impact**: Long reservations can exceed gas limits and cause denial of service.  
   - **Failure/Exploit Scenario**: Very long reservation causes out-of-gas and blocks booking completion.  
   - **Fixed Means**: Booking checks and occupancy updates execute within bounded limits for accepted reservation windows.  
   - **Primary Acceptance Scenario**: Long-but-valid reservation processes within gas budget; over-limit reservation is rejected clearly.  
   - **Edge Cases**: Maximum allowed stay boundary; multi-unit concurrent booking attempts.

#### Ops (Design-Awareness: no functional behavior change)

14. **D-1 Intentional temporary under-collateralization window (`mintTo`)**  
   - **Problem**: Governance-intended mint path may temporarily reduce backing ratio.  
   - **Impact**: Short window where redemption reliability may degrade.  
   - **Failure Scenario**: Mint executes before corresponding collateral top-up and users attempt immediate redemption.  
   - **Fixed Means (Ops-only)**: Operational policy requires atomic governance runbooks, pre/post execution monitoring, and incident threshold alerts for backing ratio deviations.  
   - **Primary Acceptance Scenario**: Governance procedure documentation enforces mint+collateral pairing and monitoring confirms no unresolved deficit beyond policy window.  
   - **Edge Cases**: Delayed collateral transfer; partial execution rollback.

15. **D-2 Intentional position-claim behavior independent of registration flag**  
   - **Problem**: Claim eligibility is intentionally based on POSITION ownership rather than registration state.  
   - **Impact**: Operational dependence on controlled SBT mint paths and monitoring of anomalous claim patterns.  
   - **Failure Scenario**: Direct issuance path mints claim-capable position token outside expected registration workflow.  
   - **Fixed Means (Ops-only)**: Governance/ops controls enforce authorized mint routes, anomaly alerts for unregistered-claim patterns, and runbook documentation for containment.  
   - **Primary Acceptance Scenario**: Monitoring detects and alerts on claim attempts from non-standard issuance paths within defined SLA.  
   - **Edge Cases**: Position transfer restrictions; legacy tokens from prior migrations.

### Functional Requirements

- **FR-001**: The system MUST maintain signature compatibility across cross-contract interfaces used in financial distribution paths.
- **FR-002**: The system MUST enforce liability-preserving financial invariants so no emergency or privileged action can reduce redeemable collateral below outstanding obligations; specifically `USDC.balanceOf(CommunityToken) - emergencyWithdrawalAmount >= totalSupply()` at execution time.
- **FR-003**: Engagement completion MUST execute configured bounty payouts atomically with completion finalization.
- **FR-004**: Every engagement MUST have a guaranteed path to a terminal state, including timeout-driven resolution; expired pending engagements MUST resolve deterministically and release participant concurrency accounting.
- **FR-005**: Engagement submission MUST fail atomically if juror assignment cannot be completed.
- **FR-006**: Verification outcomes MUST use governance-configured approval thresholds per action type.
- **FR-007**: Request rate limiting MUST reset by policy period and never create permanent lockout for compliant users.
- **FR-008**: Privileged economic/policy mutations MUST be executable only through governance-authorized authority (`Governor -> Timelock -> AccessManager restricted target`) and MUST reject moderator-only bypasses.
- **FR-009**: Settlement flows MUST guarantee no escrow remains permanently trapped due to routing compatibility conditions, with explicit deterministic outcomes for both routed and fallback settlement paths.
- **FR-010**: Juror selection MUST be resilient against practical timing-based manipulation and provide auditable fairness assurances using a quantitative test threshold and reproducible methodology documented in closeout evidence.
- **FR-011**: State checks in high-frequency flows MUST be bounded to prevent historical growth from causing gas-based denial of service.
- **FR-012**: All fund-moving staking/unstaking flows MUST be protected against reentrant execution.
- **FR-013**: Reservation and occupancy operations MUST enforce bounded processing limits that prevent gas exhaustion.
- **FR-014**: For Design-Awareness items, the system MUST preserve current functional behavior while adding operational safeguards, monitoring/alerts, and documentation updates.
- **FR-015**: Security hardening documentation MUST include updated threat model, runbooks, and alert conditions for all findings prioritized as Immediate/Before mainnet/Hardening/Ops.
- **FR-016**: Protocol documentation MUST be synchronized with remediated behavior, including removal of stale claims in `contracts/FEATURES.md` that conflict with implemented contract logic.
- **FR-017**: Security closeout MUST include an evidence package with trace links for each finding to: changed contracts, tests, governance/authorization validation, ABI sync outputs, and rollout notes.
- **FR-018**: For unresolved or partially mitigated findings, the spec MUST record explicit residual-risk ownership, acceptance authority, and compensating controls.
- **FR-019**: Closeout artifacts MUST include recovery/runbook steps for partial rollout failures (migration mismatch, stale consumer ABIs, replay divergence).

### Assumptions & Dependencies

- The audit report in `contracts/SECURITY_AUDIT.md` is the authoritative source for finding definitions and severity.
- Governance authority model remains: privileged mutations execute via governor + timelock path.
- Existing accepted Design-Awareness behaviors (D-1 and D-2) remain unchanged functionally and are mitigated operationally.
- Statistical fairness checks for M-1 may be environment-sensitive; fixed seeds, sample sizes, and pass/fail thresholds MUST be documented to keep results reproducible.
- External dependencies (token behavior quirks, routing availability, indexer replay behavior, reorg handling assumptions) MUST be listed with validation status and fallback controls.

### Dependency Validation Matrix

| Dependency | Validation Method | Current Status | Compensating Control |
|------------|-------------------|----------------|----------------------|
| ERC20 token behavior variance (fee-on-transfer/non-standard return) | Marketplace/RequestHub integration tests on supported tokens | Validated for project-supported token set | Allowlist discipline + fallback direct transfer where applicable |
| Router availability/support matrix | Settlement regression tests (supported + unsupported) | Validated | Deterministic fallback settlement path |
| ABI consumer freshness (web/indexer) | ABI copy scripts + consumer build/type/test pass | Validated | Release gate blocks deploy when ABI sync missing |
| Indexer replay and event consumption | Replay checklist in quickstart + staging dry run | Pending periodic re-validation | Start-block control + staged replay checklist |
| Reorg sensitivity for projections | Ponder operational monitoring and replay checks | Pending periodic re-validation | Health checks + replay runbook before releases |

### Consistency Clarifications (Features vs Implementation)

- `contracts/SECURITY_AUDIT.md` and on-chain contract behavior take precedence over descriptive claims in `contracts/FEATURES.md` whenever they differ.
- C-1/C-2/C-3, H-1/H-2/H-3/H-5, and M-2/M-3/M-4/M-5 are implemented and covered by regression tests in this feature branch.
- H-4 fallback settlement behavior is implemented with routing compatibility checks and direct-transfer fallback path.
- M-1 remains a hardening-sensitive area and requires explicit closeout classification (`FULLY_RESOLVED` vs `RESIDUAL_RISK_ACCEPTED`) with quantitative evidence and signoff.

### Key Entities *(include if feature involves data)*

- **Finding Work Item**: A remediated security objective tied to one audit finding, including impact, exploit/failure scenario, acceptance scope, and completion definition.
- **Security Invariant**: A mandatory safety property (authorization, financial solvency, settlement correctness, liveness, bounded complexity, reentrancy safety) that must hold after remediation.
- **Operational Safeguard Control**: Non-functional control for accepted design trade-offs, including monitoring condition, alert threshold, runbook action, and ownership.
- **Acceptance Scenario Set**: Primary and edge-case test narratives proving each work item is fixed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of CRITICAL, HIGH, and MEDIUM findings from `SECURITY_AUDIT.md` are mapped to explicit work items with acceptance scenarios and a clear fixed definition.
- **SC-002**: 100% of privileged mutation attempts outside governance-authorized authority are rejected in acceptance tests.
- **SC-003**: In acceptance tests, emergency withdrawal cannot reduce redeemable collateral below required outstanding obligations under any tested state.
- **SC-004**: In acceptance tests, engagement completion with configured bounty always results in correct winner payout in the completion transaction.
- **SC-005**: In acceptance tests, no engagement remains permanently pending after deadline; all expired engagements can be finalized to terminal state.
- **SC-006**: In acceptance tests, no escrow remains trapped due to unsupported routing conditions; each settlement path resolves to payout or deterministic fallback.
- **SC-007**: In stress scenarios representing high historical activity, submission and booking flows remain within defined bounded execution limits for accepted input ranges.
- **SC-008**: For Design-Awareness findings, monitoring alerts, runbooks, and ownership documentation are published and validated for operational readiness before mainnet.
- **SC-009**: Security closeout evidence bundle is complete and traceable for every finding (code diff, test proof, governance/role validation, ABI sync, and rollout notes).
- **SC-010**: M-1 has an explicit approved closeout status (`FULLY_RESOLVED` or `RESIDUAL_RISK_ACCEPTED`) with measurable justification and designated approver.
- **SC-011**: Recovery procedures for partial rollout failures are documented and validated in at least one dry run.
