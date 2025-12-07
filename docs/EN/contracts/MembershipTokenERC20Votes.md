# MembershipTokenERC20Votes Contract

## 🎯 Purpose & Role

The **MembershipTokenERC20Votes** serves as the **pure merit-based governance token** for Shift DeSoc communities. Unlike traditional tokens that can be bought, MembershipTokens can **only be earned through completing verified ValuableActions**. This creates a governance system where voting power is directly tied to proven contributions rather than financial investment.

**Core Principle**: "Pure merit-based governance where voting power is EARNED, not bought" - tokens minted only when Claims are approved for ValuableAction completion.

**Current Status**: ⚡ **Production-Ready** - Simple, secure governance token with proper role-based minting controls and comprehensive testing coverage.

## 🏗️ Core Architecture

### Merit-Only Token System

**Simple & Secure Design**:

```solidity
contract MembershipTokenERC20Votes is ERC20, ERC20Votes, ERC20Permit, AccessControlEnumerable {
    /// @notice Role for contracts that can mint tokens (Claims, CommunityFactory)
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Maximum supply cap to prevent inflation attacks
    uint256 public constant MAX_SUPPLY = 100_000_000 ether; // 100M tokens max

    /// @notice Community ID this token belongs to
    uint256 public immutable communityId;

    /// @notice Pure governance voting power - 1 token = 1 vote
    function getVotes(address account) public view override returns (uint256) {
        return super.getVotes(account); // Standard ERC20Votes delegation
    }
}
```

**Architecture Philosophy**:

- **Simplicity over complexity** - No hybrid systems or reputation multipliers
- **Merit over capital** - Tokens can only be minted through verified work completion
- **Security first** - Role-based access control with governance oversight
- **Standard compliance** - Pure OpenZeppelin implementation for maximum compatibility

### Vote Delegation System

**Flexible Representation**:

```solidity
// Inherited from ERC20Votes
function delegate(address delegatee) public override {
    _delegate(msg.sender, delegatee);
}

function delegateBySig(
    address delegatee,
    uint256 nonce,
    uint256 expiry,
    uint8 v,
    bytes32 r,
    bytes32 s
) public override {
    // Gasless delegation via signatures
    _delegate(signer, delegatee);
}
```

**Vote Tracking**:

- **Historical Snapshots**: Vote weights at specific block numbers for proposal creation
- **Delegation Chain**: Multi-level delegation with cycle detection
- **Real-time Updates**: Vote weights update automatically on token transfers
- **Gasless Operations**: EIP-2612 permit integration for meta-transactions

## ⚙️ Key Functions & Logic

### Token Minting (Merit-Based Only)

```solidity
function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
    if (to == address(0)) revert Errors.ZeroAddress();
    if (amount == 0) revert Errors.InvalidInput("Amount cannot be zero");

    // Check supply cap
    uint256 newTotalSupply = totalSupply() + amount;
    if (newTotalSupply > MAX_SUPPLY) {
        revert Errors.InvalidInput("Would exceed max supply");
    }

    _mint(to, amount);
    emit TokensMintedForWork(to, amount, msg.sender, reason);
}
```

**Distribution Mechanisms (Merit-Only)**:

- **NO Initial Distribution** - Zero token supply at deployment
- **Work Rewards ONLY** - Tokens minted when Claims are approved by VPS (VerifierManager + democratic verification)
- **NO Purchase Mechanism** - Cannot be bought with ETH/USDC
- **NO Staking Rewards** - Only earned through verified contributions
- **Founder Bootstrap** - CommunityFactory mints initial tokens for founders only during community creation

### Governance Integration

```solidity
// Standard ERC20Votes snapshot system (inherited from OpenZeppelin)
function getPastVotes(address account, uint256 blockNumber)
    public view override returns (uint256)
{
    return super.getPastVotes(account, blockNumber);
}

function getPastTotalSupply(uint256 blockNumber)
    public view override returns (uint256)
{
    return super.getPastTotalSupply(blockNumber);
}
```

**Governance Features**:

- **Standard OpenZeppelin Integration**: Works with any Governor contract out of the box
- **Delegation Support**: Full ERC20Votes delegation with delegation by signature
- **Historical Snapshots**: Vote weights locked at proposal creation prevent manipulation
- **Simple Voting Power**: 1 token = 1 vote, no complex calculations

### Batch Minting for Efficiency

```solidity
function batchMint(
    address[] calldata recipients,
    uint256[] calldata amounts,
    string calldata reason
) external onlyRole(MINTER_ROLE) {
    // Gas-efficient batch minting for CommunityFactory founder distribution
}
```

**Use Cases**:

- **Community Bootstrapping**: CommunityFactory mints initial tokens for founders
- **Bulk Rewards**: Claims contract mints tokens for multiple approved claims
- **Gas Optimization**: Reduced transaction costs for multiple recipients

## 🛡️ Security Features

### Strict Access Control

```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

/// @notice Only authorized contracts can mint tokens
function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
    // Strict validation and supply cap checks
}
```

**Role Management**:

