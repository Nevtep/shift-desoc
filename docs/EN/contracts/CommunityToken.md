# CommunityToken Contract

## 🎯 Purpose & Role

The **CommunityToken** serves as a 1:1 USDC-backed stablecoin that provides transparent community payments and treasury management. It enables communities to maintain stable value for work compensation while offering the benefits of programmable money through smart contracts, automated revenue distribution, and governance integration.

## 🏗️ Core Architecture  

### 1:1 USDC Backing Model

```solidity
contract CommunityToken is ERC20 {
    IERC20 public immutable USDC;
    uint256 public totalBacking;     // Total USDC held as backing
    
    // 1:1 redemption guarantee
    function mint(uint256 usdcAmount) external {
        USDC.transferFrom(msg.sender, address(this), usdcAmount);
        totalBacking += usdcAmount;
        _mint(msg.sender, usdcAmount);
    }
    
    function redeem(uint256 tokenAmount) external {
        _burn(msg.sender, tokenAmount);
        totalBacking -= tokenAmount;
        USDC.transfer(msg.sender, tokenAmount);
    }
}
```

### Reserve Management

**Full Collateralization**:
- Every CommunityToken is backed by exactly 1 USDC
- No fractional reserves or algorithmic stabilization
- Transparent on-chain verification of backing ratio
- Instant redemption without penalty or delay

**Reserve Tracking**:
```solidity
function getBackingRatio() external view returns (uint256) {
    uint256 totalSupply = totalSupply();
    if (totalSupply == 0) return 1e18; // 100% when no tokens exist
    return (USDC.balanceOf(address(this)) * 1e18) / totalSupply;
}

// Should always return 1e18 (100%) in normal operation
```

## ⚙️ Key Functions & Logic

### Minting Process

```solidity
function mint(uint256 usdcAmount) external returns (uint256 tokensIssued) {
    require(usdcAmount > 0, "Amount must be positive");
    
    // Transfer USDC from user to contract
    bool success = USDC.transferFrom(msg.sender, address(this), usdcAmount);
    require(success, "USDC transfer failed");
    
    // Update backing tracker
    totalBacking += usdcAmount;
    
    // Mint equivalent tokens (1:1 ratio)
    _mint(msg.sender, usdcAmount);
    
    emit TokensMinted(msg.sender, usdcAmount);
    return usdcAmount;
}
```

**Use Cases**:
- Workers converting USDC payments to programmable community tokens
- Treasury operations requiring smart contract integration
- Cross-community transfers with unified accounting

### Redemption Process

```solidity
function redeem(uint256 tokenAmount) external returns (uint256 usdcRedeemed) {
    require(tokenAmount > 0, "Amount must be positive");
    require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
    
    // Burn tokens first (CEI pattern)
    _burn(msg.sender, tokenAmount);
    
    // Update backing tracker
    totalBacking -= tokenAmount;
    
    // Transfer USDC to user
    bool success = USDC.transfer(msg.sender, tokenAmount);
    require(success, "USDC transfer failed");
    
    emit TokensRedeemed(msg.sender, tokenAmount);
    return tokenAmount;
}
```

**Guaranteed Liquidity**:
- No minimum redemption amount
- No redemption fees or penalties
- Immediate settlement without waiting periods
- Always maintains 1:1 parity with USDC

### Treasury Integration

```solidity
function mintForTreasury(uint256 amount, address treasury) 
    external onlyRole(TREASURY_MANAGER_ROLE)
```

**Purpose**: Enables automated treasury operations without requiring USDC pre-funding.

**Mechanics**:
- Used by revenue distribution systems
- Allows atomic treasury funding and token distribution
- Maintains backing ratio through coordinated operations
- Requires proper access control and audit trails

## 🛡️ Security Features

### Access Control

```solidity
bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER");
bytes32 public constant PAUSE_MANAGER_ROLE = keccak256("PAUSE_MANAGER");

modifier onlyTreasuryManager() {
    require(hasRole(TREASURY_MANAGER_ROLE, msg.sender), "Not treasury manager");
    _;
}
```

