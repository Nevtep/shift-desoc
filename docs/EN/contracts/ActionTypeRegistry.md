# ActionTypeRegistry Contract

The ActionTypeRegistry serves as the central configuration hub for all types of work that can be verified within the Shift DeSoc ecosystem. It defines the parameters, requirements, and verification logic for different categories of community contributions.

## 🎯 Purpose & Role

The ActionTypeRegistry acts as a **configurable blueprint system** that allows governance to define:
- What types of work can be submitted for verification
- How many verifiers are required for each type
- What evidence is needed to prove completion
- Economic parameters like rewards and penalties

Think of it as a "template system" where each template defines the rules for verifying a specific type of community work.

## 🏗️ Core Architecture

### ActionType Structure
```solidity
struct ActionType {
    uint32 weight;              // WorkerPoints reward (1-10000)
    uint32 jurorsMin;           // Minimum approvals needed (M in M-of-N)
    uint32 panelSize;           // Total jurors selected (N in M-of-N)
    uint32 verifyWindow;        // Time limit for verification (hours)
    uint32 cooldown;            // Cooldown between submissions (hours)
    uint32 rewardVerify;        // Verifier reward points
    uint32 slashVerifierBps;    // Verifier penalty (basis points)
    bool revocable;             // Can governance revoke approved claims?
    string evidenceSpecCID;     // IPFS hash of evidence requirements
}
```

### Design Philosophy

The ActionTypeRegistry follows several key design principles:

1. **Flexibility**: Each action type can have completely different verification requirements
2. **Governance Control**: Only governance can create/modify action types, ensuring community oversight
3. **Moderator System**: Trusted moderators can temporarily disable problematic action types
4. **Evidence Standards**: IPFS-based evidence specifications ensure verifiable work requirements

## ⚙️ Key Functions

### Action Type Management

#### `createActionType(ActionType calldata actionType)`
**Purpose**: Creates a new work category with specific verification parameters.

**Process**:
1. Validates all parameters are within acceptable ranges
2. Assigns unique ID to the action type
3. Sets creation timestamp and activates the type
4. Emits event for indexing and UI updates

**Governance Only**: Prevents arbitrary creation of action types

#### `updateActionType(uint256 typeId, ActionType calldata newActionType)`
**Purpose**: Modifies existing action type parameters.

**Critical Safety**: 
- Only allows updates to inactive action types by default
- Governance can force updates to active types if needed
- Preserves system integrity by preventing mid-flight changes

### State Management

#### `setActionTypeActive(uint256 typeId, bool active)`
**Purpose**: Enable/disable action types without deletion.

**Use Cases**:
- Temporarily disable problematic work categories
- Seasonal work types (enable/disable based on community needs)
- Emergency response to discovered issues

#### Moderator Functions
Trusted community members can quickly respond to issues:
- `deactivateActionType()` - Emergency shutdown capability
- `reactivateActionType()` - Restore after issue resolution

## 🛡️ Security Features

### Input Validation
```solidity
// Weight must be meaningful but not excessive
if (actionType.weight == 0 || actionType.weight > 10000) 
    revert InvalidWeight(actionType.weight);

// M-of-N validation: M must be achievable with N
if (actionType.jurorsMin > actionType.panelSize) 
    revert InvalidJurorConfiguration(actionType.jurorsMin, actionType.panelSize);

// Time windows must be reasonable (1 hour to 30 days)
if (actionType.verifyWindow < 1 hours || actionType.verifyWindow > 30 days)
    revert InvalidTimeWindow(actionType.verifyWindow);
```

### Access Control
- **Governance**: Full control over action type lifecycle
- **Moderators**: Limited emergency powers (deactivate only)
- **Public**: Read-only access to all parameters

### Economic Safeguards
- **Bounded rewards**: Prevents inflation through excessive point rewards
- **Reasonable cooldowns**: Prevents spam while allowing legitimate work
- **Slashing limits**: Verifier penalties capped to prevent excessive punishment

