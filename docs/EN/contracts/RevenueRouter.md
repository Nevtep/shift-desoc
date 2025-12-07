# RevenueRouter Contract (Cohort-Based)

## 🎯 Purpose & Role

The RevenueRouter implements a cohort-based revenue distribution system that ensures guaranteed Target ROI for investors while transitioning revenue to workers as investment goals are achieved. It functions as a pure executor that reads governance-controlled policies from ParamController and distributes revenue through a waterfall allocation model.

## 🏗️ Core Architecture

### Waterfall Distribution Model

```
Revenue Input → Workers Minimum → Treasury Base → Investor Pool → Spillover Handling
                    (30%)            (40%)           (30%)          (↓ Workers/Treasury)
                                                       ↓
                                            Cohort Weight Distribution
                                                       ↓
                                            Pro-Rata Investor Allocation
```

### State Variables

```solidity
// Controller Dependencies
IParamController public paramController;     // Governance policy reading
ICohortRegistry public cohortRegistry;       // Investment cohort management

// Community Configuration
mapping(uint256 => address) public communityTreasuries;           // Treasury addresses
mapping(uint256 => mapping(address => bool)) public supportedTokens;  // Approved tokens

// Revenue Pools
mapping(uint256 => mapping(address => uint256)) public workerPools;       // Worker revenue pools
mapping(uint256 => mapping(address => uint256)) public treasuryReserves;  // Treasury reserves

// Claims Tracking
mapping(uint256 => mapping(address => mapping(address => uint256))) public workerClaims;    // [community][worker][token]
mapping(uint256 => mapping(address => mapping(address => uint256))) public investorClaims; // [cohort][investor][token]
```

## ⚙️ Key Functions & Logic

### Revenue Distribution Waterfall

```solidity
function routeRevenue(
    uint256 communityId,
    address token,
    uint256 amount
) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant
```

**Implementation Steps**:

1. **Policy Reading**: `paramController.getRevenuePolicy(communityId)`
2. **Workers Minimum**: `workersMin = amount * minWorkersBps / MAX_BPS`
3. **Treasury Base**: `treasuryBase = remaining * treasuryBps / (treasuryBps + investorsBps)`
4. **Investor Pool**: `investorPool = remaining - treasuryBase` (after treasury allocation)
5. **Cohort Distribution**: Weight-based allocation to active investment cohorts
6. **Spillover Handling**: Unallocated amounts flow to workers or treasury based on policy

### Cohort-Based Investment Distribution

```solidity
function _distributeToActiveCohorts(
    uint256 communityId,
    address token,
    uint256 investorPool
) internal returns (uint256 spillover)
```

**Weight Calculation Logic**:

- `totalWeight = Σ(cohortWeight)` for all active cohorts
- `cohortWeight = unrecoveredAmount * priorityWeight`
- `cohortPayment = investorPool * cohortWeight / totalWeight`
- `spillover = investorPool - Σ(cohortPayment)` (handles rounding/precision)

### Pro-Rata Investor Allocation

```solidity
function _distributeToCohortInvestors(
    uint256 cohortId,
    address token,
    uint256 totalPayment
) internal
```

**Distribution Formula**:

- `investorPayment = totalPayment * investmentAmount / cohort.investedTotal`
- Updates `investorClaims[cohortId][investor][token]` for withdrawal
- Maintains precision through careful integer arithmetic

## 🛡️ Security Features

### Access Control Architecture

| Role                 | Functions                               | Justification                       |
| -------------------- | --------------------------------------- | ----------------------------------- |
| `DISTRIBUTOR_ROLE`   | `routeRevenue`, `allocateWorkerRevenue` | Revenue input and worker allocation |
| `TREASURY_ROLE`      | `withdrawTreasuryRevenue`               | Community treasury management       |
| `DEFAULT_ADMIN_ROLE` | Configuration functions                 | System administration               |

### Economic Security

- **Reentrancy Protection**: All revenue functions use `nonReentrant` modifier
- **Integer Overflow**: Solidity 0.8+ automatic protection
- **Precision Handling**: Careful ordering to minimize division precision loss
- **Balance Validation**: Comprehensive checks before token transfers

### Input Validation

```solidity
// Revenue routing validation
if (amount == 0) revert Errors.InvalidInput("Zero amount");
if (!supportedTokens[communityId][token]) revert Errors.InvalidInput("Unsupported token");

// Withdrawal validation
if (workerClaims[communityId][msg.sender][token] < amount) {
    revert Errors.InsufficientBalance(msg.sender, amount, available);
}
```

## 🔗 Integration Points

### ParamController Policy Integration

```solidity
// Revenue policy reading
(uint256 minWorkersBps, uint256 treasuryBps, uint256 investorsBps,
 uint8 spilloverTarget) = paramController.getRevenuePolicy(communityId);

// Dynamic policy updates through governance
// No hardcoded values - all parameters governance-controlled
```

### CohortRegistry Distribution Integration

```solidity
// Active cohort discovery
uint256[] memory activeCohorts = cohortRegistry.getActiveCohorts(communityId);

// Weight-based distribution calculation
uint256 weight = cohortRegistry.getCohortWeight(cohortId, true);

// Recovery tracking and cohort completion
cohortRegistry.markRecovered(cohortId, cohortPayment);
```

### ValuableActionSBT Allocation Integration

