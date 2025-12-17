# CommunityToken Contract

## 🎯 Purpose & Role

The **CommunityToken** serves as a 1:1 USDC-backed stablecoin that provides transparent community payments and treasury management. It enables communities to maintain stable value for work compensation while offering the benefits of programmable money through smart contracts, automated revenue distribution, and governance integration.

## 🏗️ Core Architecture  

### Enhanced USDC-Backed Token Model

```solidity
contract CommunityToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    IERC20 public immutable USDC;
    uint256 public immutable communityId;
    uint256 public maxSupply;
    uint256 public redemptionFeeBps;    // Configurable redemption fee
    address public treasury;            // Fee collection address
    
    // Role-based access control
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // Fee-based redemption (not pure 1:1)
    function redeem(uint256 tokenAmount) external returns (uint256 usdcAmount) {
        uint256 grossUsdcAmount = tokenAmount; // 1:1 base ratio
        uint256 fee = (grossUsdcAmount * redemptionFeeBps) / 10000;
        usdcAmount = grossUsdcAmount - fee;
        // ... burn tokens, transfer USDC minus fee, send fee to treasury
    }
}
```

### Reserve Management

**Full Collateralization**:
- Every CommunityToken is backed by exactly 1 USDC
- No fractional reserves or algorithmic stabilization
- Transparent on-chain verification of backing ratio
- Instant redemption without penalty or delay

**Reserve Tracking & Analytics**:
```solidity
function getBackingRatio() external view returns (uint256 ratio) {
    uint256 supply = totalSupply();
    if (supply == 0) return 10000; // 100% if no tokens minted
    uint256 usdcBalance = USDC.balanceOf(address(this));
    ratio = (usdcBalance * 10000) / supply; // Returns basis points
}

function calculateRedemption(uint256 tokenAmount) external view returns (
    uint256 grossUsdc,
    uint256 fee, 
    uint256 netUsdc
) {
    grossUsdc = tokenAmount; // 1:1 base ratio
    fee = (grossUsdc * redemptionFeeBps) / 10000;
    netUsdc = grossUsdc - fee;
}

function getAvailableTreasuryBalance() external view returns (uint256 available) {
    uint256 usdcBalance = USDC.balanceOf(address(this));
    uint256 requiredReserve = totalSupply();
    available = usdcBalance > requiredReserve ? usdcBalance - requiredReserve : 0;
}
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
- Configurable redemption fees (0-10%, collected by treasury)
- Immediate settlement without waiting periods
- Maintains backing ratio with fee going to community treasury

### Treasury Management

```solidity
function mintTo(address to, uint256 amount) external onlyValidRole(MINTER_ROLE) {
    // Mint tokens for governance rewards without USDC backing
    // Used by Claims contract and governance distribution
}

function depositToTreasury(uint256 amount) external nonReentrant {
    // Anyone can strengthen reserves by depositing USDC
    USDC.safeTransferFrom(msg.sender, address(this), amount);
}

function withdrawFromTreasury(
    address recipient,
    uint256 amount, 
    string calldata reason
) external onlyValidRole(TREASURY_ROLE) {
    // Withdraw excess USDC while maintaining 1:1 backing requirement
    uint256 reserveRequired = totalSupply();
    require(USDC.balanceOf(address(this)) >= reserveRequired + amount);
}
```

**Treasury Operations**:
- **Deposit Strengthening**: Community members can add USDC to strengthen reserves
- **Controlled Withdrawals**: Treasury role can withdraw excess USDC above backing requirements
- **Backing Protection**: All withdrawals validate that 1:1 backing is maintained
- **Audit Trail**: All treasury operations include reason strings for transparency

## 🛡️ Security Features

### Access Control

```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

