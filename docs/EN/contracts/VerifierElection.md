# VerifierElection Contract

## 🎯 Purpose & Role

The VerifierElection contract implements **governance-controlled verifier set management** for Shift DeSoc's Verifier Power System (VPS). It manages verifier power distribution through timelock governance rather than economic bonding, ensuring democratic control over work verification quality while maintaining community accountability.

## 🏗️ Core Architecture

### Verifier Set Management Structure

```solidity
struct VerifierSet {
    uint64 lastUpdated;             // Last update timestamp
    string lastReasonCID;           // IPFS hash of update reason
}

mapping(uint256 => VerifierSet) public verifierSets;           // Community verifier sets
mapping(uint256 => mapping(address => bool)) public bannedVerifiers;     // Banned verifiers per community
mapping(uint256 => mapping(address => uint64)) public bannedTimestamp;  // Ban timestamps for cooldown logic
```

> **Single canonical roster (SHI-135).** The roster itself is **not** stored here. The `VerifierPowerToken1155` active roster
> is the one source of truth: `getVerifierSet()`, `getEligibleVerifiers()`, `getCommunityStats()` and juror selection
> (`VerifierManager`) all read it, so totals always equal the token's `totalSupply()`. This holds for every path that changes
> a balance: `setVerifierSet`, `adjustVerifierPower`, `banVerifiers`, and direct `VerifierPowerToken1155.mint/batchMint/adminTransfer`.
> A direct mint makes the address eligible immediately (unless it is banned here); it emits only the token's
> `VerifierGranted`/`VerifierRevoked`, not Election events.
> `setVerifierSet` is a full replacement: every token-roster member not in the new set (including directly minted holders) is burned.
> It still rejects an empty set; remove the last verifier with `adjustVerifierPower(v, 0)` or a ban.

### Timelock-Only Governance Model

**Design Philosophy**: All verifier management requires community governance approval through timelock execution, ensuring democratic oversight without economic barriers to participation.

## ⚙️ Key Functions & Logic

### Complete Verifier Set Management

```solidity
function setVerifierSet(
    uint256 communityId,
    address[] calldata addrs,
    uint256[] calldata weights,
    string calldata reasonCID
) external onlyTimelock
```

**Implementation Logic**:
1. **Validation**: Ensures array length matching and positive weights
2. **Power Reconciliation**: Mints missing power, burns excess power via VerifierPowerToken1155
3. **State Update**: Updates verifier set with new addresses and power distribution
4. **Event Emission**: Records change with IPFS reason hash for transparency

**Use Cases**:
- **Initial Setup**: Establish founding verifier set for new community
- **Quality Management**: Remove underperforming verifiers, add qualified candidates
- **Power Rebalancing**: Adjust verifier influence based on reputation and activity

### Individual Verifier Power Adjustment

```solidity
function adjustVerifierPower(
    uint256 communityId,
    address verifier,
    uint256 newPower,
    string calldata reasonCID
) external onlyTimelock
```

**Precision Operations**:
- **Increase Power**: Mints additional VPT tokens to verifier
- **Decrease Power**: Burns excess VPT tokens from verifier
- **Zero Power**: Removes verifier from active set while preserving history

### Verifier Discipline System

```solidity
function banVerifiers(
    uint256 communityId,
    address[] calldata offenders,
    string calldata reasonCID
) external onlyTimelock
```

**Disciplinary Process**:
1. **Power Revocation**: Burns all VPT tokens from banned verifiers
2. **Exclusion Marking**: Adds to banned mapping for future selection exclusion
3. **Timestamp Recording**: Tracks ban time for potential cooldown periods
4. **Governance Transparency**: IPFS evidence hash requirement for accountability

**Restoration Process**:
```solidity
function unbanVerifier(
    uint256 communityId,
    address verifier,
    string calldata reasonCID
) external onlyTimelock
```

## 🛡️ Security Features

### Access Control Architecture

| Actor | Permissions | Enforcement |
|-------|-------------|-------------|
| **Timelock Only** | All verifier management functions | `onlyTimelock` modifier |
| **Public View** | Verifier status and community statistics | No restrictions |
| **No Self-Service** | Verifiers cannot modify own power | Governance requirement |

### Democratic Governance Integration

- **Proposal Process**: All changes require governance proposal and voting
- **Execution Delay**: Timelock delay allows community review of decisions
- **Transparency Requirement**: All actions must include IPFS evidence/reasoning
- **Immutable History**: All verifier changes permanently recorded on-chain

### Anti-Manipulation Protections

```solidity
// Prevent banned verifiers from participating
if (bannedVerifiers[communityId][verifier]) {
    revert Errors.VerifierBanned(verifier, communityId);
}

// Prevent zero power assignments without explicit removal
if (weight == 0 && !isRemoval) {
    revert Errors.InvalidInput("Use removal process for zero power");
}
```

## 🔗 Integration Points

### VerifierPowerToken1155 Integration

```solidity
interface IVPT1155 {
    function mint(address to, uint256 id, uint256 amount, string calldata reasonCID) external;
    function burn(address from, uint256 id, uint256 amount, string calldata reasonCID) external;
    function batchMint(address[] calldata to, uint256 id, uint256[] calldata amounts, string calldata reasonCID) external;
    function batchBurn(address[] calldata from, uint256 id, uint256[] calldata amounts, string calldata reasonCID) external;
}

// Synchronized power management
function _syncVerifierPower(uint256 communityId, address verifier, uint256 currentPower, uint256 targetPower) private {
    if (targetPower > currentPower) {
        vpt.mint(verifier, communityId, targetPower - currentPower, reasonCID);
    } else if (targetPower < currentPower) {
        vpt.burn(verifier, communityId, currentPower - targetPower, reasonCID);
    }
}
```

