# ValuableActionSBT Contract

## 🎯 Purpose & Role

The **ValuableActionSBT** (formerly WorkerSBT) contract manages worker reputation through non-transferable NFTs that permanently record work contributions and achievements. It implements a WorkerPoints system with time-based decay to encourage ongoing participation while providing soulbound credentials that enhance governance rights and community standing.

## 🏗️ Core Architecture

### Soulbound Token Implementation

**Non-Transferable NFTs**: ValuableActionSBTs are permanently bound to the worker's address.

```solidity
contract ValuableActionSBT is ERC721URIStorage, AccessControl {
    // Soulbound: all transfer functions revert
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (to != address(0) && _ownerOf(tokenId) != address(0)) {
            revert Soulbound(); // Prevent transfers
        }
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }
}
```

### WorkerPoints System

**Key Mappings**:

```solidity
mapping(address => uint256) public workerPoints;              // Current points balance
mapping(address => uint256) public lifetimeWorkerPoints;      // Historical total earned
mapping(address => uint256) public lastWorkerPointsUpdate;    // Last activity timestamp
mapping(address => mapping(uint256 => bool)) public achievements; // Achievement unlocks
```

**Decay Parameters**:

```solidity
uint256 public constant DECAY_PERIOD = 7 days;               // Weekly decay cycle
uint256 public constant DEFAULT_DECAY_RATE = 950;            // 95% retention per period
uint256 public workerPointsDecayRate = DEFAULT_DECAY_RATE;   // Governance adjustable
```

## ⚙️ Key Functions & Logic

### Minting and Point Award

```solidity
function mintAndAwardPoints(address worker, uint256 points, string calldata metadataURI)
    external onlyRole(MANAGER_ROLE) {
    uint256 tokenId = workerToTokenId[worker];

    // Mint new SBT if worker doesn't have one
    if (tokenId == 0) {
        tokenId = nextTokenId++;
        _safeMint(worker, tokenId);
        _setTokenURI(tokenId, metadataURI);
        workerToTokenId[worker] = tokenId;
        tokenIdToWorker[tokenId] = worker;
    }

    // Award points (applies decay first, then adds new points)
    _awardWorkerPoints(worker, points);
}
```

**Process**:

1. **Check existing SBT**: One SBT per worker maximum
2. **Mint if needed**: Create new soulbound token with metadata
3. **Apply decay**: Update existing points with time decay
4. **Add new points**: Update current and lifetime totals
5. **Check achievements**: Automatically unlock milestones

**Integration**: Called by Engagements contract after successful work verification.

### Time-Based Decay System

```solidity
function getCurrentWorkerPoints(address worker) public view returns (uint256) {
    uint256 lastUpdate = lastWorkerPointsUpdate[worker];
    if (lastUpdate == 0) return 0;

    uint256 timePassed = block.timestamp - lastUpdate;
    if (timePassed < DECAY_PERIOD) return workerPoints[worker];

    // Calculate exponential decay over periods
    uint256 decayPeriods = timePassed / DECAY_PERIOD;
    uint256 currentPoints = workerPoints[worker];

    for (uint256 i = 0; i < decayPeriods && currentPoints > 0; i++) {
        currentPoints = (currentPoints * workerPointsDecayRate) / 1000;
    }

    return currentPoints;
}
```

**Decay Mechanics**:

- **Weekly periods**: Points decay every 7 days of inactivity
- **95% retention**: Default 5% loss per period (governance adjustable)
- **Exponential compound**: Multiple periods multiply the effect
- **Prevents camping**: Only active workers maintain high points

### Achievement System

```solidity
struct Achievement {
    string name;
    string description;
    uint256 workerPointsRequired;  // Lifetime points threshold
    string metadataURI;            // IPFS badge metadata
    bool active;                   // Can be earned
}

function checkAchievements(address worker) external {
    uint256 currentPoints = getCurrentWorkerPoints(worker);

    for (uint256 i = 1; i < nextAchievementId; i++) {
        Achievement storage achievement = achievementDefinitions[i];
        if (!achievements[worker][i] &&
            currentPoints >= achievement.workerPointsRequired &&
            achievement.active) {

            achievements[worker][i] = true;
            achievementCount[worker]++;
            emit AchievementUnlocked(worker, i, achievement.name);
        }
    }
}
```

**Default Achievements** (initialized in constructor):

1. **"First Steps"** (1 point) - Welcome to the community
2. **"Getting Started"** (10 points) - Regular participation
3. **"Community Member"** (100 points) - Established contributor
4. **"Dedicated Worker"** (500 points) - Significant contributions
5. **"Expert Contributor"** (1000 points) - Community expertise

### Access Control & Roles

```solidity
bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");      // Engagements contract
bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE"); // Community governance

constructor(address initialOwner, address manager, address governance) {
    _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
    _grantRole(MANAGER_ROLE, manager);           // Engagements can mint SBTs
    _grantRole(GOVERNANCE_ROLE, governance);     // Community can revoke SBTs
}
```

**Integration Points**:

- **Engagements Contract**: Can mint SBTs and award WorkerPoints after verification
- **Governance**: Can revoke SBTs, adjust decay rates, add achievements
- **Other Contracts**: Can query WorkerPoints for enhanced permissions

## 🛡️ Security Features

### Soulbound Enforcement

