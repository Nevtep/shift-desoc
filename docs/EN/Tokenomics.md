# Shift Token Economics

This document describes the token economics of the Shift DeSoc protocol, covering governance tokens, community currencies, soulbound credentials, and revenue distribution mechanisms.

---

## Token Overview

Shift uses a multi-token model where each token serves a distinct purpose:

| Token | Type | Purpose | Transferable |
|-------|------|---------|--------------|
| **MembershipTokenERC20Votes** | ERC-20 | Governance voting power | Yes |
| **CommunityToken** | ERC-20 | 1:1 USDC-backed payments | Yes |
| **ValuableActionSBT** | ERC-721 | Soulbound reputation credentials | No |

---

## 1. MembershipTokenERC20Votes (Governance Token)

### Core Principle

> **"Governance power is EARNED, not bought."**

MembershipTokens can only be earned through verified contributions—they cannot be purchased, airdropped, or earned through staking.

### Token Properties

| Property | Value |
|----------|-------|
| Standard | ERC-20 + ERC20Votes |
| Max Supply | 100,000,000 tokens |
| Decimals | 18 |
| Transferable | Yes |
| Mintable By | MINTER_ROLE only (Engagements contract) |

### Earning Mechanism

Tokens are minted exclusively when:
1. Worker submits an Engagement for verified ValuableAction
2. M-of-N verifiers approve the engagement
3. Engagements contract calls `mint()` with configured reward amount

```solidity
// Only the Engagements contract (with MINTER_ROLE) can mint
function mint(address to, uint256 amount, string calldata reason) 
    external onlyRole(MINTER_ROLE) 
{
    require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
    _mint(to, amount);
    emit TokensMintedForWork(to, amount, msg.sender, reason);
}
```

### Delegation Model

MembershipToken implements full ERC20Votes delegation for liquid democracy:

- **Self-Delegation Required**: Users must delegate to activate voting power
- **Transitive Delegation**: Can delegate to trusted community experts
- **Gasless Operations**: EIP-2612 permit enables meta-transactions
- **Historical Snapshots**: Vote weights locked at proposal creation block

### Governance Integration

- 1 token = 1 vote
- Voting power used by ShiftGovernor for proposals
- Supports both binary and multi-choice voting
- Cannot be manipulated after proposal creation (snapshot mechanism)

---

## 2. CommunityToken (Stablecoin)

### Purpose

CommunityToken is a 1:1 USDC-backed programmable currency for transparent community payments and treasury management.

### Token Properties

| Property | Value |
|----------|-------|
| Standard | ERC-20 |
| Backing | 1:1 USDC (full collateralization) |
| Transferable | Yes |
| Pausable | Yes (emergency) |

### Mint/Redeem Mechanism

```solidity
// Mint: Deposit USDC, receive CommunityToken
function mint(uint256 usdcAmount) external returns (uint256 tokensIssued) {
    USDC.transferFrom(msg.sender, address(this), usdcAmount);
    _mint(msg.sender, usdcAmount);
    return usdcAmount;
}

// Redeem: Burn CommunityToken, receive USDC (minus optional fee)
function redeem(uint256 tokenAmount) external returns (uint256 usdcRedeemed) {
    uint256 fee = tokenAmount * redemptionFeeBps / 10000;
    uint256 usdcAmount = tokenAmount - fee;
    _burn(msg.sender, tokenAmount);
    USDC.transfer(msg.sender, usdcAmount);
    if (fee > 0) USDC.transfer(treasury, fee);
    return usdcAmount;
}
```

### Use Cases

- **Worker Payments**: Salaries and bounties
- **Marketplace Transactions**: Service and product purchases
- **Housing Reservations**: Co-housing payments
- **Treasury Operations**: Community spending

### Safety Features

- **Backing Guarantee**: `USDC.balanceOf(contract) >= totalSupply()` always
- **Emergency Pause**: Halt transfers during incidents
- **Delayed Withdrawal**: Emergency withdrawals require cooldown period
- **Treasury Role**: Only authorized addresses can access reserves

---

## 3. ValuableActionSBT (Soulbound Credentials)

### Purpose

Non-transferable tokens representing verified contributions, credentials, and participation records.

### Token Types

```solidity
enum TokenKind {
    WORK,        // One-shot task completion (bounties, deliverables)
    ROLE,        // Certified past role (from Position closure with SUCCESS)
    CREDENTIAL,  // Course/training completion
    POSITION,    // Active ongoing role (participates in revenue)
    INVESTMENT   // Investment cohort membership
}
```

### Token Properties

| Property | Value |
|----------|-------|
| Standard | ERC-721 (transfers disabled) |
| Transferable | No (soulbound) |
| Revocable | By governance only |
| Decay | WorkerPoints decay over time |

### Issuance Paths

| SBT Type | Issued By | Trigger |
|----------|-----------|---------|
| WORK | Engagements | Approved one-shot engagement |
| CREDENTIAL | CredentialManager | Verifier approves application |
| POSITION | PositionManager | Governance approves position assignment |
| ROLE | PositionManager | Position closed with SUCCESS outcome |
| INVESTMENT | InvestmentCohortManager | Investment recorded in cohort |

### WorkerPoints System

Points quantify contribution reputation with time-based decay:

```solidity
struct TokenData {
    TokenKind kind;
    uint256 communityId;
    bytes32 actionTypeId;
    uint32 points;
    uint64 issuedAt;
    uint64 endedAt;      // 0 if still active
    uint8 outcome;       // For closed positions
}
```

**Decay Mechanism**:
- Points decay weekly to favor active contributors
- Governance can adjust decay rate
- Lifetime points tracked separately from current points

### Access Control