- **MINTER_ROLE**: Only Claims contract and CommunityFactory can mint tokens
- **GOVERNANCE_ROLE**: Community governance for role management and emergency functions
- **DEFAULT_ADMIN_ROLE**: Initial setup and admin operations
- **No PAUSER_ROLE**: No pause mechanism - tokens should always be transferable for governance

### Supply Cap Protection

```solidity
/// @notice Maximum supply cap to prevent inflation attacks
uint256 public constant MAX_SUPPLY = 100_000_000 ether; // 100M tokens max

function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
    uint256 newTotalSupply = totalSupply() + amount;
    if (newTotalSupply > MAX_SUPPLY) {
        revert Errors.InvalidInput("Would exceed max supply");
    }
    _mint(to, amount);
}
```

**Protection Mechanisms**:

- **Hard Supply Cap**: Cannot mint more than 100M tokens total
- **Merit-Only Minting**: No purchase mechanism prevents inflation attacks
- **Role-Based Control**: Only authorized contracts can mint
- **Governance Oversight**: Community can revoke minting permissions

### Emergency Governance Functions

```solidity
function emergencyBurn(address from, uint256 amount) external onlyRole(GOVERNANCE_ROLE) {
    // Emergency burn for governance - only in extreme situations
    _burn(from, amount);
}

function grantMinterRole(address account) external onlyRole(GOVERNANCE_ROLE) {
    _grantRole(MINTER_ROLE, account);
}
```

**Emergency Powers**:

- **Emergency Burn**: Governance can burn tokens if needed (e.g., compromised account)
- **Role Management**: Add/remove authorized minters via governance
- **No Pause Mechanism**: Transfers always work to prevent governance lockout

## 🔗 Integration Points

### Claims System Integration

The MembershipToken is minted automatically when workers complete verified work:

```solidity
// In Claims.sol - mint governance tokens on successful work verification
function approveClaim(uint256 claimId) external {
    Claim storage claim = claims[claimId];

    // Get reward from ValuableAction configuration
    ValuableAction memory action = valuableActionRegistry.getAction(claim.actionId);

    // Mint governance tokens to worker based on completed work value
    membershipToken.mint(
        claim.worker,
        action.membershipTokenReward,
        string(abi.encodePacked("Work verified - Claim:", claimId))
    );
}
```

### Community Factory Integration

```solidity
// In CommunityFactory.sol - founders get initial tokens for bootstrap governance
function createCommunity(CommunityParams calldata params) external returns (uint256 communityId) {
    // Deploy MembershipToken for the new community
    MembershipTokenERC20Votes membershipToken = new MembershipTokenERC20Votes(
        communityId,
        params.name,
        params.symbol
    );

    // Grant initial tokens to founders for bootstrap governance
    for (uint i = 0; i < params.founders.length; i++) {
        membershipToken.mint(params.founders[i], params.founderTokens, "Community founder");
    }
}
```

### Governance Integration

```solidity
// In ShiftGovernor.sol - voting power comes directly from earned tokens
function getVotes(address account, uint256 blockNumber) public view returns (uint256) {
    // Simple 1:1 token to voting power ratio - merit-based only
    return membershipToken.getPastVotes(account, blockNumber);
}

function propose(...) public returns (uint256) {
    // Must have earned minimum tokens through work to propose
    require(
        getVotes(msg.sender, block.number - 1) >= proposalThreshold(),
        "Insufficient governance tokens from completed work"
    );

    return super.propose(targets, values, calldatas, description);
}
```

### Treasury Operations Integration

```solidity
// In TreasuryAdapter.sol - governance controls spending
function spendFunds(address recipient, uint256 amount, string calldata purpose)
    external
    onlyRole(TREASURER_ROLE)
{
    require(
        membershipToken.getVotes(msg.sender) >= minimumTreasurerTokens,
        "Insufficient governance tokens for treasurer role"
    );

    // Execute authorized spending
    communityToken.transfer(recipient, amount);
    emit FundsSpent(recipient, amount, purpose);
}
```

## 📊 Economic Model

### Merit-Only Token Distribution

**No Initial Supply**: Unlike traditional tokens, MembershipTokens have zero initial allocation:

```solidity
constructor(uint256 _communityId, string memory name, string memory symbol)
    ERC20(name, symbol)
    ERC20Permit(name)
{
    communityId = _communityId;
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    // No initial mint - all tokens must be earned
}
```

**Work-Based Issuance**:

- **✅ Verified Claims**: Tokens minted when community approves completed work
- **✅ Founder Bootstrap**: Minimal initial allocation for community startup
- **❌ No Purchases**: Cannot buy governance power with money
- **❌ No Airdrops**: No free distribution - must contribute value

### Governance Economics

**Participation Requirements**:

```solidity
function proposalThreshold() public view override returns (uint256) {
    uint256 totalSupply = membershipToken.totalSupply();

    // Start low for small communities, scale with growth
    if (totalSupply < 1000e18) return 10e18;        // 10 tokens minimum
    if (totalSupply < 10000e18) return 100e18;      // 100 tokens when medium
    return (totalSupply * 100) / 10000;             // 1% for large communities
}
```

**Simple Governance Model**:

