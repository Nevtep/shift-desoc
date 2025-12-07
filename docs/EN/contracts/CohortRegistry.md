# CohortRegistry Contract

## 🎯 Purpose & Role

The CohortRegistry manages investment cohorts with immutable Target ROI guarantees, enabling communities to organize investor groups with guaranteed returns while automatically transitioning revenue to workers as investment targets are met. This creates a sustainable economic model where investors receive predictable returns and workers benefit from long-term value creation.

## 🏗️ Core Architecture

### Data Structures

```solidity
struct Cohort {
    uint256 id;                 // Unique cohort identifier
    uint256 communityId;        // Associated community
    uint16 targetRoiBps;        // Target ROI in basis points (e.g., 15000 = 150%)
    uint64 createdAt;           // Creation timestamp
    uint32 priorityWeight;      // Priority weight for distribution (default: 1)
    uint256 investedTotal;      // Total amount invested in this cohort
    uint256 recoveredTotal;     // Total revenue paid to this cohort
    bool active;               // Active until Target ROI reached
    bytes32 termsHash;         // Immutable hash of cohort terms
}
```

### State Variables

- **Access Control**: `timelock` (cohort creation), `revenueRouter` (recovery marking), `valuableActionSBT` (investment recording)
- **Cohort Storage**: `cohorts[]` mapping, `nextCohortId` counter
- **Investment Tracking**: `investedBy[cohortId][investor]`, `cohortInvestors[cohortId][]`
- **Community Management**: `activeCohorts[communityId][]` for efficient distribution

## ⚙️ Key Functions & Logic

### Cohort Lifecycle Management

```solidity
function createCohort(
    uint256 communityId,
    uint16 targetRoiBps,
    uint32 priorityWeight,
    string calldata termsURI
) external onlyTimelock returns (uint256 cohortId)
```

**Purpose**: Creates new investment cohort with immutable terms

- **Validation**: Community exists, Target ROI ≥ 100%, priority weight > 0
- **Immutability**: Terms cannot be changed after creation
- **Integration**: Automatically added to active cohorts list

### Investment Recording

```solidity
function addInvestment(
    uint256 cohortId,
    address investor,
    uint256 amount
) external onlyValuableActionSBT
```

**Purpose**: Records investment in cohort (called by ValuableActionSBT when minting Investment SBTs)

- **Access Control**: Only ValuableActionSBT contract can record investments
- **Tracking**: Updates `investedTotal`, `investedBy` mapping, and investor list
- **Validation**: Cohort active, amount > 0, investor valid

### Revenue Distribution Integration

```solidity
function markRecovered(uint256 cohortId, uint256 amount) external onlyRevenueRouter
```

**Purpose**: Records revenue payments and manages cohort completion

- **Recovery Tracking**: Updates `recoveredTotal` for ROI calculation
- **Auto-Completion**: Deactivates cohort when Target ROI reached
- **Integration**: Only RevenueRouter can call during distribution

### Weight-Based Distribution

```solidity
function getCohortWeight(uint256 cohortId, bool useWeights) external view returns (uint256)
```

**Purpose**: Calculates cohort weight for revenue distribution

- **Formula**: `weight = unrecoveredAmount * (useWeights ? priorityWeight : 1)`
- **Unrecovered**: `(investedTotal * targetRoiBps / 10000) - recoveredTotal`
- **Priority System**: Higher weights get proportionally more revenue

## 🛡️ Security Features

### Access Control Matrix

| Role                | Permissions                   | Justification                                       |
| ------------------- | ----------------------------- | --------------------------------------------------- |
| `timelock`          | Create cohorts, set addresses | Community governance controls investment terms      |
| `revenueRouter`     | Mark recovery                 | Only revenue distribution can update payment status |
| `valuableActionSBT` | Add investments               | Only SBT system can record verified investments     |

### Investment Protection

- **Immutable Terms**: Target ROI and priority weights cannot be changed
- **Guaranteed Completion**: Automatic deactivation ensures Target ROI is honored
- **Transparent Tracking**: All investments and payments are publicly verifiable

### Attack Prevention

- **Reentrancy**: No external calls during state changes
- **Integer Overflow**: Solidity 0.8+ built-in protection
- **Zero Address**: Comprehensive validation on all addresses
- **Invalid States**: Cohort existence and activity validation

## 🔗 Integration Points

### RevenueRouter Integration

```solidity
// Revenue distribution workflow
uint256[] memory activeCohorts = cohortRegistry.getActiveCohorts(communityId);
uint256 weight = cohortRegistry.getCohortWeight(cohortId, true);
cohortRegistry.markRecovered(cohortId, paymentAmount);
```

