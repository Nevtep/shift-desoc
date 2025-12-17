# VerifierPowerToken1155 Contract

## 🎯 Purpose & Role

The VerifierPowerToken1155 contract implements **per-community verifier power tokens** using the ERC-1155 standard with exclusive timelock governance control. It provides the foundational token layer for Shift DeSoc's Verifier Power System (VPS), ensuring verifier authority is democratically granted and cannot be self-acquired or traded.

## 🏗️ Core Architecture

### ERC-1155 Token Design

```solidity
// Token ID = Community ID mapping
// Each community gets its own verifier power token type
// Token balance = verifier power amount for that community

contract VerifierPowerToken1155 is ERC1155, AccessControl {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    
    mapping(uint256 => uint256) public totalSupply;              // Community total power
    mapping(uint256 => bool) public communityInitialized;       // Community setup status
}
```

### Non-Transferable Power Model

**Design Philosophy**: Verifier power represents community trust and governance authority, not tradeable economic value. Only timelock governance can mint, burn, or transfer verifier power tokens.

## ⚙️ Key Functions & Logic

### Community Initialization

```solidity
function initializeCommunity(
    uint256 communityId, 
    string calldata metadataURI
) external onlyRole(TIMELOCK_ROLE)
```

**Setup Process**:
1. **First-Time Setup**: Prevents double initialization of community verifier systems
2. **Metadata Storage**: Links IPFS metadata containing community verifier policies
3. **State Preparation**: Enables minting operations for the new community
4. **Event Emission**: Records community activation for indexing and governance tracking

### Verifier Power Granting

```solidity
function mint(
    address to, 
    uint256 communityId, 
    uint256 amount, 
    string calldata reasonCID
) external onlyRole(TIMELOCK_ROLE)
```

**Governance-Controlled Minting**:
- **Authorization Check**: Only timelock can execute (requires governance approval)
- **Community Validation**: Ensures community is initialized before power distribution
- **Reason Requirement**: All power grants must include IPFS justification hash
- **Supply Tracking**: Updates total community power for analytics and limits

**Batch Operations**:
```solidity
function batchMint(
    address[] calldata to,
    uint256 communityId,
    uint256[] calldata amounts,
    string calldata reasonCID
) external onlyRole(TIMELOCK_ROLE)
```

### Verifier Power Revocation

```solidity
function burn(
    address from, 
    uint256 communityId, 
    uint256 amount,
    string calldata reasonCID
) external onlyRole(TIMELOCK_ROLE)
```

**Democratic Power Removal**:
1. **Balance Validation**: Ensures sufficient power exists before burning
2. **Governance Requirement**: Only community governance can revoke verifier power
3. **Transparency**: All revocations must include public reasoning on IPFS
4. **Supply Adjustment**: Decreases total community power accordingly

**Disciplinary Applications**:
- **Performance Issues**: Remove power from consistently inaccurate verifiers
- **Policy Violations**: Revoke power for violating community verification standards
- **Inactive Verifiers**: Reclaim power from non-participating community members

## 🛡️ Security Features

### Transfer Prevention System

```solidity
function safeTransferFrom() public virtual override {
    revert TransfersDisabled();
}

function safeBatchTransferFrom() public virtual override {
    revert TransfersDisabled();
}
```

**Anti-Trading Enforcement**:
- **Complete Transfer Block**: No marketplace trading of verifier power
- **Social Capital Protection**: Prevents commodification of community trust
- **Governance Integrity**: Ensures power distribution reflects community decisions

### Administrative Transfer (Governance Only)

```solidity
function adminTransfer(
    address from,
    address to,
    uint256 communityId,
    uint256 amount,
    string calldata reasonCID
) external onlyRole(TIMELOCK_ROLE)
```

**Legitimate Transfer Use Cases**:
- **Governance Restructuring**: Move power between addresses during community governance changes
- **Account Migration**: Help community members migrate to new addresses
- **Disciplinary Actions**: Transfer power as part of dispute resolution processes