- **1:1 Voting**: One token = one vote, no complex calculations
- **Merit-Based**: Voting power must be earned through verified work
- **Supply Capped**: Maximum 100M tokens prevents inflation attacks
- **No Purchase Path**: Cannot buy governance influence with money

### Anti-Plutocracy Protection

**Supply Cap Defense**:

```solidity
uint256 public constant MAX_SUPPLY = 100_000_000 ether; // Hard cap prevents concentration

function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
    require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds maximum supply");
    _mint(to, amount);
    emit TokensMinted(to, amount, reason);
}
```

**Merit-Only Access**:

- **Work Verification Required**: All tokens earned through Claims system
- **No Secondary Market**: Focus on contribution, not speculation
- **Governance Control**: Community can revoke minting permissions
- **Transparent Allocation**: All minting events logged with reasons

## 🎛️ Configuration Examples

### Basic Community Deployment

```solidity
// Deploy via CommunityFactory for new community
CommunityFactory factory = new CommunityFactory();

CommunityParams memory params = CommunityParams({
    name: "Dev Collective",
    symbol: "DEVC",
    founders: [founder1, founder2, founder3],
    founderTokens: 1000e18,  // 1000 tokens each for initial governance
    initialValuableActions: [codeReview, bugFix, documentation]
});

uint256 communityId = factory.createCommunity(params);
```

### Work-Based Token Distribution

```solidity
// ValuableAction configuration drives token distribution
ValuableAction memory codeReview = ValuableAction({
    membershipTokenReward: 100e18,    // 100 governance tokens per code review
    communityTokenReward: 50e18,      // 50 USDC equivalent salary credit
    jurorsMin: 2,                     // 2 reviewers must approve
    panelSize: 3,                     // From pool of 3 potential reviewers
    evidenceTypes: GITHUB_PR | IPFS_REPORT,
    cooldownPeriod: 1 days           // Max 1 review per day per person
});

// Tokens automatically minted when claims approved
// No manual distribution needed
```

### Simple Governance Setup

```solidity
// ShiftGovernor uses standard OpenZeppelin Governor with MembershipToken
ShiftGovernor governor = new ShiftGovernor(
    IVotes(membershipToken),    // Voting power from earned tokens
    timelock,                   // 48 hour execution delay
    7200,                       // 1 day voting delay
    50400,                      // 1 week voting period
    100e18,                     // 100 tokens to propose (earned through work)
    1000e18                     // 1000 token quorum minimum
);

// No complex reputation calculations - simple merit-based voting
```

## 🚀 Advanced Features

### EIP-2612 Permit Support

The token includes gasless transaction support via EIP-2612:

```solidity
// Built-in permit functionality from ERC20Permit
function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;

// Enables gasless delegation and transfers
function delegateBySig(
    address delegatee,
    uint256 nonce,
    uint256 expiry,
    uint8 v,
    bytes32 r,
    bytes32 s
) external;
```

**Benefits**:

- **Gasless Governance**: Users can vote without holding ETH
- **Mobile Accessibility**: Easier participation from mobile wallets
- **Onboarding Improvement**: Remove gas barriers for new members

### Batch Operations

```solidity
function batchMint(
    address[] calldata recipients,
    uint256[] calldata amounts,
    string[] calldata reasons
) external onlyRole(MINTER_ROLE) {
    require(recipients.length == amounts.length && amounts.length == reasons.length,
           "Array length mismatch");

    for (uint256 i = 0; i < recipients.length; i++) {
        mint(recipients[i], amounts[i], reasons[i]);
    }
}
```

**Optimization Features**:

- **Gas Efficient**: Batch multiple operations in single transaction
- **Audit Trail**: Individual reasons for each token mint
- **Role Security**: Same access controls as individual operations

## 📈 Future Considerations

### Community Growth Patterns

**Scaling Challenges**:

- **Token Distribution**: How to maintain fair distribution as community grows
- **Governance Participation**: Preventing voter apathy in large communities
- **Merit Verification**: Scaling the Claims system with increased membership
- **Economic Sustainability**: Balancing token rewards with community treasury

### Integration Opportunities

**Cross-Protocol Compatibility**:

```solidity
// Standard ERC20Votes enables integration with existing governance tools
interface IGovernanceIntegration {
    function getVotingPower(address token, address account) external view returns (uint256);
    function delegateAcrossProtocols(address token, address delegate) external;
}
```

**Potential Enhancements**:

- **Multi-Community Voting**: Federated governance across related communities
- **Quadratic Voting**: Alternative voting mechanisms for specific proposal types
- **Time-Weighted Voting**: Longer community members get slightly higher influence
- **Reputation Integration**: Future integration with WorkerSBT reputation system

### Security Considerations

**Long-term Robustness**:

- **Supply Cap Protection**: 100M token limit prevents inflation attacks
- **Role Management**: Governance controls all critical permissions
- **Emergency Procedures**: Minimal emergency powers to prevent governance capture
- **Upgrade Path**: Consider proxy patterns for critical bug fixes

The MembershipTokenERC20Votes contract provides a solid foundation for merit-based governance that can evolve with community needs while maintaining the core principle: **governance power must be earned through valuable contributions, not purchased with money**.
