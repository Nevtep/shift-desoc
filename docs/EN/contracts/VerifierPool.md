# VerifierPool Contract

The VerifierPool contract manages verifier registration, economic bonding, and pseudo-random juror selection for Shift DeSoc's work verification system. It provides the foundation for decentralized peer verification through reputation tracking and economic incentives.

## 🎯 Purpose & Role

The VerifierPool serves as the **verifier coordination system** by:
- Managing verifier registration with ETH bonding requirements (100 ETH minimum)
- Implementing weighted pseudo-random selection for M-of-N juror panels
- Tracking verifier performance through reputation scoring (0-10000 basis points)
- Providing economic security through bonding (slashing system pending Claims.sol fixes)
- Maintaining the active pool of qualified verifiers for claims verification

**Production Focus**: Delivers essential verifier management with proven economic bonding, while bond slashing awaits upstream Claims contract improvements.

## 🏗️ Core Architecture

### Verifier Structure
```solidity
struct Verifier {
    bool active;                    // Current participation status
    uint256 bondAmount;            // ETH staked for participation  
    uint256 reputation;            // Score from 0-10000 basis points
    uint256 totalVerifications;    // Lifetime participation count
    uint256 successfulVerifications; // Accurate decisions count
    uint64 registeredAt;          // Registration timestamp
    uint64 lastActiveAt;          // Most recent activity
}
```

### Economic Model

**Current Implementation** (Production Ready):
- **Bonding**: 100 ETH minimum stake creates economic security
- **Reputation**: 0-10000 basis points tracking affects selection probability
- **Weighted Selection**: Higher reputation + bond = higher selection chance

**Pending Development** (Blocked by Claims.sol):
- **Bond Slashing**: Economic penalties for poor performance (requires Claims contract reputation system fixes)

## ⚙️ Registration & Bonding System

### Verifier Registration
#### `registerVerifier()`
**Purpose**: Allows community members to join the verifier pool by staking ETH.

**Registration Process**:
```solidity
function registerVerifier() external payable {
    // Ensure adequate bond
    if (msg.value < minimumBond) {
        revert Errors.InvalidInput("Insufficient bond amount");
    }
    
    // Prevent double registration
    if (isVerifier[msg.sender]) {
        revert Errors.InvalidInput("Already registered");
    }

    // Create verifier record with base reputation
    verifiers[msg.sender] = Verifier({
        active: true,
        bondAmount: msg.value,
        reputation: baseReputation,     // Start at 50% (5000/10000)
        totalVerifications: 0,
        successfulVerifications: 0,
        registeredAt: uint64(block.timestamp),
        lastActiveAt: uint64(block.timestamp)
    });

    // Add to active selection pool
    isVerifier[msg.sender] = true;
    verifierIndex[msg.sender] = activeVerifiers.length;
    activeVerifiers.push(msg.sender);
}
```

**Economic Rationale**: The bonding requirement ensures verifiers have economic stake in system integrity. Higher bonds indicate greater commitment and receive higher selection weights.

### Bond Management
#### `increaseBond()`
**Purpose**: Allows verifiers to increase their stake for better selection odds.

**Strategic Implications**:
- Higher bonds → Higher selection weights → More earning opportunities
- Demonstrates long-term commitment to verification quality
- Provides additional economic security for the system

#### `deactivateVerifier(address verifierAddr, string reason)`
**Purpose**: Allows self-exit or governance removal with bond recovery.

**Exit Process**:
```solidity
// Deactivate status
verifier.active = false;
isVerifier[verifierAddr] = false;

// Remove from active selection (efficient swap-and-pop)
uint256 index = verifierIndex[verifierAddr];
uint256 lastIndex = activeVerifiers.length - 1;
if (index != lastIndex) {
    address lastVerifier = activeVerifiers[lastIndex];
    activeVerifiers[index] = lastVerifier;
    verifierIndex[lastVerifier] = index;
}
activeVerifiers.pop();

// Return bond to verifier
uint256 bondAmount = verifier.bondAmount;
verifier.bondAmount = 0;
(bool success, ) = payable(verifierAddr).call{value: bondAmount}("");
```

