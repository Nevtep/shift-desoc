# Phase 0 Research — Security Fixes (Shift)

## Scope
Resolve remaining ambiguities for all CRITICAL/HIGH/MEDIUM findings and define security-first decisions for implementation.

## Clarification Status
- `NEEDS CLARIFICATION` items remaining: **0**

## Decisions

### 1) C-1 Cohort selector mismatch resolution
- **Decision**: Add ABI-compatible alignment so `RevenueRouter` calls always resolve successfully (retain backward compatibility where possible).
- **Rationale**: This is an immediate usage blocker with minimal-code, high-impact fix.
- **Alternatives considered**:
  - Change all callers and interface to 2-arg signature only (higher integration risk).
  - Add overloaded compatibility path in `CohortRegistry` while preserving existing caller behavior (preferred).

### 2) C-2 Emergency withdrawal liability floor
- **Decision**: Enforce liability-preserving invariant in emergency withdrawals (cannot withdraw collateral required for outstanding obligations).
- **Rationale**: Prevents solvency break under governance misuse or emergency paths.
- **Alternatives considered**:
  - Require zero supply before any emergency withdrawal (too restrictive for real incident response).
  - Surplus-only withdrawal check (preferred).

### 3) C-3 Atomic bounty payout semantics
- **Decision**: `completeEngagement` must perform payout and SBT issuance atomically (single transaction, all-or-nothing).
- **Rationale**: Eliminates “completed but unpaid” state and aligns with expected UX/security invariant.
- **Alternatives considered**:
  - Two-step payout claim mechanism (adds state complexity and non-atomic risk).
  - Atomic transfer in completion path (preferred).

### 4) H-1/H-2/H-3 Engagement liveness + threshold correctness
- **Decision**: Make juror selection failure revert on submit, add explicit expired-resolution path, and use configurable `jurorsMin` for outcomes.
- **Rationale**: Restores deterministic lifecycle and policy fidelity.
- **Alternatives considered**:
  - Keep silent fallback and rely on manual juror assignment (unreliable and deadlock-prone).
  - Fixed majority only (violates configurable policy).

### 5) H-4 Marketplace settlement non-trapping behavior
- **Decision**: Add deterministic pre-check/fallback so unsupported routing tokens do not trap escrow.
- **Rationale**: Settlement liveness is mandatory; escrow must always resolve to a terminal payout/refund state.
- **Alternatives considered**:
  - Hard fail unsupported routing without fallback (continues trap risk).
  - Non-routing direct-settle fallback (preferred when routing is incompatible).

### 6) H-5 Request rate-limit period reset
- **Decision**: Implement true per-period counter reset behavior.
- **Rationale**: Prevents permanent lockout and matches documented policy intent.
- **Alternatives considered**:
  - Lifetime cap with grace exceptions (not policy-compliant).

### 7) M-3 Timelock boundary restoration
- **Decision**: Remove moderator-only privileged mutation paths and require governance/timelock authority.
- **Rationale**: Preserves core system invariant and minimizes permission bypass risk.
- **Alternatives considered**:
  - Dual authority model (timelock + moderator) with extra checks (unnecessary risk).

### 8) M-2 bounded complexity for active engagement checks
- **Decision**: Maintain explicit active counters updated on state transitions instead of scanning unbounded history.
- **Rationale**: Prevents gas growth DoS while preserving correctness.
- **Alternatives considered**:
  - Keep O(n) scan with soft practical limits (insufficient under sustained use).

### 9) M-4 reentrancy protection in housing stake/unstake
- **Decision**: Add explicit reentrancy guard around fund-moving staking functions.
- **Rationale**: Standard defense-in-depth for token callback surfaces.
- **Alternatives considered**:
  - CEI-only without guard (weaker against malicious token interactions).

### 10) M-5 bounded booking loops
- **Decision**: Enforce max booking window for accepted reservations and reject over-limit requests deterministically.
- **Rationale**: Guarantees bounded execution and prevents gas exhaustion from long ranges.
- **Alternatives considered**:
  - Bitmap redesign (stronger but larger migration scope).

### 11) M-1 juror entropy hardening
- **Decision**: Improve entropy strategy within current architecture and add fairness regression tests.
- **Rationale**: Reduces practical timing manipulation risk without introducing protocol-level liveness regressions.
- **Alternatives considered**:
  - Full VRF integration now (higher operational complexity and dependency risk).
  - Keep current approach with no changes (unacceptable per hardening scope).

### 12) D-1 / D-2 Operational controls (no behavior change)
- **Decision**: Add monitoring, alerts, ownership, and runbooks rather than functional changes.
- **Rationale**: Matches explicit design-awareness constraints in spec.
- **Alternatives considered**:
  - Functional restrictions that alter accepted product behavior (rejected by scope).

## Research Conclusion
All ambiguities are resolved sufficiently for implementation planning and task generation.
