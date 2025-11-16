# ParamController Contract

## 🎯 Purpose & Role

The ParamController contract serves as the **dynamic configuration management system** for Shift DeSoc communities, enabling governance-controlled adjustment of timing parameters, eligibility rules, and economic splits without requiring contract upgrades. It acts as a centralized parameter store that other contracts query for real-time configuration values.

## 🏗️ Core Architecture

### Parameter Categories Structure

```solidity
struct GovernanceParams {
    uint256 debateWindow;        // Time for proposal discussion (seconds)
    uint256 voteWindow;          // Time for voting period (seconds)  
    uint256 executionDelay;      // Timelock delay before execution (seconds)
    uint256 proposalThreshold;   // Tokens needed to create proposals
    uint256 quorumRequired;      // Minimum participation for valid votes
}

struct EligibilityParams {
    uint256 minSeniority;        // Minimum account age for participation
    uint256 minSBTs;             // Minimum WorkerSBT count for voting
    uint256 minTokenBalance;     // Minimum MembershipToken balance
    uint256 cooldownPeriod;      // Time between proposal submissions
}

struct EconomicParams {
    uint256[3] revenueSplit;     // [workers%, treasury%, investors%] 
    uint256 feeOnWithdraw;       // Exit fee percentage (basis points)
    uint256 inflationRate;       // Token inflation rate (basis points)
    uint256 burnRate;            // Token burn rate per period (basis points)
}
```

### Configuration Management

```solidity
mapping(uint256 => GovernanceParams) public communityGovernance;
mapping(uint256 => EligibilityParams) public communityEligibility;  
mapping(uint256 => EconomicParams) public communityEconomics;

struct ParameterUpdate {
    uint256 communityId;
    bytes32 parameterKey;        // Keccak256 hash of parameter name
    uint256 newValue;
    uint256 effectiveTime;       // When change becomes active
    address proposer;
    bool executed;
}

mapping(uint256 => ParameterUpdate) public pendingUpdates;
```

**Design Philosophy**: Separating configuration from core logic enables communities to evolve their governance models over time while maintaining contract security and upgrade safety.

## ⚙️ Key Functions & Logic

### Parameter Updates via Governance

```solidity
function proposeParameterUpdate(
    uint256 communityId,
    string calldata parameterName,
    uint256 newValue,
    uint256 delaySeconds
) external returns (uint256 updateId) {
    // Validate proposer has sufficient governance power
    require(_hasProposalAuthority(msg.sender, communityId), "Insufficient authority");
    
    bytes32 paramKey = keccak256(abi.encodePacked(parameterName));
    updateId = ++lastUpdateId;
    
    pendingUpdates[updateId] = ParameterUpdate({
        communityId: communityId,
        parameterKey: paramKey,
        newValue: newValue,
        effectiveTime: block.timestamp + delaySeconds,
        proposer: msg.sender,
        executed: false
    });
    
    emit ParameterUpdateProposed(updateId, communityId, parameterName, newValue, delaySeconds);
}
```

### Parameter Execution with Timelock

```solidity
function executeParameterUpdate(uint256 updateId) external {
    ParameterUpdate storage update = pendingUpdates[updateId];
    
    require(!update.executed, "Already executed");
    require(block.timestamp >= update.effectiveTime, "Still in timelock");
    require(update.effectiveTime != 0, "Invalid update");
    
    // Apply the parameter change
    _applyParameterChange(
        update.communityId,
        update.parameterKey, 
        update.newValue
    );
    
    update.executed = true;
    
    emit ParameterUpdateExecuted(updateId, update.communityId, update.newValue);
}
```

### Real-time Parameter Queries