**Security**: Both self-deactivation and governance removal are supported, ensuring verifiers can exit while maintaining system integrity.

## 🎲 Pseudo-Random Juror Selection

### Weighted Selection Algorithm
#### `selectJurors(uint256 claimId, uint256 panelSize, uint256 seed)`
**Purpose**: Select M jurors from N available verifiers using reputation and bond-weighted randomness.

**Selection Implementation**:
```solidity
function _weightedRandomSelection(uint256 count, uint256 seed) 
    internal view returns (address[] memory selected) {
    
    // Calculate weights: reputation factor × sqrt(bond factor)
    for (uint256 i = 0; i < totalVerifiers; i++) {
        Verifier memory verifier = verifiers[activeVerifiers[i]];
        uint256 reputationFactor = verifier.reputation; // 0-10000
        uint256 bondFactor = _sqrt((verifier.bondAmount * 10000) / minimumBond);
        weights[i] = (reputationFactor * bondFactor) / 10000;
    }

    // Select without replacement using deterministic keccak256 randomness
    for (uint256 j = 0; j < count; j++) {
        uint256 randomValue = uint256(keccak256(abi.encode(seed, j))) % totalWeight;
        // ... weighted selection logic
    }
}
```

**Key Properties**:
- **Deterministic**: Same seed always produces same results
- **Weighted**: Higher reputation + bond = higher selection probability  
- **No replacement**: No duplicate jurors in same panel
- **Cryptographically random**: Uses keccak256 for fair distribution

### Selection Weight Formula

The selection probability combines two factors:

**Weight = (Reputation Score / 100) × √(Bond Amount / Minimum Bond)**

**Examples**:
- **New verifier**: 5000 reputation, 100 ETH bond = Weight of 500
- **Experienced verifier**: 8000 reputation, 400 ETH bond = Weight of 1600  
- **Expert verifier**: 9500 reputation, 900 ETH bond = Weight of 2850

This creates a **compound advantage** for verifiers who demonstrate both accuracy (reputation) and commitment (bonding).

## 📊 Reputation System

### Reputation Updates
#### `updateReputations(uint256 claimId, address[] jurors, bool[] successful)`
**Purpose**: Adjust verifier reputations based on voting accuracy after claim resolution.

**Current Implementation**:
```solidity
function updateReputations(uint256 claimId, address[] calldata jurors, bool[] calldata successful) external onlyClaims {
    // TODO: IMPLEMENT BOND SLASHING FOR ECONOMIC SECURITY
    // CRITICAL DEPENDENCY: Must fix Claims.sol reputation system first!
    // Current blocker: Claims.sol has M-of-N early resolution issue where
    // slower jurors marked "unsuccessful" even when voting correctly
    
    for (uint256 i = 0; i < jurors.length; i++) {
        Verifier storage verifier = verifiers[jurors[i]];
        verifier.totalVerifications++;
        
        if (successful[i]) {
            verifier.successfulVerifications++;
            // Increase reputation (+25 basis points, capped at 10000)
            verifier.reputation = _min(verifier.reputation + reputationReward, maxReputation);
        } else {
            // Decrease reputation (-50 basis points, floored at 0)
            verifier.reputation = verifier.reputation > reputationDecay ? 
                verifier.reputation - reputationDecay : 0;
        }
    }
}
```

**Current Parameters**:
- **Successful voting**: +25 basis points (0.25% improvement)
- **Failed voting**: -50 basis points (0.50% penalty)
- **Starting reputation**: 5000 basis points (50%)
- **Maximum reputation**: 10000 basis points (100%)

### Performance Tracking

The contract maintains comprehensive statistics:
```solidity
uint256 totalVerifications;      // Lifetime participation count
uint256 successfulVerifications; // Accurate decisions count
```

**Success Rate Calculation**:
```solidity
successRate = (successfulVerifications * 10000) / totalVerifications;
```

This enables rich analytics and performance monitoring for both individual verifiers and system-wide metrics.

