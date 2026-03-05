# Shift DeSoc — Security Audit Report

> **Date**: 2025-02-15
> **Scope**: All contracts under `contracts/` (core, modules, tokens, libs, interfaces)
> **Auditor**: Copilot (automated review)

---

## Clarification Resolutions

The following design questions were raised and resolved with the project owner during this audit:

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| Q1 | `CommunityToken.mintTo()` mints without USDC — intentional? | **Yes** — governance tool; USDC deposited separately; temporary under-collateralization accepted | Finding #3 reclassified from BUG → DESIGN-AWARENESS |
| Q2 | `claimPosition()` ignores `positionRegistered` — bug? | **Intentional** — any POSITION SBT can claim; registration is for accrual tracking only | Finding #2 reclassified from CRITICAL → DESIGN-AWARENESS |
| Q3 | `verify()` hardcodes majority instead of `jurorsMin` | **Bug** — should use `jurorsMin` from ValuableAction config | Finding #8 confirmed as BUG |
| Q4 | `submit()` silently catches juror selection failure | **Bug** — must revert; no unresolvable engagements allowed | Finding #7 confirmed as BUG |
| Q5 | `update()`/`deactivate()` bypass AccessManager via `onlyModerator` | **Bug** — should use `restricted` (require timelock) | Finding #13 confirmed as BUG |

---

## Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 3 | Fund drainage, permanent revenue breakage, unimplemented payout |
| **HIGH** | 5 | Stuck funds, broken mechanics, permanent DoS |
| **MEDIUM** | 5 | Integrity risks, gas DoS, predictable randomness |
| **DESIGN-AWARENESS** | 2 | Accepted design trade-offs requiring operational safeguards |

---

## CRITICAL — Fund Drainage / Revenue Breakage

### C-1. `CohortRegistry.getCohortWeight` signature mismatch — revenue distribution permanently broken

**Files**: `interfaces/ICohortRegistry.sol:26`, `CohortRegistry.sol:245`, `RevenueRouter.sol:204`

- `ICohortRegistry` defines `getCohortWeight(uint256)` (1 argument)
- `CohortRegistry` implements `getCohortWeight(uint256, bool)` (2 arguments)
- `RevenueRouter._distributeToCohorts()` calls `cohortRegistry.getCohortWeight(active[i])` through the interface

The function selectors differ. At runtime, every `routeRevenue()` call **reverts** when active cohorts exist. Investors cannot receive revenue, and Marketplace settlements fail whenever cohorts are active.

**Fix**: Align the interface to match the implementation, or add a 1-argument overload in `CohortRegistry`.

---

### C-2. `CommunityToken.executeEmergencyWithdrawal` can drain all USDC including user deposits

**File**: `CommunityToken.sol:286`

After the 7-day delay, `executeEmergencyWithdrawal` checks only `usdcBalance < withdrawal.amount` with **no backing-ratio enforcement**. All USDC can be withdrawn — including USDC backing outstanding CommunityTokens. Token holders are left unable to redeem.

**Fix**: Enforce `withdrawal.amount <= usdcBalance - totalSupply()` to protect the 1:1 backing, or require token supply to be zero before emergency withdrawal.

---

### C-3. `RequestHub.completeEngagement` does NOT transfer bounty — unimplemented atomic payout

**File**: `RequestHub.sol:400`

`completeEngagement()` only emits `BountyReady` and mints the SBT. **No token transfer occurs.** The bounty sits in the treasury vault with no on-chain path to the winner. The planned atomic on-chain bounty transfer from treasury vault to the winner is **not implemented**.

**Fix**: Add `IERC20(request.bountyToken).safeTransferFrom(treasuryVault, winner, request.bountyAmount)` with appropriate approval flow.

---

## HIGH — Functional Breakage / Stuck Funds

### H-1. `Engagements`: No expired engagement resolution mechanism

**File**: `Engagements.sol`

If jurors don't vote by `verifyDeadline`, the engagement stays in `Pending` status **forever**. No function exists to resolve, expire, or cancel timed-out engagements. The participant's concurrent engagement slot is permanently consumed.

**Fix**: Add a `resolveExpired(uint256 engagementId)` function that cancels engagements past `verifyDeadline`.

---

### H-2. `Engagements.submit()` silently swallows juror selection failure (**Confirmed Bug**)

**File**: `Engagements.sol:178`

`selectJurors()` is wrapped in a try/catch that silently continues on failure. An engagement with **zero jurors** is created — nobody can vote, and combined with H-1, it has no resolution path.

**Fix**: Remove the try/catch; let `submit()` revert if juror selection fails.

---

### H-3. `Engagements.verify()` hardcodes majority instead of `jurorsMin` (**Confirmed Bug**)

**File**: `Engagements.sol:218`

```solidity
uint32 requiredApprovals = uint32(engagement.jurors.length / 2 + 1); // WRONG
```