```solidity
function getGovernanceParams(uint256 communityId) 
    external view returns (GovernanceParams memory) {
    return communityGovernance[communityId];
}

function getDebateWindow(uint256 communityId) external view returns (uint256) {
    return communityGovernance[communityId].debateWindow;
}

function getVoteWindow(uint256 communityId) external view returns (uint256) {
    return communityGovernance[communityId].voteWindow;
}

function checkEligibility(address user, uint256 communityId) 
    external view returns (bool eligible, string memory reason) {
    
    EligibilityParams memory params = communityEligibility[communityId];
    
    // Check seniority
    uint256 userAge = block.timestamp - _getUserRegistrationTime(user);
    if (userAge < params.minSeniority) {
        return (false, "Insufficient account seniority");
    }
    
    // Check SBT count
    uint256 sbtCount = IWorkerSBT(workerSBT).balanceOf(user);
    if (sbtCount < params.minSBTs) {
        return (false, "Insufficient WorkerSBT count");
    }
    
    // Check token balance
    uint256 tokenBalance = IMembershipToken(membershipToken).balanceOf(user);
    if (tokenBalance < params.minTokenBalance) {
        return (false, "Insufficient MembershipToken balance");
    }
    
    return (true, "Eligible");
}
```

## 🛡️ Security Features

### Access Control & Validation

```solidity
modifier onlyGovernance(uint256 communityId) {
    require(_isGovernance(msg.sender, communityId), "Only governance");
    _;
}

modifier validParameterRange(string calldata paramName, uint256 value) {
    require(_validateParameterRange(paramName, value), "Invalid parameter range");
    _;
}

function _validateParameterRange(string calldata paramName, uint256 value) 
    private pure returns (bool) {
    
    bytes32 paramHash = keccak256(abi.encodePacked(paramName));
    
    if (paramHash == keccak256("debateWindow")) {
        return value >= 3600 && value <= 604800; // 1 hour to 1 week
    } else if (paramHash == keccak256("voteWindow")) {
        return value >= 3600 && value <= 604800; // 1 hour to 1 week  
    } else if (paramHash == keccak256("proposalThreshold")) {
        return value <= 1000000e18; // Max 1M tokens
    } else if (paramHash == keccak256("revenueSplit")) {
        return value <= 10000; // Max 100% in basis points
    }
    
    return false;
}
```

### Emergency Parameter Controls

```solidity
function emergencyParameterReset(uint256 communityId) 
    external onlyRole(EMERGENCY_ROLE) {
    
    // Reset to safe default values
    communityGovernance[communityId] = GovernanceParams({
        debateWindow: 86400,        // 24 hours
        voteWindow: 259200,         // 72 hours
        executionDelay: 172800,     // 48 hours  
        proposalThreshold: 100e18,  // 100 tokens
        quorumRequired: 1000        // 10% (basis points)
    });
    
    emit EmergencyParameterReset(communityId);
}
```

## 🔗 Integration Points

### Governor Contract Integration

```solidity
// ShiftGovernor queries ParamController for current settings
interface IParamController {
    function getDebateWindow(uint256 communityId) external view returns (uint256);
    function getVoteWindow(uint256 communityId) external view returns (uint256);  
    function getExecutionDelay(uint256 communityId) external view returns (uint256);
    function getProposalThreshold(uint256 communityId) external view returns (uint256);
}

// In ShiftGovernor.sol
function _getVotingPeriod() internal view override returns (uint256) {
    return paramController.getVoteWindow(communityId);
}
```

### Claims Contract Integration

```solidity
// Claims contract checks eligibility before processing
function submitClaim(uint256 actionId, string calldata evidenceCID) external {
    (bool eligible, string memory reason) = paramController.checkEligibility(msg.sender, communityId);
    require(eligible, reason);
    
    // Proceed with claim processing...
}
```

### RevenueRouter Integration

```solidity
// Revenue distribution uses dynamic split parameters
function distributeRevenue(uint256 totalRevenue) external {
    uint256[3] memory splits = paramController.getRevenueSplit(communityId);
    
    uint256 workersShare = (totalRevenue * splits[0]) / 10000;
    uint256 treasuryShare = (totalRevenue * splits[1]) / 10000;
    uint256 investorsShare = (totalRevenue * splits[2]) / 10000;
    
    // Distribute according to current parameters...
}
```

