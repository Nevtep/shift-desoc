# VerifierManager Contract

## 🎯 Purpose & Role

The VerifierManager contract orchestrates **M-of-N juror selection and fraud reporting** within Shift DeSoc's Verifier Power System (VPS). It bridges community-specific verification parameters with democratic verifier power distribution to ensure fair, efficient, and accountable work verification processes.

## 🏗️ Core Architecture

### Juror Selection System

```solidity
struct JurorSelection {
    address[] selectedJurors;      // M-of-N selected verifiers
    uint256[] selectedPowers;      // Corresponding power amounts
    uint256 seed;                  // Randomization seed for selection
    uint64 selectedAt;            // Selection timestamp
    bool completed;               // Selection completion status
}

mapping(uint256 => JurorSelection) public selections; // claimId => selection details
```

### Integration Framework

```solidity
contract VerifierManager {
    IVerifierElection public immutable verifierElection;    // Verifier power management
    IParamController public immutable paramController;      // Community configuration
    address public immutable governance;                    // Governance contract
    address public claimsContract;                         // Claims processing contract
}
```

**Design Philosophy**: Flexible juror selection that adapts to community preferences while maintaining democratic verifier power distribution and transparent fraud reporting.

## ⚙️ Key Functions & Logic

### M-of-N Juror Selection

```solidity
function selectJurors(
    uint256 claimId,
    uint256 communityId,
    uint256 seed
) external onlyClaims returns (
    address[] memory selectedJurors,
    uint256[] memory selectedPowers
)
```

**Selection Algorithm**:

1. **Parameter Reading**: Fetch community-specific M, N, and weighting preferences
2. **Eligible Pool**: Get active verifiers and their power levels from VerifierElection
3. **Ban Filtering**: Exclude banned verifiers from selection pool
4. **Selection Method**: Choose between uniform or weighted selection based on community configuration
5. **Result Storage**: Record selection details for verification and fraud reporting

**Selection Methods**:

```solidity
// Uniform Selection (equal probability regardless of power)
function _selectUniform(address[] memory verifiers, uint256 panelSize, uint256 seed)
    private pure returns (address[] memory selected)

// Weighted Selection (probability proportional to verifier power)
function _selectWeighted(
    address[] memory verifiers,
    uint256[] memory powers,
    uint256 panelSize,
    uint256 seed
) private pure returns (address[] memory selected, uint256[] memory selectedPowers)
```

### Fraud Reporting System

```solidity
function reportFraud(
    uint256 claimId,
    uint256 communityId,
    address[] calldata offenders,
    string calldata evidenceCID
) external onlyClaims
```

**Fraud Reporting Process**:

1. **Authority Validation**: Ensure offenders were actually selected as jurors for this claim
2. **Evidence Recording**: Store IPFS hash of fraud evidence for community review
3. **Governance Notification**: Emit events for governance system to process disciplinary actions
4. **Selection Integrity**: Maintain jury selection history for accountability

**Anti-Fraud Protections**:
- **Selection Verification**: Can only report fraud against actually selected jurors
- **Evidence Requirement**: All fraud reports must include IPFS evidence documentation
- **Governance Review**: Community governance reviews all fraud reports before action

### Community Parameter Integration

```solidity
// Dynamic parameter reading from ParamController
function _getCommunityParams(uint256 communityId) private view returns (
    bool useWeighting,      // USE_VPT_WEIGHTING: weighted vs uniform selection
    uint256 maxWeight,      // MAX_WEIGHT_PER_VERIFIER: power cap per verifier
    uint256 panelSize,      // VERIFIER_PANEL_SIZE: N (total jurors)
    uint256 minRequired     // VERIFIER_MIN: M (minimum approvals needed)
) {
    useWeighting = paramController.getBool(communityId, USE_VPT_WEIGHTING);
    maxWeight = paramController.getUint256(communityId, MAX_WEIGHT_PER_VERIFIER);
    panelSize = paramController.getUint256(communityId, VERIFIER_PANEL_SIZE);
    minRequired = paramController.getUint256(communityId, VERIFIER_MIN);
}
```

## 🛡️ Security Features

### Access Control System

| Role | Functions | Purpose |
|------|-----------|---------|
| **Claims Contract** | `selectJurors()`, `reportFraud()` | Verification workflow integration |
| **Governance** | `setClaimsContract()` | System administration |
| **Public** | View functions | Transparency and analytics |

### Selection Integrity Mechanisms