## 📊 Economic Model

### WorkerPoints Rewards
Each action type defines how many WorkerPoints workers receive for approved claims:
- **Low complexity**: 100-500 points (simple tasks)
- **Medium complexity**: 500-2000 points (moderate effort required)
- **High complexity**: 2000-10000 points (significant contributions)

### Verifier Incentives
```solidity
rewardVerify     // Points for participating in verification
slashVerifierBps // Penalty for incorrect decisions (basis points)
```

This creates a balanced incentive structure:
- **Participation rewards** encourage verifier engagement
- **Accuracy penalties** ensure quality decision-making
- **Reputation effects** build long-term incentive alignment

## 🔄 Workflow Integration

### 1. Action Type Creation
```
Governance Proposal → Vote → Timelock → ActionType Created
```

### 2. Work Submission Flow
```
Worker checks ActionType requirements → Submits claim → Verification begins
```

### 3. Verification Parameter Usage
```
Claims contract reads ActionType → Configures verification → Selects jurors
```

## 📈 Advanced Features

### Evidence Specifications (IPFS)
Each action type references an IPFS document describing:
- Required proof of work completion
- Quality standards and criteria
- Submission format requirements
- Example evidence for clarity

### Dynamic Parameter Updates
Action types can evolve based on community experience:
- Adjust verification requirements based on success rates
- Modify rewards based on economic conditions
- Update evidence standards as work types mature

### Batch Operations
Efficiency features for governance:
- Create multiple related action types in single transaction
- Bulk activate/deactivate for seasonal adjustments
- Mass parameter updates for economic rebalancing

## 🎛️ Configuration Examples

### Software Development Task
```solidity
ActionType({
    weight: 2000,           // Substantial reward for code contributions
    jurorsMin: 3,           // Require 3 approvals
    panelSize: 5,           // From pool of 5 verifiers  
    verifyWindow: 72 hours, // 3 days to verify code quality
    cooldown: 24 hours,     // Daily contribution limit
    rewardVerify: 50,       // Modest verifier reward
    slashVerifierBps: 100,  // 1% reputation penalty for errors
    revocable: true,        // Governance can revoke if bugs found
    evidenceSpecCID: "QmX..." // IPFS hash of coding standards
})
```

### Community Moderation
```solidity
ActionType({
    weight: 500,            // Moderate reward for moderation
    jurorsMin: 2,           // Simple majority from 3
    panelSize: 3,           // Smaller panel for efficiency
    verifyWindow: 24 hours, // Quick turnaround needed
    cooldown: 1 hours,      // Frequent moderation allowed
    rewardVerify: 25,       // Lower verifier reward (higher volume)
    slashVerifierBps: 200,  // 2% penalty (subjective decisions)
    revocable: false,       // Moderation decisions should be final
    evidenceSpecCID: "QmY..." // Community guidelines reference
})
```

## 🔍 Monitoring & Analytics

### Health Metrics
The contract provides comprehensive data for system monitoring:
- Action type usage statistics
- Approval/rejection rates by type
- Average verification times
- Economic parameter effectiveness

### Governance Intelligence
Data supports informed governance decisions:
- Which action types need parameter adjustments
- Economic impact of different reward levels
- Verifier performance across action types
- Evidence specification effectiveness

## 🚀 Future Enhancements

### Planned Features
- **Dynamic parameter adjustment**: AI-driven parameter optimization
- **Category hierarchies**: Parent/child action type relationships
- **Cross-chain compatibility**: Multi-network action type synchronization
- **Advanced evidence types**: Integration with additional proof systems

### Scalability Considerations
- **Gas optimization**: Batch operations for large governance updates
- **Storage efficiency**: Compression techniques for evidence specifications
- **Query optimization**: Enhanced indexing for better dApp performance

---

The ActionTypeRegistry represents the foundational layer that makes Shift DeSoc's verification system both flexible and robust, enabling communities to define and evolve their work verification requirements while maintaining economic security and governance oversight.