```solidity
// Called by Claims contract after work verification
function allocateWorkerRevenue(
    uint256 communityId,
    address worker,
    address token,
    uint256 amount
) external onlyRole(DISTRIBUTOR_ROLE)
```

## 📊 Economic Model

### Revenue Distribution Examples

**Scenario: 1000 USDC Revenue, Policy 30%/40%/30%**

```
Input: 1000 USDC
├── Workers Min (300 USDC): Immediate allocation to worker pool
├── Treasury Base (400 USDC): Community treasury reserves
└── Investor Pool (300 USDC): Distributed to active cohorts
    ├── Cohort A (Target: 150% ROI, Weight: 60%): 180 USDC
    │   ├── Investor 1 (Investment: 5000 USDC): 90 USDC
    │   └── Investor 2 (Investment: 5000 USDC): 90 USDC
    └── Cohort B (Target: 200% ROI, Weight: 40%): 120 USDC
        └── Investor 3 (Investment: 8000 USDC): 120 USDC
```

### Spillover Mechanics

**Active Cohorts Scenario**: All investor pool allocated to cohorts
**No Active Cohorts**: 100% spillover to workers (default) or treasury
**Completed Cohorts**: Spillover from inactive cohorts enhances worker/treasury share

### Target ROI Progression

```solidity
// Cohort completion example
Initial: investedTotal = 10000 USDC, targetROI = 150%, recovered = 0 USDC
Target: 15000 USDC total recovery needed
Progress: After receiving 8000 USDC → unrecovered = 7000 USDC (still active)
Completion: After receiving 15000+ USDC → cohort deactivated, spillover begins
```

## 🎛️ Configuration Examples

### Conservative Revenue Policy

```solidity
// High worker security, moderate treasury, lower investor share
minWorkersBps = 4000;    // 40% workers minimum
treasuryBps = 4000;      // 40% treasury
investorsBps = 2000;     // 20% investors
spilloverTarget = 0;     // Spillover to workers
```

### Growth-Focused Revenue Policy

```solidity
// Higher investor allocation to attract capital
minWorkersBps = 3000;    // 30% workers minimum
treasuryBps = 2000;      // 20% treasury
investorsBps = 5000;     // 50% investors
spilloverTarget = 1;     // Spillover to treasury
```

### Worker-Centric Revenue Policy

```solidity
// Maximum worker benefit, minimal external investment
minWorkersBps = 5000;    // 50% workers minimum
treasuryBps = 3000;      // 30% treasury
investorsBps = 2000;     // 20% investors
spilloverTarget = 0;     // Spillover to workers
```

## 🚀 Advanced Features

### Revenue Preview Functions

```solidity
function previewDistribution(uint256 communityId, uint256 amount)
    external view returns (uint256 workersMin, uint256 treasuryBase, uint256 investorPool, uint8 spilloverTarget);

function previewCohortDistribution(uint256 communityId, uint256 investorPool)
    external view returns (uint256[] memory cohortIds, uint256[] memory cohortPayments, uint256 totalDistributed);
```

**Use Cases**:

- **Governance Transparency**: Communities can simulate revenue distribution before policy changes
- **Investor Analysis**: Prospective investors can model expected returns
- **Worker Planning**: Worker cooperatives can forecast income streams

### Multi-Token Support

```solidity
mapping(uint256 => mapping(address => bool)) public supportedTokens;
```

- **Flexible Revenue**: Communities can accept multiple revenue tokens (USDC, DAI, etc.)
- **Isolated Pools**: Each token maintains separate worker pools and treasury reserves
- **Unified Distribution**: Same waterfall logic applies across all supported tokens

### Emergency Controls

```solidity
function setParamController(address _paramController) external onlyRole(DEFAULT_ADMIN_ROLE);
function setCohortRegistry(address _cohortRegistry) external onlyRole(DEFAULT_ADMIN_ROLE);
```

- **Governance Upgrades**: Communities can upgrade controller contracts
- **Emergency Response**: Admin role enables rapid system updates
- **Decentralized Control**: All changes require community governance approval

## Implementation Notes

### Gas Optimization Strategies

**Efficient Cohort Iteration**:

```solidity
uint256[] memory activeCohorts = cohortRegistry.getActiveCohorts(communityId);
// Single call vs multiple individual cohort queries
```

**Batch Weight Calculation**:

```solidity
for (uint256 i = 0; i < activeCohorts.length; i++) {
    weights[i] = cohortRegistry.getCohortWeight(activeCohorts[i], true);
    totalWeight += weights[i];
}
// Pre-calculate all weights before distribution
```

### Precision Management

**Rounding Minimization**:

- Workers minimum calculated first (highest precision)
- Treasury base uses remaining balance after workers
- Investor pool is remainder after treasury (eliminates compound rounding)

**Spillover Accounting**:

```solidity
spillover = investorPool;  // Start with full amount
for (each cohort payment) {
    spillover -= cohortPayment;  // Track actual distribution
}
// Spillover represents actual undistributed amount
```

### Integration Requirements

**Required Dependencies**:

- **ParamController**: Revenue policy configuration and reading
- **CohortRegistry**: Investment cohort management and weight calculation
- **AccessControl**: Role-based permission management
- **ReentrancyGuard**: Protection against reentrancy attacks
- **SafeERC20**: Secure token transfer operations

**Optional Integrations**:

- **Claims Contract**: Worker revenue allocation after verification
- **Treasury Contract**: Advanced treasury management features
- **Analytics Systems**: Event-based revenue tracking and reporting
