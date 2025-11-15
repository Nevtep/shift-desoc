# WorkerSBT Contract

## 🎯 Purpose & Role

The **WorkerSBT** (Soulbound Token) contract manages worker reputation through non-transferable NFTs that track work contributions, achievements, and community standing. It implements a dynamic WorkerPoints system with exponential decay to incentivize consistent contribution and prevent reputation camping while providing governance eligibility and work verification bonuses.

## 🏗️ Core Architecture  

### Soulbound Token Design

**Non-Transferable NFTs**: Unlike regular NFTs, WorkerSBTs cannot be transferred between accounts, ensuring reputation remains tied to the actual contributor.

```solidity
contract WorkerSBT is ERC721, AccessControl {
    // Soulbound: override all transfer functions to revert
    function transferFrom(address, address, uint256) public pure override {
        revert SoulboundTokenNonTransferable();
    }
    
    function safeTransferFrom(address, address, uint256) public pure override {
        revert SoulboundTokenNonTransferable();
    }
}
```

### WorkerPoints System

**Exponential Decay Model**:
```solidity
struct WorkerData {
    uint256 workerPoints;           // Current points balance
    uint256 lifetimeWorkerPoints;   // Historical total earned
    uint64 lastUpdate;              // Last activity timestamp
    bool[] achievements;            // Achievement unlock status
}

// Decay parameters
uint256 public constant DECAY_PERIOD = 7 days;
uint256 public constant DEFAULT_DECAY_RATE = 950; // 95% retention per period
uint256 public workerPointsDecayRate = DEFAULT_DECAY_RATE;
```

**Points Calculation**:
- **Active Points**: Decay over time to incentivize ongoing contribution
- **Lifetime Points**: Permanent record of total work contribution
- **Achievement Points**: Milestone rewards that never decay

## ⚙️ Key Functions & Logic

### Minting and Point Award

```solidity
function mintAndAwardPoints(address worker, uint256 points, string calldata metadataURI) 
    external onlyRole(MANAGER_ROLE)
```

**Purpose**: Creates SBT for new workers or awards points to existing workers.

**Key Logic**:
1. **New Worker**: Mints SBT with initial points and metadata
2. **Existing Worker**: Applies decay, adds new points, updates metadata
3. **Achievement Check**: Automatically evaluates milestone achievements
4. **Event Emission**: Tracks all point awards for transparency

**Integration**: Called by Claims contract when work is verified and approved.

### Exponential Decay System

```solidity
function getCurrentWorkerPoints(address worker) public view returns (uint256) {
    uint256 lastUpdate = lastWorkerPointsUpdate[worker];
    if (lastUpdate == 0) return 0;
    
    uint256 timePassed = block.timestamp - lastUpdate;
    if (timePassed < DECAY_PERIOD) {
        return workerPoints[worker];
    }
    
    // Calculate decay
    uint256 decayPeriods = timePassed / DECAY_PERIOD;
    uint256 currentPoints = workerPoints[worker];
    
    // Apply exponential decay
    for (uint256 i = 0; i < decayPeriods && currentPoints > 0; i++) {
        currentPoints = (currentPoints * workerPointsDecayRate) / 1000;
    }
    
    return currentPoints;
}
```

**Decay Model**:
- **7-day periods**: Points decay every week of inactivity
- **95% retention**: By default, 5% of points are lost per period
- **Exponential**: Multiple periods compound the decay effect
- **Floor protection**: Points cannot decay below 1 if any remain

### Achievement System

```solidity
struct Achievement {
    string name;
    string description;
    uint256 pointsRequired;    // WorkerPoints threshold
    string metadataURI;        // Achievement badge metadata
    bool active;               // Can be earned
}

function checkAchievements(address worker) external {
    uint256 totalPoints = lifetimeWorkerPoints[worker];
    
    for (uint256 i = 1; i <= achievementCount; i++) {
        if (!hasAchievement[worker][i] && 
            totalPoints >= achievementDefinitions[i].pointsRequired &&
            achievementDefinitions[i].active) {
            
            hasAchievement[worker][i] = true;
            emit AchievementUnlocked(worker, i, achievementDefinitions[i].name);
        }
    }
}
```

