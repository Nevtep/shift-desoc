# InvestmentCohortManager Contract

The InvestmentCohortManager contract coordinates investment cohort lifecycle and Investment SBT issuance. It serves as the high-level interface for managing investor participation, delegating storage to CohortRegistry and SBT minting to ValuableActionRegistry.

## 🎯 Purpose & Role

The InvestmentCohortManager serves as the **investment coordination layer** that:

- Allows governance/moderators to create and manage investment cohorts
- Issues INVESTMENT SBTs when investments are recorded
- Coordinates between CohortRegistry (storage) and ValuableActionRegistry (SBT minting)
- Enforces cohort validity rules (active status, expiration)

Unlike work verification (Engagements) or credentials (CredentialManager), InvestmentCohortManager handles **capital participation** with Target ROI mechanics.

## 🏗️ Core Architecture

### Manager Pattern

InvestmentCohortManager follows a coordinator pattern:

```
                  ┌─────────────────────────┐
                  │  InvestmentCohortManager │
                  │  (Coordination Layer)    │
                  └───────────┬─────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
   ┌───────────────┐  ┌───────────────────┐  ┌────────────────┐
   │ CohortRegistry │  │ValuableActionReg │  │ValuableActionSBT│
   │ (Storage)      │  │(Issuance Policy) │  │(Token Contract)│
   └───────────────┘  └───────────────────┘  └────────────────┘
```

### Cohort Structure (via CohortRegistry)

```solidity
struct Cohort {
    uint256 id;
    uint256 communityId;
    uint16 targetRoiBps;      // e.g., 15000 = 150% (immutable)
    uint32 priorityWeight;    // Revenue distribution priority
    uint256 investedTotal;    // Total capital in cohort
    uint256 recoveredTotal;   // Revenue received to date
    bool active;              // Can receive new investments
    bytes32 termsHash;        // IPFS hash of investment terms
    uint64 startAt;           // Cohort start time
    uint64 endAt;             // Cohort end time (0 = no expiry)
}
```

## ⚙️ Key Functions & Logic

### Cohort Lifecycle

#### `createCohort(...)`

**Purpose**: Create a new investment cohort with specified terms.

**Returns**: `cohortId` - Cohort identifier

**Access**: Governance or moderators only.

```solidity
function createCohort(
    uint256 communityId,
    uint16 targetRoiBps,
    uint32 priorityWeight,
    bytes32 termsHash,
    uint64 startAt,
    uint64 endAt,
    bool active
) external onlyGovOrModerator returns (uint256 cohortId) {
    // Delegate to CohortRegistry for storage
    cohortId = cohortRegistry.createCohort(
        communityId, 
        targetRoiBps, 
        priorityWeight, 
        termsHash, 
        startAt, 
        endAt, 
        active
    );
    
    emit CohortCreated(cohortId, communityId, active);
}
```

**Parameters**:
| Parameter | Description |
|-----------|-------------|
| `communityId` | Community this cohort belongs to |
| `targetRoiBps` | Target ROI in basis points (e.g., 15000 = 150%) |
| `priorityWeight` | Weight for revenue distribution (1-1000) |
| `termsHash` | IPFS hash of investment terms document |
| `startAt` | Timestamp when cohort becomes active |
| `endAt` | Timestamp when cohort expires (0 = no expiry) |
| `active` | Whether cohort is immediately active |

#### `setCohortActive(uint256 cohortId, bool active)`

**Purpose**: Activate or deactivate a cohort.

**Access**: Governance or moderators only.

```solidity
function setCohortActive(uint256 cohortId, bool active) 
    external onlyGovOrModerator 
{
    cohortRegistry.setCohortActive(cohortId, active);
    emit CohortActivationUpdated(cohortId, active);
}
```

### Investment Issuance

#### `issueInvestment(address to, uint256 cohortId, uint32 weight, bytes calldata metadata)`

**Purpose**: Record an investment and mint INVESTMENT SBT.

**Returns**: `tokenId` - Minted INVESTMENT SBT token ID

**Access**: Governance or moderators only.

```solidity
function issueInvestment(
    address to,
    uint256 cohortId,
    uint32 weight,
    bytes calldata metadata
) external onlyGovOrModerator returns (uint256 tokenId) {
    // Validate cohort is active and not expired
    CohortRegistry.Cohort memory cohort = cohortRegistry.getCohort(cohortId);
    if (!cohort.active) 
        revert Errors.InvalidInput("Cohort inactive");
    if (cohort.endAt != 0 && block.timestamp > cohort.endAt) 
        revert Errors.InvalidInput("Cohort expired");

    // Issue INVESTMENT SBT via ValuableActionRegistry
    tokenId = valuableActionRegistry.issueInvestment(
        cohort.communityId, 
        to, 
        cohortId, 
        weight, 
        metadata
    );

    // Record investment in CohortRegistry for downstream eligibility
    cohortRegistry.addInvestment(cohortId, to, weight, tokenId);

    emit InvestmentIssued(to, tokenId, cohortId, cohort.communityId, weight);
}
```

