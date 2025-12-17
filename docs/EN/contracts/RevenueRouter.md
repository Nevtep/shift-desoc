# RevenueRouter Contract

## 🎯 Purpose & Role

The RevenueRouter contract implements Shift DeSoc's innovative **ROI-based revenue distribution system** that automatically adjusts investor returns as they approach their target ROI. This creates sustainable economic incentives where investor share decreases over time, ensuring long-term community ownership while providing predictable returns to early supporters.

## 🏗️ Core Architecture

### Investor Management Structure

```solidity
struct InvestorData {
    uint256 totalInvested;        // Total capital contributed
    uint256 targetROI;            // Target return percentage (basis points)
    uint256 cumulativeRevenue;    // Total revenue received to date
    uint256 currentShare;         // Current revenue share percentage
    uint256 lastRevenueTime;      // Timestamp of last revenue distribution
    bool active;                  // Whether investor is still receiving revenue
}

mapping(address => InvestorData) public investors;
address[] public activeInvestors;
```

### Revenue Distribution Logic

```solidity
struct RevenueDistribution {
    uint256 totalRevenue;         // Revenue to distribute this period
    uint256 workersShare;         // Percentage to workers (basis points)
    uint256 treasuryShare;        // Percentage to treasury (basis points) 
    uint256 investorsShare;       // Percentage to investors (basis points)
    uint256 distributedAmount;    // Total amount distributed
    uint256 timestamp;            // Distribution timestamp
}
```

**Design Philosophy**: Revenue sharing that transitions from investor-weighted to community-owned as ROI targets are achieved, ensuring sustainable long-term economics.

## ⚙️ Key Functions & Logic

### Investor Registration

```solidity
function registerInvestor(
    address investor,
    uint256 investedAmount,
    uint256 targetROI,
    uint256 initialShare
) external onlyRole(INVESTOR_MANAGER_ROLE) {
    require(investor != address(0), "Invalid investor address");
    require(investedAmount > 0, "Investment must be positive");
    require(targetROI > 0 && targetROI <= 50000, "Invalid ROI target"); // Max 500%
    
    investors[investor] = InvestorData({
        totalInvested: investedAmount,
        targetROI: targetROI,
        cumulativeRevenue: 0,
        currentShare: initialShare,
        lastRevenueTime: block.timestamp,
        active: true
    });
    
    activeInvestors.push(investor);
    
    emit InvestorRegistered(investor, investedAmount, targetROI, initialShare);
}
```

### Dynamic Revenue Calculation

```solidity
function calculateInvestorShare(address investor) external view returns (uint256) {
    InvestorData memory inv = investors[investor];
    
    if (!inv.active) return 0;
    
    // Calculate current ROI percentage achieved
    uint256 currentROI = (inv.cumulativeRevenue * 10000) / inv.totalInvested;
    
    if (currentROI >= inv.targetROI) {
        return 0; // ROI target reached, no more revenue
    }
    
    // Linear decay: share decreases as ROI approaches target
    uint256 progress = (currentROI * 10000) / inv.targetROI;
    uint256 remainingShare = inv.currentShare * (10000 - progress) / 10000;
    
    return remainingShare;
}
```

### Revenue Distribution Process

```solidity
function distributeRevenue(uint256 totalRevenue) 
    external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
    
    require(totalRevenue > 0, "No revenue to distribute");
    
    // Calculate dynamic shares
    uint256 totalInvestorShare = 0;
    address[] memory eligibleInvestors = new address[](activeInvestors.length);
    uint256 eligibleCount = 0;
    
    // Collect eligible investors and their shares
    for (uint256 i = 0; i < activeInvestors.length; i++) {
        address investor = activeInvestors[i];
        uint256 share = calculateInvestorShare(investor);
        
        if (share > 0) {
            totalInvestorShare += share;
            eligibleInvestors[eligibleCount] = investor;
            eligibleCount++;
        } else if (investors[investor].active) {
            // Deactivate investors who reached ROI target
            _deactivateInvestor(investor);
        }
    }
    
    // Distribute to each eligible investor
    for (uint256 i = 0; i < eligibleCount; i++) {
        address investor = eligibleInvestors[i];
        uint256 investorShare = calculateInvestorShare(investor);
        uint256 investorAmount = (totalRevenue * investorShare) / 10000;
        
        // Update investor data
        investors[investor].cumulativeRevenue += investorAmount;
        investors[investor].lastRevenueTime = block.timestamp;
        
        // Transfer revenue
        IERC20(communityToken).safeTransfer(investor, investorAmount);
        
        emit RevenueDistributed(investor, investorAmount, investors[investor].cumulativeRevenue);
    }
    
    // Remaining revenue goes to treasury and workers
    uint256 distributedAmount = (totalRevenue * totalInvestorShare) / 10000;
    uint256 remainingRevenue = totalRevenue - distributedAmount;
    
    _distributeCommunityRevenue(remainingRevenue);
}
```

## 🛡️ Security Features