### VerifierManager Selection Integration

```solidity
function getEligibleVerifiers(uint256 communityId) external view returns (
    address[] memory eligibleVerifiers,
    uint256[] memory eligiblePowers
) {
    // Returns non-banned verifiers with their current power levels
    // Used by VerifierManager for M-of-N juror selection
}
```

### Community Parameter Integration

- **CommunityRegistry**: Reads community-specific verifier requirements
- **ParamController**: Accesses governance-set verification parameters
- **Engagements Contract**: Receives fraud reports and disciplinary recommendations

## 📊 Economic Model

### Non-Economic Incentive Structure

**VPS vs Traditional Bonding**:

| Traditional Bonding | VPS (Verifier Power System) |
|---------------------|------------------------------|
| Economic stake required | Merit-based participation |
| Self-bonding registration | Governance nomination |
| Economic slashing | Social accountability |
| Wealth-based influence | Community-controlled power |

### Community-Controlled Quality Assurance

**Reputation Mechanisms**:
- **Performance Tracking**: VerifierManager reports accuracy statistics
- **Peer Review**: Community evaluation of verification quality
- **Governance Oversight**: Regular review and adjustment of verifier sets
- **Transparent Discipline**: All bans and power changes require public justification

### Sustainable Participation Model

**Long-term Incentives**:
- **Recognition**: Verifier status as community reputation signal
- **Governance Power**: Potential voting influence based on verification contribution
- **Future Rewards**: Token rewards for accurate verification work
- **Community Standing**: Social capital and trust building

## 🎛️ Configuration Examples

### Bootstrapping New Community

```solidity
// Initial verifier set with founding members
address[] memory founders = [alice, bob, charlie];
uint256[] memory powers = [100, 100, 100];  // Equal initial power
string memory reason = "QmABC123...";        // IPFS: "Community founding verifier set"

setVerifierSet(communityId, founders, powers, reason);
```

### Scaling Established Community

```solidity
// Add experienced verifiers with varied power levels
address[] memory verifiers = [existing1, existing2, newVerifier1, newVerifier2];
uint256[] memory powers = [150, 200, 50, 75];  // Merit-based power distribution
string memory reason = "QmDEF456...";          // IPFS: "Q4 verifier performance review"

setVerifierSet(communityId, verifiers, powers, reason);
```

### Quality Management Response

```solidity
// Remove underperforming verifiers
address[] memory offenders = [badVerifier1, badVerifier2];
string memory evidence = "QmGHI789...";  // IPFS: Evidence of poor verification accuracy

banVerifiers(communityId, offenders, evidence);
```

## 🚀 Advanced Features

### Batch Operations for Efficiency

```solidity
// Efficient verifier set updates
function setVerifierSet() supports:
- Batch minting for new verifiers
- Batch burning for removed verifiers  
- Single transaction for complete set changes
- Gas-optimized power reconciliation
```

### Community Statistics and Analytics

```solidity
function getCommunityStats() external view returns (
    uint256 totalVerifiers,   // token roster size (zero-power holders are not roster members)
    uint256 activeVerifiers,  // == totalVerifiers
    uint256 totalPower,       // == vpt.totalSupply()
    uint256 averagePower
);
```

### Verifier Status Tracking

```solidity
function getVerifierStatus(uint256 communityId, address verifier) external view returns (
    bool isVerifier,      // Currently has power
    uint256 power,        // Current power amount
    bool isBanned         // Banned status
) {
    // Used by VerifierManager for eligibility checks
}
```

## Implementation Notes

### Gas Optimization Strategies

**Efficient Power Reconciliation**:
```solidity
// Minimize VPT token operations
if (oldPower > newPower) {
    vpt.burn(verifier, communityId, oldPower - newPower, reasonCID);
} else if (newPower > oldPower) {
    vpt.mint(verifier, communityId, newPower - oldPower, reasonCID);
}
// No operation if powers are equal
```

**Batch Processing Benefits**:
- Single transaction for multiple verifier changes
- Reduced gas costs compared to individual operations
- Atomic updates prevent inconsistent intermediate states

### Integration Requirements

**Required Dependencies**:
- **VerifierPowerToken1155**: VPT token minting and burning operations
- **Timelock Controller**: Governance delay and execution control
- **IPFS Infrastructure**: Decentralized storage for reasoning and evidence

**Optional Integrations**:
- **VerifierManager**: Juror selection and fraud reporting
- **Engagements Contract**: Verification result tracking and quality metrics
- **Analytics Dashboard**: Community verifier performance monitoring

### Deployment Considerations

**Community Initialization**:
1. Deploy VerifierElection with timelock and VPT addresses
2. Initialize community in VerifierPowerToken1155
3. Set initial verifier set through governance proposal
4. Configure VerifierManager to use VerifierElection for selection

**Governance Setup**:
- Ensure timelock has TIMELOCK_ROLE in VerifierPowerToken1155
- Configure appropriate timelock delays for verifier changes
- Establish community governance procedures for verifier management
- Set up IPFS infrastructure for transparent decision documentation

---

The VerifierElection contract establishes **democratic verifier governance** that prioritizes community control and social accountability over economic barriers, enabling sustainable and equitable work verification systems.
## QA: how to test (Base Sepolia)

1. As admin/timelock call `adjustVerifierPower(newWallet, 100, "qm...")`.
2. `getVerifierSet()`, `getEligibleVerifiers()`, `getCommunityStats()` here and `getCommunityVerifiers(0,50)` on the VPT all list `newWallet`; totals equal `vpt.totalSupply()`.
3. Submit engagements until the wallet is selected as juror (or panel size == eligible count).
4. `adjustVerifierPower(newWallet, 0)` removes it from all views; ban → unban → re-grant restores it only after the re-grant.