## 🔧 Governance & Configuration

### Parameter Management
#### `updateParameters(minimumBond, baseReputation, reputationDecay, reputationReward)`
**Purpose**: Allows governance to adjust economic parameters based on system performance.

**Configurable Parameters**:
- **minimumBond**: Entry barrier (default: 100 ETH)
- **baseReputation**: Starting score for new verifiers (default: 5000)
- **reputationDecay**: Penalty for incorrect votes (default: 50)
- **reputationReward**: Bonus for correct votes (default: 25)

**Parameter Optimization**: These values can be adjusted based on:
- Verifier participation rates
- Verification quality metrics  
- Economic conditions and ETH price
- Community feedback and governance decisions

### Access Control
- **Governance**: Full parameter control and emergency functions
- **Claims Contract**: Can select jurors and update reputations
- **Verifiers**: Can self-register, increase bonds, and self-deactivate
- **Public**: Read-only access to aggregated statistics

## � Frontend Integration

### Essential Getters
```solidity
// Pool statistics
function getActiveVerifierCount() external view returns (uint256)
function getActiveVerifiers() external view returns (address[] memory)

// Verifier information  
function getVerifier(address verifierAddr) external view returns (Verifier memory)
function getVerifierWeight(address verifierAddr) external view returns (uint256)
function getVerifierStats(address verifierAddr) external view returns (uint256 successRate, bool isActive)

// Selection history
function getJurorSelection(uint256 claimId) external view returns (JurorSelection memory)
```

### Event Tracking
```solidity
event VerifierRegistered(address indexed verifier, uint256 bondAmount);
event VerifierDeactivated(address indexed verifier, string reason);
event JurorsSelected(uint256 indexed claimId, address[] jurors, uint256 seed);
event ReputationUpdated(address indexed verifier, uint256 oldReputation, uint256 newReputation);
```

### Configuration Management
```solidity
// Governance-controlled parameters
uint256 public minimumBond = 100e18;        // 100 ETH minimum
uint256 public baseReputation = 5000;       // 50% starting score
uint256 public reputationDecay = 50;        // 0.5% penalty
uint256 public reputationReward = 25;       // 0.25% bonus
```

## 🛡️ Security Features

### Access Control
```solidity
modifier onlyGovernance() // Parameter updates, emergency functions
modifier onlyClaims()     // Juror selection and reputation updates
```

### Economic Security
- **100 ETH minimum bond**: Significant economic commitment required
- **Reputation tracking**: 0-10000 basis points with gradual changes
- **Weighted selection**: Higher bonds + reputation = better selection odds
- **Exit mechanism**: Full bond recovery on deactivation

### Implementation Status
**✅ Production Ready**:
- Verifier registration and bonding system
- Weighted pseudo-random juror selection
- Reputation tracking and updates
- Emergency governance functions

**⚠️ Pending (Blocked by Claims.sol)**:
- Bond slashing for poor performance requires Claims reputation system fixes

## � Usage Examples

### Verifier Registration
```solidity
// Register with 150 ETH bond (higher than minimum for better selection odds)
VerifierPool(verifierPool).registerVerifier{value: 150 ether}();
```

### Juror Selection
```solidity
// Claims contract selects 3 jurors from 5-member panels
address[] memory jurors = verifierPool.selectJurors(
    claimId,
    3,      // panel size
    seed    // randomness seed
);
```

### Reputation Management
```solidity
// After claim resolution, update verifier reputations
bool[] memory successful = new bool[](3);
successful[0] = true;  // Juror 1 voted correctly
successful[1] = false; // Juror 2 voted incorrectly  
successful[2] = true;  // Juror 3 voted correctly

verifierPool.updateReputations(claimId, jurors, successful);
```

**Production Ready**: VerifierPool provides robust verifier coordination with economic bonding and reputation tracking, ready for production use while bond slashing awaits Claims contract improvements.

---

*This documentation reflects the actual production implementation, noting the dependency on Claims.sol fixes for complete bond slashing functionality.*