### Access Control
- **INVESTOR_MANAGER_ROLE**: Can register and modify investor parameters
- **DISTRIBUTOR_ROLE**: Can trigger revenue distribution events
- **ADMIN_ROLE**: Can update system parameters and emergency controls

### Economic Security
- **ROI Limits**: Maximum 500% ROI to prevent excessive returns
- **Reentrancy Protection**: SafeMath and ReentrancyGuard for all financial operations
- **Audit Trail**: Complete event logging for all revenue distributions

### Investor Protection
- **Monotonic Progress**: ROI calculation ensures investors never lose progress
- **Fair Distribution**: Pro-rata distribution based on current calculated shares
- **Transparency**: All calculations are publicly verifiable on-chain

## 🔗 Integration Points

### CommunityToken Integration

```solidity
interface ICommunityToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

// Revenue router receives CommunityTokens and distributes them
function setToken(address _communityToken) external onlyRole(ADMIN_ROLE) {
    communityToken = ICommunityToken(_communityToken);
    emit TokenUpdated(_communityToken);
}
```

### Treasury Integration

```solidity
function _distributeCommunityRevenue(uint256 amount) private {
    uint256 workersAmount = (amount * workersShare) / 10000;
    uint256 treasuryAmount = amount - workersAmount;
    
    // Transfer to workers pool (via Claims contract)
    if (workersAmount > 0) {
        IERC20(communityToken).safeTransfer(workersPool, workersAmount);
    }
    
    // Transfer to treasury
    if (treasuryAmount > 0) {
        IERC20(communityToken).safeTransfer(treasury, treasuryAmount);
    }
}
```

## 📊 Use Case Flows

### 1. Initial Investment & Setup

```
1. Investor contributes capital to community
2. INVESTOR_MANAGER calls registerInvestor(address, amount, targetROI, initialShare)
3. Investor added to activeInvestors array
4. System begins tracking their ROI progress
```

### 2. Revenue Generation & Distribution

```
1. Community generates revenue (marketplace sales, project income, etc.)
2. DISTRIBUTOR_ROLE calls distributeRevenue(totalAmount)
3. System calculates current ROI for each investor
4. Determines current share based on ROI progress
5. Distributes proportionally to eligible investors
6. Remaining revenue goes to workers and treasury
```

### 3. ROI Target Achievement & Transition

```
1. Investor's cumulativeRevenue reaches targetROI threshold
2. calculateInvestorShare() returns 0 for that investor
3. Investor automatically deactivated from future distributions
4. Their share reallocated to community (workers + treasury)
5. Community achieves full economic autonomy
```

## 🎛️ Configuration Examples

### Startup Phase Configuration
```solidity
// High investor share during community bootstrapping
registerInvestor(earlyInvestor, 10000e18, 20000, 4000); // $10k invested, 200% ROI target, 40% initial share
```

### Growth Phase Configuration  
```solidity
// Lower investor share as community matures
registerInvestor(growthInvestor, 50000e18, 15000, 2000); // $50k invested, 150% ROI target, 20% initial share
```

### Revenue Distribution Parameters
```solidity
// Configure community vs investor split
setWorkersShare(3000);    // 30% to workers
setTreasuryShare(2000);   // 20% to treasury  
// Remaining 50% to investors (dynamically allocated)
```

## 🚀 Advanced Features

### ROI Calculation Variants

The contract supports different ROI calculation methods:

```solidity
enum ROICalculationMethod {
    LINEAR_DECAY,      // Current implementation
    EXPONENTIAL_DECAY, // Faster transition to community ownership
    STEP_FUNCTION     // Discrete ROI thresholds
}
```

### Time-Based Adjustments

```solidity
struct TimeBasedAdjustment {
    uint256 vestingPeriod;     // Minimum investment period
    uint256 accelerationRate;  // ROI acceleration for long-term investors
    uint256 penaltyRate;       // Early exit penalties
}
```

### Multi-Asset Revenue Support

Future versions can support multiple revenue tokens:

```solidity
mapping(address => bool) public supportedTokens;
mapping(address => mapping(address => uint256)) public tokenBalances; // investor => token => balance
```

## 📈 Economic Model Analysis

### Investor Incentives
- **Early Risk Compensation**: Higher initial shares for early investors
- **Predictable Returns**: Clear ROI targets with transparent progress tracking
- **Automatic Exit**: No manual process needed when targets achieved

### Community Benefits
- **Gradual Ownership**: Community share increases over time
- **Sustainable Returns**: Investor returns are capped, preventing excessive extraction
- **Economic Independence**: Full community control after investor ROI satisfaction

### Long-term Sustainability
- **Worker Retention**: Increasing worker share over time
- **Treasury Growth**: Growing treasury reserves for community initiatives  
- **Reinvestment Capacity**: Revenue available for community expansion

---

The RevenueRouter contract creates a **self-terminating investment model** where early financial supporters receive fair returns while ensuring the community ultimately achieves full economic autonomy, aligning short-term capital needs with long-term decentralized ownership goals.