```solidity
// Prevent double selection for same claim
if (selections[claimId].selectedAt != 0) {
    revert Errors.AlreadySelected(claimId);
}

// Ensure sufficient verifiers available
if (eligibleCount < panelSize) {
    revert Errors.InsufficientVerifiers(eligibleCount, panelSize);
}

// Validate fraud reporting authority
if (!_isSelectedJuror(claimId, offender)) {
    revert Errors.NotSelectedJuror(offender, claimId);
}
```

### Randomization Security

```solidity
// Deterministic but unpredictable selection
function _generateSelection(uint256 seed, uint256 poolSize, uint256 selectCount) private pure {
    // Uses seed + iteration + verifier address for consistent but unpredictable results
    // Prevents manipulation while allowing verification of selection fairness
}
```

## 🔗 Integration Points

### VerifierElection Integration

```solidity
interface IVerifierElection {
    function getEligibleVerifiers(uint256 communityId) external view returns (
        address[] memory eligibleVerifiers,
        uint256[] memory eligiblePowers
    );
    
    function getVerifierStatus(uint256 communityId, address verifier) external view returns (
        bool isVerifier,
        uint256 power,
        bool isBanned
    );
}

// Real-time verifier eligibility checking
function _getEligiblePool(uint256 communityId) private view returns (
    address[] memory eligible,
    uint256[] memory powers
) {
    (address[] memory all, uint256[] memory allPowers) = verifierElection.getEligibleVerifiers(communityId);
    // Filter out banned verifiers and apply power caps
}
```

### Claims Contract Workflow

```solidity
// Claims contract calls VerifierManager for jury selection
function _selectVerificationJury(uint256 claimId) external {
    uint256 communityId = _getClaimCommunity(claimId);
    uint256 seed = _generateClaimSeed(claimId);
    
    (address[] memory jurors, uint256[] memory powers) = 
        verifierManager.selectJurors(claimId, communityId, seed);
    
    // Store selected jurors for verification process
}

// Fraud detection and reporting integration
function _reportVerifierMisconduct(uint256 claimId, address[] calldata offenders) external {
    verifierManager.reportFraud(claimId, community, offenders, evidenceCID);
}
```

### ParamController Configuration

```solidity
// Community governance can configure verification parameters
bytes32 public constant USE_VPT_WEIGHTING = keccak256("USE_VPT_WEIGHTING");
bytes32 public constant MAX_WEIGHT_PER_VERIFIER = keccak256("MAX_WEIGHT_PER_VERIFIER");
bytes32 public constant VERIFIER_PANEL_SIZE = keccak256("VERIFIER_PANEL_SIZE");
bytes32 public constant VERIFIER_MIN = keccak256("VERIFIER_MIN");

// Dynamic parameter updates affect subsequent selections
function _adaptToNewParameters(uint256 communityId) {
    // Selection algorithm automatically uses latest parameters
    // No migration needed - applies to new selections immediately
}
```

## 📊 Verification Economics

### Selection Method Comparison

**Uniform Selection Benefits**:
- **Democratic Equality**: Every verifier has equal selection probability
- **Anti-Plutocracy**: Prevents power concentration from dominating verification
- **Simple Fairness**: Easy to understand and verify selection process

**Weighted Selection Benefits**:
- **Merit Recognition**: Higher power verifiers selected more frequently
- **Quality Optimization**: Communities can weight selection toward proven verifiers
- **Flexible Governance**: Balance between democracy and meritocracy

### Community Configuration Patterns

```solidity
// Democratic Community (equal participation)
paramController.setBool(communityId, USE_VPT_WEIGHTING, false);
paramController.setUint256(communityId, VERIFIER_PANEL_SIZE, 5);
paramController.setUint256(communityId, VERIFIER_MIN, 3);

// Merit-Based Community (weighted by performance)  
paramController.setBool(communityId, USE_VPT_WEIGHTING, true);
paramController.setUint256(communityId, MAX_WEIGHT_PER_VERIFIER, 200);
paramController.setUint256(communityId, VERIFIER_PANEL_SIZE, 7);
paramController.setUint256(communityId, VERIFIER_MIN, 5);

// High-Security Community (larger panels, higher consensus)
paramController.setUint256(communityId, VERIFIER_PANEL_SIZE, 11);
paramController.setUint256(communityId, VERIFIER_MIN, 8);
```

## 🎛️ Use Case Examples

### Standard Claims Verification

```solidity
// 1. Claims contract initiates verification
uint256 claimId = claims.submitClaim(communityId, valuableActionId, evidenceCID);

// 2. VerifierManager selects 5-of-7 jury
(address[] memory jurors, uint256[] memory powers) = 
    verifierManager.selectJurors(claimId, communityId, blockSeed);

// 3. Selected jurors review evidence and vote
for (uint i = 0; i < jurors.length; i++) {
    claims.verifyClaimVPS(claimId, jurors[i], approved);
}

// 4. Claims reaches 5-approval threshold and approves
claims.finalizeVerification(claimId, true);
```