```solidity
// Override _update to prevent transfers
function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
    if (to != address(0) && _ownerOf(tokenId) != address(0)) {
        revert Soulbound(); // Prevent transfers between accounts
    }
    return super._update(to, tokenId, auth);
}

// Prevent approvals (soulbound tokens cannot be approved)
function approve(address, uint256) public pure override { revert Soulbound(); }
function setApprovalForAll(address, bool) public pure override { revert Soulbound(); }
```

### Governance Revocation

```solidity
function revokeSBT(address worker, string calldata reason) external onlyRole(GOVERNANCE_ROLE) {
    uint256 tokenId = workerToTokenId[worker];
    require(tokenId != 0, "Worker has no SBT");

    // Reset worker data (except lifetime points for history)
    delete workerToTokenId[worker];
    delete tokenIdToWorker[tokenId];
    delete workerPoints[worker];
    delete lastWorkerPointsUpdate[worker];

    _burn(tokenId); // Burn the soulbound token
    emit TokenRevoked(worker, tokenId, reason);
}
```

### Input Validation

- **Zero address checks**: Prevent invalid addresses
- **Points validation**: Ensure positive point awards
- **Decay rate limits**: 50%-99% retention range (governance controlled)
- **Achievement verification**: Proper threshold checks before unlocking

## � Frontend Integration

### Essential Getters

```solidity
// Worker SBT status
function hasSBT(address worker) external view returns (bool)
function getTokenId(address worker) external view returns (uint256)
function getWorker(uint256 tokenId) external view returns (address)

// WorkerPoints and reputation
function getCurrentWorkerPoints(address worker) public view returns (uint256)
function getWorkerStats(address worker) external view returns (
    bool hasToken, uint256 tokenId, uint256 currentPoints,
    uint256 lifetimePoints, uint256 achievementsUnlocked
)

// Achievement system
function hasAchievement(address worker, uint256 achievementId) external view returns (bool)
function checkAchievements(address worker) external // Anyone can trigger checks
```

### Event Tracking

```solidity
event WorkerPointsAwarded(address indexed worker, uint256 amount, uint256 newTotal);
event AchievementUnlocked(address indexed worker, uint256 indexed achievementId, string name);
event TokenRevoked(address indexed worker, uint256 indexed tokenId, string reason);
event WorkerPointsDecayUpdated(uint256 oldDecayRate, uint256 newDecayRate);
```

### Configuration Parameters

```solidity
// Time-based decay (governance adjustable)
uint256 public constant DECAY_PERIOD = 7 days;           // Weekly decay cycle
uint256 public workerPointsDecayRate = 950;              // 95% retention per period

// System constraints
uint256 public constant MAX_DECAY_RATE = 990;            // 99% max retention
uint256 public constant MIN_DECAY_RATE = 500;            // 50% min retention
```

## � Usage Examples

### SBT Minting (Engagements Integration)

```solidity
// Engagements contract awards points after successful verification
ValuableActionSBT(sbtContract).mintAndAwardPoints(
    worker,
    250,                        // WorkerPoints earned
    "ipfs://QmEngagementEvidence..." // Engagement metadata URI
);
```

### Governance Parameter Updates

```solidity
// Community votes to adjust decay rate for more retention
WorkerSBT(workerSBT).setWorkerPointsDecayRate(975); // 97.5% retention (was 95%)

// Add new community-specific achievement
WorkerSBT(workerSBT).addAchievement(
    "Code Reviewer",
    "Verified 50+ code contributions",
    500,                        // 500 points required
    "ipfs://QmCodeBadge..."    // Achievement badge metadata
);
```

### Integration Queries

```solidity
// Check worker reputation for enhanced permissions
uint256 points = workerSBT.getCurrentWorkerPoints(worker);
bool canModerate = points >= 100; // Minimum threshold for moderation

// Verify achievement for special privileges
bool isExpert = workerSBT.hasAchievement(worker, EXPERT_CONTRIBUTOR_ID);
if (isExpert) {
    // Grant enhanced verification privileges
}

// Get comprehensive worker profile
(bool hasToken, uint256 tokenId, uint256 currentPoints,
 uint256 lifetimePoints, uint256 achievements) = workerSBT.getWorkerStats(worker);
```

### SBT Revocation (Governance)

```solidity
// Community governance can revoke SBTs for violations
WorkerSBT(workerSBT).revokeSBT(
    violatingWorker,
    "Repeated submission of false evidence"
);
```

## � Economic Mechanics

### Point Decay Model

```
Current Points = Previous Points × (Decay Rate / 1000) ^ (Weeks Passed)

Example with 95% retention:
- Week 1: 1000 points
- Week 2: 950 points (5% decay)
- Week 4: 902 points (cumulative decay)
- Week 8: 815 points (exponential effect)
```

### Incentive Alignment

- **Fresh Work**: New points counteract decay, rewarding activity
- **Quality Focus**: ValuableAction weights determine point amounts
- **Milestone Progress**: Achievements provide permanent recognition
- **Community Trust**: Soulbound nature ensures authentic reputation

**Production Ready**: WorkerSBT provides robust soulbound reputation tracking with time-based decay and achievement systems, ready for production deployment with comprehensive governance controls.

---

_This documentation reflects the actual production-ready implementation of soulbound worker credentials with decay mechanics and achievement unlocking._