**Default Achievements**:
1. **First Contribution** (1 point) - Welcome achievement  
2. **Active Contributor** (100 points) - Regular participant
3. **Community Builder** (500 points) - Significant contributor  
4. **Expert Contributor** (1000 points) - Community expert
5. **Master Builder** (2500 points) - Leadership level

### Governance Integration

```solidity
function hasRole(bytes32 role, address account) public view override returns (bool) {
    // Enhanced permissions based on WorkerPoints
    if (role == ENHANCED_VOTER_ROLE) {
        return getCurrentWorkerPoints(account) >= ENHANCED_VOTING_THRESHOLD;
    }
    return super.hasRole(role, account);
}
```

**Voting Weight Calculation**:
- Base voting power from governance tokens
- Multiplier based on current WorkerPoints  
- Achievement bonuses for milestone unlocks
- Decay ensures only active contributors have enhanced influence

## 🛡️ Security Features

### Soulbound Enforcement

```solidity
function approve(address, uint256) public pure override {
    revert SoulboundTokenNonTransferable();
}

function setApprovalForAll(address, bool) public pure override {
    revert SoulboundTokenNonTransferable();
}

// All transfer functions revert to ensure soulbound nature
```

### Governance Revocation

```solidity
function revokeSBT(uint256 tokenId, string calldata reason) 
    external onlyRole(GOVERNANCE_ROLE)
```

**Purpose**: Community governance can revoke SBTs for violations or disputes.

**Process**:
1. Governance proposal and vote required
2. Reason must be provided for transparency
3. SBT burned and points reset to zero
4. Lifetime points preserved for historical record
5. Can be appealed through governance process

### Access Control

```solidity
bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");      // Claims contract
bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE"); // Community governance
```

- **MANAGER_ROLE**: Claims contract can mint SBTs and award points
- **GOVERNANCE_ROLE**: Community can revoke SBTs and adjust parameters  
- **DEFAULT_ADMIN_ROLE**: Protocol admin for emergency situations

## 🔗 Integration Points

### With Claims Verification

```solidity
// Claims contract calls after work verification
IWorkerSBT(workerSBT).mintAndAwardPoints(
    worker,
    actionType.weight,    // Points from ActionType configuration
    metadataURI          // Claim metadata reference
);
```

### With Governance Contracts

```solidity
// Enhanced voting eligibility
bool canPropose = workerSBT.getCurrentWorkerPoints(proposer) >= proposalThreshold;

// Voting weight calculation  
uint256 baseWeight = governanceToken.getVotes(voter);
uint256 workerPoints = workerSBT.getCurrentWorkerPoints(voter);
uint256 enhancedWeight = baseWeight * (1 + workerPoints / POINTS_PER_MULTIPLIER);
```

### With Community Features

```solidity
// Discussion privileges based on reputation
uint256 postLimit = basePostLimit + (workerPoints / POINTS_PER_EXTRA_POST);

// Work verification priority
bool isPriorityVerifier = workerSBT.hasAchievement(verifier, EXPERT_CONTRIBUTOR_ID);
```

## 📊 Economic Model

### Point Value System

**Point Sources**:
- **Verified Work**: Primary source through Claims system
- **Manual Awards**: Community recognition for exceptional contributions
- **Achievement Bonuses**: Milestone rewards (non-decaying)

**Point Sinks**:
- **Time Decay**: 5% per week of inactivity (configurable)
- **Governance Penalties**: Points deduction for violations
- **SBT Revocation**: Complete reset (extreme cases)

### Incentive Alignment

**Active Contribution**:
- Fresh points prevent reputation camping
- Consistent work maintains high reputation
- Achievement system rewards milestone progress