### Fraud Detection and Response

```solidity
// 1. Claims contract detects inconsistent verification pattern
address[] memory suspiciousJurors = [juror1, juror3, juror5];

// 2. Report fraud with evidence
verifierManager.reportFraud(claimId, communityId, suspiciousJurors, "QmFraudEvidence123...");

// 3. Community governance reviews fraud report
// 4. VerifierElection implements disciplinary action (ban/power reduction)
verifierElection.banVerifiers(communityId, confirmedOffenders, "QmDisciplinaryAction456...");
```

### Community Parameter Optimization

```solidity
// Community experiments with different verification approaches

// Phase 1: Democratic approach (3-of-5, uniform)
paramController.setBool(communityId, USE_VPT_WEIGHTING, false);
paramController.setUint256(communityId, VERIFIER_PANEL_SIZE, 5);

// Phase 2: Merit-based approach (5-of-7, weighted)
paramController.setBool(communityId, USE_VPT_WEIGHTING, true);
paramController.setUint256(communityId, VERIFIER_PANEL_SIZE, 7);

// Phase 3: High-security approach (7-of-9, weighted with caps)
paramController.setUint256(communityId, MAX_WEIGHT_PER_VERIFIER, 150);
paramController.setUint256(communityId, VERIFIER_PANEL_SIZE, 9);
```

## 🚀 Advanced Features

### Selection Analytics and Monitoring

```solidity
function getSelectionStats(uint256 communityId) external view returns (
    uint256 totalSelections,           // Total jury selections for community
    uint256 uniqueVerifiersSelected,   // Number of different verifiers selected
    uint256 averagePanelSize,         // Mean jury size
    uint256 fraudReportsCount         // Number of fraud reports filed
) {
    // Community verification health metrics
}
```

### Verifier Performance Tracking

```solidity
function getVerifierSelectionHistory(address verifier, uint256 communityId) external view returns (
    uint256[] memory claimIds,        // Claims where verifier was selected
    uint256 totalSelections,         // Total times selected as juror
    uint256 recentSelections,        // Selections in last 30 days
    bool hasActiveFraudReports       // Outstanding fraud reports
) {
    // Individual verifier activity analysis
}
```

### Cross-Community Selection Patterns

```solidity
function getVerifierCommunityActivity(address verifier) external view returns (
    uint256[] memory activeCommunities,  // Communities where verifier participates
    uint256[] memory selectionCounts,    // Selections per community
    uint256 totalCrossCommunitySel       // Total selections across all communities
) {
    // Multi-community verifier engagement analysis
}
```

## Implementation Notes

### Gas Optimization Strategies

**Efficient Selection Algorithm**:
```solidity
// Minimize storage operations during selection
address[] memory selected = new address[](panelSize);
uint256[] memory powers = new uint256[](panelSize);

// Single selection struct update
selections[claimId] = JurorSelection({
    selectedJurors: selected,
    selectedPowers: powers,
    seed: seed,
    selectedAt: uint64(block.timestamp),
    completed: true
});
```

**Parameter Caching**:
```solidity
// Cache frequently accessed parameters
struct CommunityConfig {
    bool useWeighting;
    uint256 maxWeight;
    uint256 panelSize;
    uint256 minRequired;
}

// Load once, use multiple times in selection logic
```

### Integration Requirements

**Required Dependencies**:
- **VerifierElection**: Verifier eligibility and power data
- **ParamController**: Community-specific configuration parameters
- **Claims Contract**: Verification workflow coordination

**Optional Integrations**:
- **Analytics Dashboard**: Selection pattern monitoring and community insights
- **Notification Systems**: Real-time updates for selected jurors
- **Reputation Systems**: Cross-community verifier performance tracking

### Deployment Considerations

**Initialization Sequence**:
1. Deploy VerifierManager with VerifierElection and ParamController addresses
2. Set initial Claims contract address (can be updated later)
3. Configure community verification parameters via ParamController
4. Initialize verifier sets via VerifierElection
5. Begin claims processing with integrated juror selection

**Community Configuration**:
- Establish verification parameter standards for consistent experience
- Configure fraud reporting procedures and community response protocols
- Set up monitoring and analytics for selection fairness and verifier performance
- Plan parameter optimization cycles based on community verification experience

---

The VerifierManager contract provides **democratic and configurable juror selection** that balances fairness, efficiency, and community autonomy in work verification, enabling communities to optimize their verification processes while maintaining transparent and accountable quality control systems.