**Parameters**:
| Parameter | Description |
|-----------|-------------|
| `to` | Investor address receiving the SBT |
| `cohortId` | Which cohort this investment belongs to |
| `weight` | Investment weight (affects revenue share) |
| `metadata` | Additional investment metadata (terms snapshot, etc.) |

## 🛡️ Security Features

### Access Control

| Function | Access |
|----------|--------|
| `createCohort` | Governance or moderators |
| `setCohortActive` | Governance or moderators |
| `issueInvestment` | Governance or moderators |
| `setModerator` | Governance only |

### Investment Validation

- Cohort must be active to receive investments
- Cohort must not be expired (`endAt` check)
- Investment recorded in both SBT and CohortRegistry

### Cohort Integrity

- Target ROI is immutable after creation
- Terms hash is immutable after creation
- Cohorts auto-deactivate when Target ROI reached (via RevenueRouter)

## 🔗 Integration Points

### CohortRegistry

- Creates and stores cohort data
- Tracks investment totals per investor
- Tracks recovered revenue for Target ROI calculation
- Provides cohort queries

### ValuableActionRegistry

- Issues INVESTMENT SBTs via `issueInvestment()`
- Stores SBT metadata and token data

### ValuableActionSBT

- Holds INVESTMENT tokens
- Non-transferable by default

### RevenueRouter

- Distributes revenue to active cohorts
- Calls `CohortRegistry.markRecovered()` on distribution
- Respects weight for pro-rata allocation

## 📊 Events

```solidity
event CohortCreated(
    uint256 indexed cohortId, 
    uint256 indexed communityId, 
    bool active
);

event CohortActivationUpdated(
    uint256 indexed cohortId, 
    bool active
);

event InvestmentIssued(
    address indexed investor,
    uint256 indexed tokenId,
    uint256 indexed cohortId,
    uint256 communityId,
    uint32 weight
);
```

## 📈 Economic Model

### Target ROI Mechanics

1. **Cohort Creation**: Target ROI set (e.g., 150%)
2. **Investment Recording**: Investments tracked in `investedTotal`
3. **Revenue Distribution**: RevenueRouter pays cohorts, tracks `recoveredTotal`
4. **Auto-Completion**: When `recoveredTotal >= investedTotal * targetRoiBps / 10000`, cohort deactivates

### Weight-Based Distribution

Within a cohort, revenue is distributed by weight:
- Investor A: weight 100
- Investor B: weight 50
- Investor A receives 2x the revenue of Investor B

### Cohort Priority

Between cohorts, priority weight affects distribution:
- Higher priority cohorts receive proportionally more
- Formula: `cohortShare = unrecovered * priorityWeight / totalWeightedUnrecovered`

## 📊 View Functions

```solidity
// Check if cohort is currently active
function isCohortActive(uint256 cohortId) external view returns (bool)

// Get community ID for a cohort
function getCohortCommunity(uint256 cohortId) external view returns (uint256)

// Get investment weight by token ID
function getInvestmentWeightByToken(uint256 tokenId) external view returns (uint256)

// Get total investment weight for an investor in a cohort
function getInvestmentWeight(uint256 cohortId, address investor) external view returns (uint256)
```

## 🎛️ Configuration & Governance

### Admin Functions

- `setModerator(address account, bool status)` — Grant/revoke moderator role
- `updateGovernance(address newGovernance)` — Transfer governance control

### Cohort Terms

Cohort terms should be documented off-chain and hashed:
- Target ROI percentage
- Expected timeline
- Risk disclosures
- Distribution schedule
- Early termination conditions

The `termsHash` provides an immutable link to these terms.

## 🔄 Investment Flow

```
1. Create Cohort
   └─ InvestmentCohortManager.createCohort()
      └─ CohortRegistry stores cohort data
         └─ CohortCreated event

2. Record Investment
   └─ InvestmentCohortManager.issueInvestment()
      ├─ ValuableActionRegistry.issueInvestment()
      │  └─ ValuableActionSBT mints INVESTMENT token
      └─ CohortRegistry.addInvestment()
         └─ InvestmentIssued event

3. Revenue Distribution (via RevenueRouter)
   └─ RevenueRouter.routeRevenue()
      └─ CohortRegistry.markRecovered()
         └─ If Target ROI reached: cohort.active = false

4. Query Status
   └─ InvestmentCohortManager.isCohortActive()
   └─ InvestmentCohortManager.getInvestmentWeight()
```

---

The InvestmentCohortManager provides a clean interface for managing investment participation in Shift communities, coordinating between storage (CohortRegistry), token issuance (ValuableActionRegistry/SBT), and revenue distribution (RevenueRouter) to deliver predictable, Target ROI-based returns to investors.