**Quality Over Quantity**:
- Higher-weight ActionTypes provide more points
- Verification system ensures quality work
- Community can adjust point values through governance

## 🎛️ Configuration Examples

### Initial Deployment

```solidity
WorkerSBT workerSBT = new WorkerSBT(
    admin,           // Protocol administrator
    claimsManager,   // Claims contract address
    governance       // Community governance address
);

// Set up default achievements
workerSBT.addAchievement("First Contribution", "Welcome to the community!", 1, "ipfs://...", true);
workerSBT.addAchievement("Active Contributor", "Regular participant", 100, "ipfs://...", true);
// ... additional achievements
```

### Governance Parameter Adjustments

```solidity
// Community votes to reduce decay rate (increase retention)
workerSBT.setWorkerPointsDecayRate(975); // 97.5% retention (less aggressive)

// Add community-specific achievement
workerSBT.addAchievement(
    "Code Auditor",
    "Completed 10 security audits", 
    500,
    "ipfs://QmAuditorBadge...",
    true
);
```

### Integration Setup

```solidity
// Configure Claims to award appropriate points
actionTypeRegistry.create(
    10,    // 10 WorkerPoints reward  
    2,     // 2 of 3 jurors needed
    3,     // 3 juror panel
    24 hours,  // Verification window
    1 hours,   // Cooldown period
    5,     // 5 points for verifiers
    1000,  // 10% slashing rate
    true,  // Revocable by governance
    "ipfs://QmEvidenceSpec..."
);
```

## 🚀 Advanced Features

### Dynamic Metadata

```solidity
function updateTokenURI(uint256 tokenId, string calldata newURI) 
    external onlyRole(MANAGER_ROLE)
```

**Use Cases**:
- Update reputation display based on recent achievements
- Add skill certifications and endorsements
- Link to portfolio or work history
- Community-specific customization

### Cross-Community Reputation

```solidity
function getWorkerStats(address worker) external view returns (
    uint256 currentPoints,
    uint256 lifetimePoints, 
    uint256 achievementCount,
    uint64 lastActivity,
    bool hasActiveSBT
)
```

**Interoperability**:
- Other communities can query reputation
- Federated work verification systems
- Cross-community collaboration bonuses
- Reputation portability with community consent

### Achievement Extensions

```solidity
function addAchievement(
    string calldata name,
    string calldata description,
    uint256 pointsRequired,
    string calldata metadataURI,
    bool active
) external onlyRole(GOVERNANCE_ROLE)
```

**Community Customization**:
- Domain-specific achievements (e.g., "Smart Contract Auditor")
- Collaboration achievements (e.g., "Cross-Community Worker")  
- Leadership achievements (e.g., "Governance Participant")
- Time-based achievements (e.g., "Veteran Contributor")

## 📈 Reputation Economics

### Decay Prevents Gaming

**Reputation Camping**: Without decay, early workers could gain permanent advantage
**Solution**: Exponential decay ensures only active contributors maintain high reputation

**Mathematical Model**:
```
Points(t) = Initial × (DecayRate)^(t/DecayPeriod)
Points(14 days) = 1000 × (0.95)^2 = 902.5 points
Points(28 days) = 1000 × (0.95)^4 = 814.5 points
```

### Balanced Incentives

**Short-term**: Immediate points reward good work
**Medium-term**: Achievement unlocks provide milestone goals  
**Long-term**: Lifetime points track overall contribution history
**Governance**: Current points determine voting influence

### Network Effects

**Quality Verification**: High-reputation workers become preferred verifiers
**Community Trust**: SBT history provides credibility for leadership roles
**Cross-Pollination**: Reputation portability enables ecosystem growth
**Skill Development**: Achievement system guides worker progression

The WorkerSBT contract creates a sophisticated reputation system that balances recognition of past contributions with incentives for ongoing participation, forming the backbone of trust and quality assurance in the Shift DeSoc ecosystem.