### Role-Based Access Control

| Role | Permissions | Security Model |
|------|-------------|----------------|
| **TIMELOCK_ROLE** | All token operations | Community governance only |
| **DEFAULT_ADMIN_ROLE** | Role management | Revoked from deployer |
| **Public** | View functions only | Read-only access |

## 🔗 Integration Points

### VerifierElection Synchronization

```solidity
// VerifierElection calls VPT functions to maintain power distribution
interface IVPT1155 {
    function mint(address to, uint256 id, uint256 amount, string calldata reasonCID) external;
    function burn(address from, uint256 id, uint256 amount, string calldata reasonCID) external;
}

// Synchronized operations ensure consistency
function updateVerifierPower(address verifier, uint256 newPower) {
    // VerifierElection computes power delta and calls mint/burn accordingly
    if (newPower > currentPower) {
        vpt.mint(verifier, communityId, newPower - currentPower, reasonCID);
    }
}
```

### VerifierManager Selection Integration

```solidity
function hasVerifierPower(address account, uint256 communityId) external view returns (bool) {
    return balanceOf(account, communityId) > 0;
}

function getCommunityStats(uint256 communityId) external view returns (
    uint256 activeVerifiers,
    uint256 totalPower,
    bool initialized
) {
    // Used by VerifierManager for selection pool assessment
}
```

### Claims Contract Authorization

```solidity
// Claims contract checks verifier authorization via VPT balance
function verifyClaimVPS(uint256 claimId, bool approved) external {
    uint256 communityId = _getClaimCommunity(claimId);
    require(vpt.balanceOf(msg.sender, communityId) > 0, "No verifier power");
    // Process verification with governance-granted authority
}
```

## 📊 Economic Model

### Non-Economic Value System

**VPS Token Characteristics**:

| Aspect | Traditional Token | VPT Token |
|--------|------------------|-----------|
| **Acquisition** | Purchase/mining | Governance grant |
| **Transfer** | Free trading | Governance only |
| **Value Source** | Market price | Community trust |
| **Loss Mechanism** | Sale/burn | Governance revocation |

### Community-Controlled Distribution

**Power Allocation Patterns**:

```solidity
// Example community verifier power distributions

// Equal Democracy (all verifiers equal power)
batchMint([alice, bob, charlie], communityId, [100, 100, 100], "equal-democracy");

// Merit-Based (power reflects contribution)
batchMint([senior, junior, newbie], communityId, [200, 100, 50], "merit-based");

// Specialized Roles (different verification domains)
batchMint([techReviewer, contentMod, qualityAssurance], communityId, [150, 100, 175], "specialized-roles");
```

### Dynamic Power Management

**Responsive Community Governance**:
- **Performance Rewards**: Increase power for consistently accurate verifiers
- **Quality Management**: Decrease power for declining verification accuracy
- **Participation Incentives**: Grant additional power for active community involvement
- **Disciplinary Actions**: Remove power for policy violations or harmful behavior

## 🎛️ Configuration Examples

### New Community Bootstrap

```solidity
// 1. Initialize community verifier system
initializeCommunity(communityId, "QmVerifierPolicy123...");

// 2. Grant founding verifier set
address[] memory founders = [founder1, founder2, founder3];
uint256[] memory powers = [100, 100, 100];
batchMint(founders, communityId, powers, "QmFoundingSet456...");
```

### Established Community Management

```solidity
// Add new verifiers after community growth
mint(qualifiedCandidate, communityId, 75, "QmNewVerifier789...");

// Adjust existing verifier power based on performance
burn(underperformingVerifier, communityId, 25, "QmPerformanceAdjustment...");
mint(underperformingVerifier, communityId, 50, "QmAdjustedPower..."); // Net decrease from 100 to 75
```

### Disciplinary Actions