### ValuableActionSBT Integration

```solidity
// Investment SBT minting workflow
uint256 cohortId = cohortRegistry.createCohort(communityId, targetROI, weight, termsURI);
cohortRegistry.addInvestment(cohortId, investor, amount);
valuableActionSBT.mintInvestmentSBT(investor, communityId, cohortId, amount, evidenceURI);
```

### ParamController Policy Reading

```solidity
// Community governance controls cohort limits
(uint256 maxActiveCohorts, uint8 priorityScheme) = paramController.getCohortParams(communityId);
```

## 📊 Economic Model

### Target ROI System

Investment cohorts guarantee specific returns (e.g., 125%, 150%, 200%) through:

1. **Predictable Revenue**: Weighted distribution based on unrecovered amounts
2. **Automatic Completion**: Cohorts deactivate when Target ROI reached
3. **Spillover Benefits**: Excess revenue flows to workers/treasury

### Priority Weighting Schemes

**ProRataByUnrecovered** (`priorityScheme = 0`):

- Weight = `unrecoveredAmount`
- Equal priority for all cohorts
- Distribution purely based on remaining investment needs

**ProRataByUnrecoveredWeighted** (`priorityScheme = 1`):

- Weight = `unrecoveredAmount * priorityWeight`
- Higher priority cohorts get more revenue
- Enables strategic investment timing

### Revenue Flow Example

```
Community Revenue: 1000 USDC
├── Workers Min (30%): 300 USDC
├── Treasury Base (40%): 400 USDC
└── Investor Pool (30%): 300 USDC
    ├── Cohort A (weight: 60%): 180 USDC
    │   ├── Investor 1 (50% share): 90 USDC
    │   └── Investor 2 (50% share): 90 USDC
    └── Cohort B (weight: 40%): 120 USDC
        └── Investor 3 (100% share): 120 USDC
```

## 🎛️ Configuration Examples

### Conservative Investment Cohort

```solidity
targetRoiBps = 11000;        // 110% Target ROI
priorityWeight = 100;        // Low priority weight
```

- **Use Case**: Risk-averse investors seeking modest guaranteed returns
- **Timeline**: Shorter recovery period, lower competition for revenue

### Growth Investment Cohort

```solidity
targetRoiBps = 20000;        // 200% Target ROI
priorityWeight = 1000;       // High priority weight
```

- **Use Case**: Growth investors accepting longer timeline for higher returns
- **Timeline**: Extended recovery period, higher priority in revenue distribution

### Strategic Partnership Cohort

```solidity
targetRoiBps = 15000;        // 150% Target ROI
priorityWeight = 500;        // Medium priority weight
termsHash = keccak256("Strategic partnership with milestone bonuses");
```

- **Use Case**: Key strategic investors with additional non-financial value
- **Features**: Custom terms documented via IPFS, balanced priority

## 🚀 Advanced Features

### Cross-Community Investment Tracking

```solidity
mapping(address => uint256[]) public investorCohorts;
```

- Track investor participation across multiple communities
- Enable reputation-based investment privileges
- Support for portfolio management tools

### Investment Cohort Analytics

```solidity
function getCohortROIProgress(uint256 cohortId) external view returns (uint256);
function hasReachedTargetROI(uint256 cohortId) external view returns (bool);
```

- Real-time ROI progress tracking
- Completion status monitoring
- Investment performance analytics

### Emergency Governance Controls

```solidity
function setTimelock(address _timelock) external onlyTimelock;
function setRevenueRouter(address _revenueRouter) external onlyTimelock;
```

- Community governance can update system addresses
- Enables upgrades and emergency response
- Maintains decentralized control over investment terms

## Implementation Notes

### Gas Optimization

- **Active Cohorts Array**: Efficient iteration for revenue distribution
- **Batch Operations**: Multiple investments can be processed efficiently
- **View Functions**: Extensive read-only functions minimize transaction costs

### Scalability Considerations

- **Community Isolation**: Each community manages independent cohort sets
- **Weight Caching**: Priority weights calculated once, used repeatedly
- **Event-Driven**: Comprehensive event emission for off-chain indexing

### Integration Requirements

- **CommunityRegistry**: Community validation and parameter reading
- **ParamController**: Cohort limits and priority scheme configuration
- **ValuableActionSBT**: Investment SBT minting and verification integration
- **RevenueRouter**: Revenue distribution and recovery marking integration