- **Minting**: Only authorized manager contracts (Engagements, CredentialManager, PositionManager, InvestmentCohortManager)
- **Revocation**: Governance only (for misconduct)
- **Metadata Updates**: Manager contracts only

---

## 4. Revenue Distribution

### Revenue Router Waterfall

Revenue flows through a deterministic waterfall:

```
Revenue Input
     │
     ▼
┌────────────────────┐
│ 1. Workers Minimum │ ← Guaranteed share (e.g., 40%)
└────────────────────┘
     │
     ▼
┌────────────────────┐
│ 2. Treasury Base   │ ← Community reserve (e.g., 25%)
└────────────────────┘
     │
     ▼
┌────────────────────┐
│ 3. Investor Pool   │ ← Active cohorts by weight (e.g., 35%)
└────────────────────┘
     │
     ▼
┌────────────────────┐
│ 4. Spillover       │ ← Per governance policy
└────────────────────┘
```

### Distribution Parameters

Configurable via ParamController:

```solidity
// Revenue policy: [workersBps, treasuryBps, investorsBps, spilloverTarget]
// Example: [4000, 2500, 3500, 1] = 40% workers, 25% treasury, 35% investors
uint256[4] public revenuePolicy;
```

### Spillover Rules

When no active investment cohorts exist:

| Option | Behavior |
|--------|----------|
| Option A | Redistribute to Position SBT holders |
| Option B | Redirect entirely to Treasury |
| Option C | Split between Treasury and Positions |

---

## 5. Investment Cohorts

### Cohort Structure

Investment cohorts group investors with shared terms:

```solidity
struct Cohort {
    uint256 id;
    uint256 communityId;
    uint16 targetRoiBps;      // e.g., 15000 = 150% (immutable)
    uint32 priorityWeight;    // Revenue distribution priority (1-1000)
    uint256 investedTotal;    // Total capital in cohort
    uint256 recoveredTotal;   // Revenue received to date
    bool active;              // Auto-deactivates when target reached
    bytes32 termsHash;        // IPFS hash of immutable terms
    uint64 startAt;
    uint64 endAt;
}
```

### Target ROI Mechanics

- **Immutable Terms**: Target ROI cannot be changed after cohort creation
- **Automatic Completion**: Cohort deactivates when `recoveredTotal >= investedTotal * targetRoiBps / 10000`
- **Pro-rata Distribution**: Revenue allocated by weight relative to other active cohorts

### Weight Calculation

```solidity
function getCohortWeight(uint256 cohortId, bool useWeights) returns (uint256) {
    uint256 unrecovered = targetTotal - recoveredTotal;
    if (unrecovered == 0) return 0;
    
    return useWeights 
        ? unrecovered * cohort.priorityWeight 
        : unrecovered;
}
```

---

## 6. Position Revenue Participation

### Active Positions

Position SBT holders receive a guaranteed share of revenue:

1. **Registration**: When position assigned, `RevenueRouter.registerPosition(tokenId)`
2. **Distribution**: Worker minimum pool split among active positions by points
3. **Unregistration**: When position closed, `RevenueRouter.unregisterPosition(tokenId)`

### Revenue Share Calculation

```solidity
function getPositionShare(uint256 tokenId) returns (uint256) {
    TokenData memory data = sbt.getTokenData(tokenId);
    if (data.kind != TokenKind.POSITION) return 0;
    if (data.endedAt != 0) return 0;  // Closed positions don't participate
    
    return data.points / totalActivePositionPoints;
}
```

---

## 7. Economic Invariants

### Collateralization

- CommunityToken USDC backing ≥ 100% at all times
- Redemptions cannot exceed backing

### Revenue Integrity

- All revenue inputs = all distribution outputs
- No funds can be stranded in intermediate states

### Investment Protection

- Cohort terms are immutable after creation
- Target ROI enforced automatically
- No overpayment to investors

### Governance Control

- All economic parameters changeable only via Timelock
- Emergency controls have documented safeguards
- Role separation limits blast radius

---

## 8. Token Flow Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                        TOKEN FLOWS                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Work Verification                                               │
│  ─────────────────                                               │
│  Worker → Engagement → Approved → MembershipToken + WORK SBT     │
│                                                                  │
│  Credential Issuance                                             │
│  ──────────────────                                              │
│  Applicant → Course → Verifier Approves → CREDENTIAL SBT         │
│                                                                  │
│  Position Lifecycle                                              │
│  ─────────────────                                               │
│  Applicant → Approved → POSITION SBT (revenue participation)     │
│  Position → Closed SUCCESS → ROLE SBT (certified history)        │
│                                                                  │
│  Investment                                                      │
│  ──────────────                                                  │
│  Investor → Cohort → INVESTMENT SBT → Revenue until Target ROI   │
│                                                                  │
│  Revenue Distribution                                            │
│  ────────────────────                                            │
│  Business Revenue → RevenueRouter →                              │
│    → Workers (Position holders)                                  │
│    → Treasury (Community reserve)                                │
│    → Investors (Active cohorts)                                  │
│                                                                  │
│  Payments                                                        │
│  ────────                                                        │
│  USDC → mint() → CommunityToken → Marketplace/Housing/Treasury   │
│  CommunityToken → redeem() → USDC                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Anti-Plutocracy Design

Shift explicitly prevents governance capture by capital:

| Traditional DAO | Shift DeSoc |
|----------------|-------------|
| Buy tokens → vote | Earn tokens → vote |
| Whales dominate | Contributors dominate |
| Pay-to-play | Work-to-play |
| Speculation incentivized | Contribution incentivized |

**Key Mechanisms**:
- MembershipToken only from verified work
- Verifier Power from governance election, not staking
- Investment SBTs for capital (separate from governance)
- Position SBTs for ongoing roles (revenue, not votes)