```solidity
// Complete power revocation for policy violations
uint256 revokedPower = balanceOf(violatingVerifier, communityId);
burn(violatingVerifier, communityId, revokedPower, "QmDisciplinaryAction...");

// Transfer power during dispute resolution
adminTransfer(disputedVerifier, temporaryHolder, communityId, 100, "QmDisputeResolution...");
```

## 🚀 Advanced Features

### Community Analytics and Insights

```solidity
function getCommunityStats(uint256 communityId) external view returns (
    uint256 totalActiveVerifiers,    // Number of addresses with power > 0
    uint256 totalPowerDistributed,   // Sum of all verifier power
    uint256 averagePowerPerVerifier, // Mean power distribution
    bool isInitialized              // Community setup status
) {
    // Provides governance with community health metrics
}
```

### Verifier Status Queries

```solidity
function getVerifierPowerDetails(address verifier, uint256 communityId) external view returns (
    uint256 currentPower,           // Current verifier power balance
    bool hasAnyPower,              // Quick authorization check
    uint256 communityTotalPower,   // Context for relative influence
    uint256 relativeInfluence     // Percentage of community power (basis points)
) {
    // Comprehensive verifier status for UI and governance analysis
}
```

### Multi-Community Verifier Tracking

```solidity
function getVerifierCommunities(address verifier) external view returns (
    uint256[] memory communityIds,     // Communities where verifier has power
    uint256[] memory powerAmounts,     // Power amount in each community
    uint256 totalCommunities          // Number of communities with verifier power
) {
    // Cross-community verifier influence analysis
}
```

## Implementation Notes

### Gas Optimization Strategies

**Efficient Batch Operations**:
```solidity
// Batch minting minimizes transaction costs
function batchMint() uses single loop with:
- Pre-calculated total amount
- Single totalSupply update
- Individual mint operations
- Consolidated event emissions
```

**Storage Pattern Optimization**:
```solidity
// Minimize storage reads/writes
uint256 currentTotal = totalSupply[communityId];  // Single SLOAD
currentTotal += totalAmount;                      // Memory operation
totalSupply[communityId] = currentTotal;         // Single SSTORE
```

### Security Implementation Details

**Role Security Model**:
```solidity
constructor(address timelock) {
    _grantRole(DEFAULT_ADMIN_ROLE, timelock);     // Governance control
    _grantRole(TIMELOCK_ROLE, timelock);          // Operational control
    _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);  // Remove deployer privileges
}
```

**Input Validation Patterns**:
```solidity
// Comprehensive validation on all operations
if (to == address(0)) revert Errors.ZeroAddress();
if (amount == 0) revert InvalidAmount(amount);
if (!communityInitialized[communityId]) revert CommunityNotInitialized(communityId);
```

### Integration Requirements

**Required Dependencies**:
- **OpenZeppelin ERC1155**: Token standard implementation
- **OpenZeppelin AccessControl**: Role-based permission system
- **Timelock Controller**: Governance delay and execution control

**Integration Contracts**:
- **VerifierElection**: Power distribution management and synchronization
- **VerifierManager**: Authorization checks for juror selection
- **Claims Contract**: Verifier power validation for claims processing

### Deployment Considerations

**Initialization Sequence**:
1. Deploy VerifierPowerToken1155 with timelock address
2. Verify timelock has TIMELOCK_ROLE
3. Initialize communities via governance proposals
4. Set up VerifierElection with VPT address
5. Configure VerifierManager to read VPT balances

**Governance Integration**:
- Ensure timelock contract has appropriate delay settings
- Configure governance proposals for verifier power changes
- Establish IPFS infrastructure for reasoning documentation
- Set up monitoring for verifier power distribution analytics

---

The VerifierPowerToken1155 contract provides the **democratic foundation** for verifier authority in Shift DeSoc, ensuring that verification power stems from community trust rather than economic capacity, enabling equitable and accountable work verification systems.