**Role Hierarchy**:
- **DEFAULT_ADMIN_ROLE**: Protocol governance for emergency situations
- **TREASURY_MANAGER_ROLE**: Revenue router and treasury contracts
- **PAUSE_MANAGER_ROLE**: Emergency pause capability for security incidents

### Emergency Controls

```solidity
contract CommunityToken is ERC20, Pausable, AccessControl {
    function pause() external onlyRole(PAUSE_MANAGER_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // All transfers blocked when paused
    function _beforeTokenTransfer(address from, address to, uint256 amount) 
        internal override whenNotPaused
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
```

### Backing Validation

```solidity
function validateBacking() external view returns (bool) {
    uint256 expectedBacking = totalSupply();
    uint256 actualUSDC = USDC.balanceOf(address(this));
    
    // Allow for tiny rounding differences
    return actualUSDC >= expectedBacking;
}

// Automated checks in critical operations
modifier requireFullBacking() {
    _;
    require(validateBacking(), "Backing ratio compromised");
}
```

## 🔗 Integration Points

### With Revenue Distribution

```solidity
// RevenueRouter distributes payments in CommunityTokens
contract RevenueRouter {
    function distributeRevenue(uint256 totalRevenue, uint256[3] calldata splits) external {
        CommunityToken token = CommunityToken(communityTokenAddress);
        
        // Mint tokens for distribution
        token.mintForTreasury(totalRevenue, address(this));
        
        // Distribute according to governance-set splits
        token.transfer(workersPool, totalRevenue * splits[0] / 10000);
        token.transfer(treasury, totalRevenue * splits[1] / 10000);  
        token.transfer(investors, totalRevenue * splits[2] / 10000);
    }
}
```

### With Claims Payment

```solidity
// Claims contract pays workers in CommunityTokens
contract Claims {
    function _payWorker(address worker, uint256 amount) internal {
        CommunityToken communityToken = CommunityToken(tokenAddress);
        
        // Pay worker in stable, programmable tokens
        communityToken.transfer(worker, amount);
        
        emit WorkerPaid(worker, amount);
    }
}
```

### With Cross-Community Transfers

```solidity
// Bridge contract for cross-community payments
contract CommunityBridge {
    function transferBetweenCommunities(
        uint256 fromCommunityId,
        uint256 toCommunityId, 
        uint256 amount,
        address recipient
    ) external {
        // Burn tokens from source community
        CommunityToken fromToken = getCommunityToken(fromCommunityId);
        fromToken.burnFrom(msg.sender, amount);
        
        // Mint tokens in destination community  
        CommunityToken toToken = getCommunityToken(toCommunityId);
        toToken.mintForTreasury(amount, recipient);
    }
}
```

## 📊 Economic Model

### Stability Mechanism

**Price Stability**:
- 1:1 USDC backing eliminates depegging risk
- Instant redemption provides natural arbitrage mechanism  
- No algorithmic interventions or complex stabilization required
- Transparent reserves enable real-time verification

**Monetary Policy**:
- Token supply follows demand without artificial constraints
- Community growth naturally increases token supply through work payments
- No inflation or deflation beyond USDC's inherent stability
- Predictable value for long-term planning and contracts

### Treasury Economics

**Working Capital Management**:
```solidity
struct TreasuryBalance {
    uint256 communityTokens;    // Available for immediate payments
    uint256 usdcReserves;       // Backing for community tokens
    uint256 investmentAssets;   // Diversified treasury holdings
}
```

**Cash Flow Optimization**:
- Keep operational funds in CommunityTokens for smart contract integration
- Maintain USDC reserves for immediate redemptions
- Invest surplus in yield-bearing assets while maintaining backing ratio

### Fee Structure

**No User Fees**:
- Minting: Free (only gas costs)
- Redemption: Free (only gas costs)  
- Transfers: Standard ERC-20 gas costs
- Governance operations: Subsidized by treasury

**Operational Costs**:
- Smart contract deployment and upgrades
- Oracle feeds for multi-asset backing (future)
- Insurance and security audits
- Governance and administrative overhead

## 🎛️ Configuration Examples

### Basic Deployment