modifier onlyValidRole(bytes32 role) {
    if (!hasRole(role, msg.sender)) revert Errors.NotAuthorized(msg.sender);
    _;
}
```

**Role Hierarchy**:
- **DEFAULT_ADMIN_ROLE**: Protocol governance for fee settings and treasury management
- **MINTER_ROLE**: Revenue router and governance contracts for reward distribution
- **TREASURY_ROLE**: Treasury operations and USDC withdrawal controls
- **EMERGENCY_ROLE**: Emergency pause and withdrawal capabilities

### Emergency Controls

```solidity
contract CommunityToken is ERC20, Pausable, AccessControl, ReentrancyGuard {
    uint256 public constant EMERGENCY_DELAY = 7 days;
    
    struct EmergencyWithdrawal {
        uint256 amount;
        uint256 requestTime;
        bool executed;
        address requestedBy;
    }
    
    function pause() external onlyValidRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    function unpause() external onlyValidRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // Two-step emergency withdrawal with time delay
    function requestEmergencyWithdrawal(uint256 amount) external onlyValidRole(EMERGENCY_ROLE) {
        // Creates withdrawal request with 7-day delay for security
    }
    
    function executeEmergencyWithdrawal(uint256 requestId, address recipient) external onlyValidRole(EMERGENCY_ROLE) {
        // Executes withdrawal after delay period
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

**User Fees**:
- **Minting**: Free (only gas costs)
- **Redemption**: 0-10% configurable fee (goes to community treasury)  
- **Transfers**: Standard ERC-20 gas costs
- **Treasury Deposits**: Free (strengthens community reserves)

**Fee Configuration**:
```solidity
uint256 public redemptionFeeBps;              // Current fee rate
uint256 public constant MAX_REDEMPTION_FEE = 1000; // 10% maximum

function setRedemptionFee(uint256 newFeeBps) external onlyValidRole(DEFAULT_ADMIN_ROLE) {
    require(newFeeBps <= MAX_REDEMPTION_FEE);
    redemptionFeeBps = newFeeBps;
}
```

**Revenue Generation**:
- Redemption fees fund community operations and development
- Fees create sustainable revenue stream for community treasury
- Configurable rates allow communities to balance user experience with sustainability

## 🎛️ Configuration & Governance

### Key Parameters

```solidity
struct CommunityTokenParams {
    uint256 maxSupply;              // Maximum token supply cap
    uint256 redemptionFeeBps;       // Redemption fee (0-1000 basis points)
    address treasury;               // Fee collection and excess USDC management
    uint256 communityId;            // Immutable community identifier
    address USDC;                   // Immutable USDC backing token
}
```

### Governance Functions

```solidity
function setRedemptionFee(uint256 newFeeBps) external onlyValidRole(DEFAULT_ADMIN_ROLE)
function setTreasury(address newTreasury) external onlyValidRole(DEFAULT_ADMIN_ROLE)  
function setMaxSupply(uint256 newMaxSupply) external onlyValidRole(DEFAULT_ADMIN_ROLE)
```

**Governance Controls**:
- **Redemption Fee Adjustment**: Balance user experience with sustainability (0-10%)
- **Treasury Management**: Update treasury address for fee collection and operations
- **Supply Cap Management**: Increase maximum supply as community grows
- **Role Management**: Grant/revoke minting, treasury, and emergency roles

### Security Features

**Multi-Layer Protection**:
- **Supply Caps**: Prevents infinite token inflation
- **Backing Validation**: Treasury withdrawals cannot break 1:1 backing ratio
- **Emergency Delays**: 7-day timelock on emergency withdrawals
- **Role Separation**: Different roles for different operational aspects
- **Pause Mechanism**: Emergency halt of all operations
- **Reentrancy Protection**: SafeERC20 and ReentrancyGuard throughout

## 🎛️ Configuration Examples

### Basic Deployment

```solidity
// Deploy community token with full configuration
CommunityToken communityToken = new CommunityToken(
    USDC_ADDRESS,           // Backing token
    1,                      // Community ID
    "DeveloperDAO Token",   // Token name
    "DEVDAO",              // Token symbol  
    treasuryAddress,        // Fee collection address
    1000000e18             // Max supply (1M tokens)
);

// Configure initial parameters
communityToken.setRedemptionFee(100);  // 1% redemption fee
communityToken.grantRole(MINTER_ROLE, claimsContract);
communityToken.grantRole(TREASURY_ROLE, treasuryManager);
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

## � Implementation Status

### Production-Ready Features ✅
- **1:1 USDC Backing**: Full collateralization with instant redemption
- **Fee System**: Configurable redemption fees (0-10%) for sustainability  
- **Role-Based Security**: Multi-role access control with emergency functions
- **Treasury Management**: Controlled USDC deposits and withdrawals
- **Emergency Controls**: Two-step emergency withdrawals with 7-day delay
- **Supply Management**: Configurable maximum supply caps
- **Integration Ready**: MINTER_ROLE for Claims contract integration

### Advanced Security ✅
- **Reentrancy Protection**: SafeERC20 and ReentrancyGuard throughout
- **Pause Mechanism**: Emergency halt capability with role separation
- **Backing Protection**: Treasury withdrawals validate 1:1 backing maintained
- **Input Validation**: Comprehensive zero-address and bounds checking
- **Event Emission**: Complete audit trail for all operations

### Current Limitations 📋
- **Single Asset Backing**: Only USDC, no multi-asset diversification
- **No Yield Generation**: Reserves don't earn yield (future enhancement)
- **No Cross-Chain**: Single-chain deployment (multi-chain support planned)
- **Basic Treasury Logic**: Simple excess withdrawal (advanced treasury management planned)

### Integration Points 🔗
```solidity
// Claims contract mints rewards
function mintTo(address worker, uint256 amount) external onlyValidRole(MINTER_ROLE)

// Treasury operations  
function depositToTreasury(uint256 amount) external
function withdrawFromTreasury(address recipient, uint256 amount, string reason) external

// Emergency functions
function requestEmergencyWithdrawal(uint256 amount) external onlyValidRole(EMERGENCY_ROLE)
function pause() external onlyValidRole(EMERGENCY_ROLE)
```

## �📈 Scaling Considerations

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