## 📊 Use Case Flows

### 1. Community Parameter Evolution Flow

```
Initial Launch:
├── Conservative parameters (longer debate/vote periods)
├── Higher participation thresholds
└── Higher investor revenue share

Community Maturity:
├── Reduced debate periods (more efficient)  
├── Lower participation barriers (more inclusive)
└── Increased treasury/worker revenue share

Governance Proposal → ParamController Update → Timelock → Execution
```

### 2. Eligibility Parameter Adjustment Flow

```
Community Growth:
├── Initial: minSBTs = 0 (bootstrap phase)
├── Growth: minSBTs = 1 (proven contributors only)
└── Mature: minSBTs = 3 (experienced governance)

Seasonal Adjustments:
├── High Activity: Lower cooldowns, faster proposals
├── Low Activity: Higher thresholds, longer deliberation
└── Crisis: Emergency parameter reset available
```

### 3. Economic Parameter Optimization Flow

```
Revenue Distribution Evolution:
├── Startup: [30% workers, 20% treasury, 50% investors]  
├── Growth: [40% workers, 30% treasury, 30% investors]
└── Mature: [60% workers, 40% treasury, 0% investors]

Fee Structure Adaptation:
├── Bear Market: Lower exit fees, encourage retention
├── Bull Market: Higher exit fees, capitalize on speculation  
└── Stable: Balanced fees, sustainable operations
```

## 🎛️ Configuration Examples

### Conservative Governance Setup

```solidity
communityGovernance[communityId] = GovernanceParams({
    debateWindow: 172800,        // 48 hours debate
    voteWindow: 604800,          // 7 days voting
    executionDelay: 259200,      // 72 hours timelock
    proposalThreshold: 1000e18,  // 1000 tokens to propose
    quorumRequired: 2500         // 25% participation required
});
```

### Progressive Governance Setup

```solidity
communityGovernance[communityId] = GovernanceParams({
    debateWindow: 43200,         // 12 hours debate  
    voteWindow: 172800,          // 48 hours voting
    executionDelay: 86400,       // 24 hours timelock
    proposalThreshold: 100e18,   // 100 tokens to propose
    quorumRequired: 1000         // 10% participation required  
});
```

### Inclusive Eligibility Setup

```solidity
communityEligibility[communityId] = EligibilityParams({
    minSeniority: 604800,        // 1 week minimum age
    minSBTs: 1,                  // At least 1 contribution
    minTokenBalance: 10e18,      // 10 tokens minimum
    cooldownPeriod: 86400        // 24 hours between proposals
});
```

## 🚀 Advanced Features

### Parameter Scheduling

```solidity
struct ParameterSchedule {
    uint256 startTime;
    uint256 endTime;  
    uint256 startValue;
    uint256 endValue;
    bool active;
}

// Gradual parameter transitions over time
mapping(bytes32 => ParameterSchedule) public parameterSchedules;

function scheduleParameterTransition(
    string calldata paramName,
    uint256 targetValue,
    uint256 durationSeconds
) external onlyGovernance {
    // Implement gradual parameter changes
}
```

### Parameter Templates

```solidity
enum CommunityType {
    STARTUP,      // Flexible, fast governance
    ESTABLISHED,  // Balanced governance  
    CONSERVATIVE, // Slow, deliberate governance
    EXPERIMENTAL  // Cutting-edge parameters
}

function applyParameterTemplate(uint256 communityId, CommunityType template) 
    external onlyGovernance {
    // Apply pre-configured parameter sets
}
```

### Cross-Community Parameter Learning

```solidity
function getSuccessfulParametersByMetric(
    string calldata metric,
    uint256 minCommunitySize
) external view returns (ParameterSet[] memory) {
    // Return parameter configurations from successful communities
    // Enables evidence-based governance optimization
}
```

---

The ParamController contract enables **living governance systems** that can adapt and optimize over time based on community needs, experience, and changing conditions, while maintaining security through validation, timelock protections, and emergency controls.