```solidity
// Deploy with USDC backing
CommunityToken communityToken = new CommunityToken(
    "DeveloperDAO Token",
    "DEVDAO",
    USDC_ADDRESS,
    treasuryManager,    // Revenue router contract
    pauseManager        // Emergency response multisig
);

// Set up revenue distribution
RevenueRouter router = new RevenueRouter(
    address(communityToken),
    communityId,
    [7000, 2000, 1000]  // 70% workers, 20% treasury, 10% investors
);
```

### Treasury Operations

```solidity
// Worker receives payment
uint256 workValue = 1000e6; // 1000 USDC worth of work
communityToken.mintForTreasury(workValue, treasury);
communityToken.transferFrom(treasury, worker, workValue);

// Worker can immediately use tokens or redeem to USDC
if (worker.prefersUSDC()) {
    communityToken.redeem(workValue); // Gets 1000 USDC back
}
```

### Cross-Community Integration

```solidity
// Shared infrastructure between communities
contract SharedMarketplace {
    function purchaseService(
        uint256 serviceId,
        address paymentToken,  // Any CommunityToken
        uint256 amount
    ) external {
        CommunityToken token = CommunityToken(paymentToken);
        
        // Accept any community's token due to USDC backing
        token.transferFrom(msg.sender, serviceProvider, amount);
        
        emit ServicePurchased(serviceId, msg.sender, amount);
    }
}
```

## 🚀 Advanced Features

### Multi-Asset Backing (Future)

```solidity
contract EnhancedCommunityToken is CommunityToken {
    struct BackingAsset {
        IERC20 token;
        uint256 weight;        // Percentage of backing (basis points)
        address oracle;        // Price feed for conversion
        bool active;
    }
    
    mapping(address => BackingAsset) public backingAssets;
    
    function addBackingAsset(
        address asset,
        uint256 weight,
        address oracle
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Enable diversified backing beyond just USDC
        // Requires governance approval and risk assessment
    }
}
```

### Yield Generation

```solidity
contract YieldBearingCommunityToken is CommunityToken {
    // Invest backing USDC in yield strategies
    function investReserves(
        address yieldStrategy,
        uint256 amount
    ) external onlyRole(TREASURY_MANAGER_ROLE) {
        require(amount <= getExcessReserves(), "Insufficient excess reserves");
        
        // Maintain minimum backing ratio while earning yield
        IYieldStrategy(yieldStrategy).invest(USDC, amount);
    }
    
    function distributeYield() external {
        uint256 yield = getAccumulatedYield();
        
        // Distribute yield to token holders pro-rata
        _distributeProRata(yield);
    }
}
```

### Governance Integration

```solidity
contract GovernanceCommunityToken is CommunityToken, ERC20Votes {
    // Token holders can participate in governance
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }
    
    // Voting power scales with economic stake
    function getVotes(address account) public view override returns (uint256) {
        return balanceOf(account);
    }
}
```

## 📈 Scaling Considerations

### Network Efficiency

**Layer 2 Deployment**:
- Deploy on Polygon, Arbitrum, or Optimism for lower gas costs
- Maintain L1 reserves with L2 operations for best of both worlds
- Cross-layer bridges for seamless user experience

**Batch Operations**:
```solidity
function mintBatch(address[] calldata recipients, uint256[] calldata amounts) 
    external onlyRole(TREASURY_MANAGER_ROLE)
{
    uint256 totalAmount = 0;
    for (uint256 i = 0; i < recipients.length; i++) {
        totalAmount += amounts[i];
        _mint(recipients[i], amounts[i]);
    }
    
    // Single USDC transfer for entire batch
    USDC.transferFrom(msg.sender, address(this), totalAmount);
}
```

### Cross-Chain Expansion

**Unified Token Standard**:
- Same token contract deployed across multiple chains
- Cross-chain bridges maintain USDC backing consistency
- Unified user experience regardless of chain

**Reserve Allocation**:
- Distribute USDC reserves across chains based on usage patterns
- Rebalancing mechanisms for optimal liquidity
- Emergency cross-chain reserve sharing

The CommunityToken provides the stable financial foundation that enables all other Shift DeSoc economic activities while maintaining the programmability and transparency benefits of blockchain-based systems.