Ignores the `jurorsMin` field from `ValuableAction`, which is meant to be the configurable M in M-of-N verification.

**Fix**: Read `jurorsMin` from `actionRegistry.getValuableAction(engagement.typeId)` and use it as the threshold.

---

### H-4. `Marketplace._settleToSeller` can permanently trap escrowed funds

**File**: `Marketplace.sol:404`

If `revenueRouter` is set but the payment token isn't in `supportedTokens`, `routeRevenue()` reverts. The entire settlement transaction rolls back, leaving the order in a state where it can never be settled. Funds remain permanently escrowed.

**Fix**: Validate token support before settlement, or add a fallback direct-transfer path.

---

### H-5. `RequestHub` rate limiting: `userRequestCount` never resets

**File**: `RequestHub.sol:538`

`userRequestCount` only increments and **never resets to 0 for a new day**. After 10 lifetime requests, a user is permanently rate-limited from creating new requests.

**Fix**: Reset `userRequestCount` to 1 when `lastPost < dayStart` (new day detected).

---

## MEDIUM — Integrity / Design Concerns

### M-1. `VerifierManager`: Predictable randomness enables jury manipulation

**File**: `VerifierManager.sol`

Juror selection seed uses `block.timestamp`, `block.prevrandao`, and `engagementId` — all observable or influenceable by validators. Sophisticated actors can time submissions to get favorable juries.

**Mitigation**: Use a commit-reveal scheme or VRF (Chainlink VRF / RANDAO) for jury selection randomness.

---

### M-2. `Engagements._countActiveEngagements` is O(n) and grows unbounded

**File**: `Engagements.sol`

`engagementsByParticipant` accumulates forever. Each `submit()` call iterates the full history, causing gas DoS for active participants after many engagements.

**Fix**: Maintain a separate counter `activeEngagementCount[participant][typeId]` incremented on submit, decremented on resolution.

---

### M-3. `ValuableActionRegistry.update()` and `deactivate()` bypass AccessManager (**Confirmed Bug**)

**File**: `ValuableActionRegistry.sol`

These use `onlyModerator` (self-managed mapping) instead of `restricted`. Any moderator can update reward amounts, verification parameters, or deactivate action types without governance/timelock approval. This violates the "timelock is the only authority for privileged mutations" invariant.

**Fix**: Replace `onlyModerator` with `restricted` on both functions.

---

### M-4. `HousingManager`: No `ReentrancyGuard` on `stakeForUnit` / `unstakeFromUnit`

**File**: `HousingManager.sol`

These functions move ERC-20 tokens but lack reentrancy protection. Exploitable with malicious token contracts.

**Fix**: Add `ReentrancyGuard` to HousingManager and apply `nonReentrant` to both functions.

---

### M-5. `HousingManager._isAvailable` / `_markOccupied`: Unbounded loops

**File**: `HousingManager.sol`

O(n) iteration where n = number of nights. A 365-night booking iterates 365 times. Long stays could exceed block gas limits.

**Fix**: Add a maximum stay duration cap (e.g., 90 nights), or use bitmap-based availability tracking.

---

## DESIGN-AWARENESS — Accepted Trade-offs

### D-1. `CommunityToken.mintTo` can create temporary under-collateralization

**File**: `CommunityToken.sol:207`

`mintTo()` mints tokens without USDC deposit. **Owner confirmed this is intentional** — governance deposits USDC separately, and temporary under-collateralization is accepted. However, this means the `getBackingRatio()` can drop below 100% between mint and deposit, and `redeem()` could fail for users during that window.

**Operational safeguard**: Always bundle `depositToTreasury()` + `mintTo()` in the same governance proposal/batch.

---

### D-2. `RevenueRouter.claimPosition` allows claims from unregistered positions

**File**: `RevenueRouter.sol:260`

`claimPosition()` reads SBT data directly without checking `positionRegistered`. **Owner confirmed this is intentional** — registration is for accrual tracking only; any POSITION SBT can claim. However, this means positions unregistered via `unregisterPosition()` can still claim revenue accrued before unregistration, and positions that were **never** registered can claim against the global index (getting $0 if their `positionIndexPaid` snapshot at index 0 equals the current index at time of first SBT creation). 

**Operational safeguard**: Ensure all POSITION SBTs are minted through PositionManager (which always registers), and monitor for direct SBT issuance bypassing registration.

---

## Recommended Fix Priority

| Priority | Findings | Effort |
|----------|----------|--------|
| **Immediate** (blocks usage) | C-1 | Interface alignment — 1 line change |
| **Before mainnet** | C-2, C-3, H-1, H-2, H-3, H-5, M-3 | Core logic fixes — 1-2 days |
| **Pre-production hardening** | H-4, M-1, M-2, M-4, M-5 | Defense-in-depth — 2-3 days |
| **Operational controls** | D-1, D-2 | Process documentation — 1 day |