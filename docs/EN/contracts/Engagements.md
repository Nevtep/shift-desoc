# Engagements Contract

The Engagements contract is the heart of Shift DeSoc's work verification system. It manages the complete lifecycle of one-shot engagement submissions, from initial submission through M-of-N juror verification to final resolution and appeals. This contract orchestrates the interaction between workers, verifiers, and the broader ecosystem.

## 🎯 Purpose & Role

The Engagements contract serves as the **central verification engine** for one-shot work that:

- Receives and validates engagement submissions from community members
- Coordinates with VerifierManager for democratic M-of-N juror selection using VPS
- Manages the voting process with both anonymous aggregates and individual tracking
- Handles appeals and dispute resolution
- Integrates with reputation systems and token rewards

Think of it as a **decentralized court system** where community members submit evidence of work, and qualified jurors evaluate and vote on the validity of those engagements.

> **Note**: Engagements handles one-shot work verification only. For credentials, use CredentialManager. For ongoing positions, use PositionManager.

## 🏗️ Core Architecture

### Engagement Types (via EngagementSubtype)

The system supports three engagement subtypes:

```solidity
enum EngagementSubtype {
    WORK,        // One-shot task completion (bounties, deliverables)
    ROLE,        // Certified past role (minted when Position closes with SUCCESS)
    CREDENTIAL   // Course/training completion (handled by CredentialManager)
}
```

### Dual Privacy System

The Engagements contract implements a sophisticated **two-layer privacy model** that balances transparency with accountability:

#### Layer 1: Anonymous Aggregates (Always Public)

```solidity
uint32 approvalsCount;      // Total approvals - no individual identity
uint32 rejectionsCount;     // Total rejections - no individual identity
```

**Benefits:**

- Public can see "4 out of 7 jurors approved" without knowing who
- Maintains juror privacy for normal operations
- Enables quick UI displays and majority calculations
- Provides transparency without compromising individual voting patterns

#### Layer 2: Individual Vote Tracking (System Internal)

```solidity
mapping(address => bool) hasVoted;  // Whether juror participated
mapping(address => bool) votes;     // Individual decisions (true=approve, false=reject)
```

**Benefits:**

- Enables reputation system to reward accurate verifiers
- Supports appeal processes with detailed vote analysis
- Allows detection of malicious voting patterns
- Creates accountability without public exposure

### Engagement Lifecycle States

```solidity
enum EngagementStatus {
    Pending,     // Submitted, awaiting verification
    Approved,    // Verified and accepted
    Rejected,    // Verified and denied
    Revoked      // Governance override (for revocable types)
}
```

## ⚙️ Key Functions & Logic

### Engagement Submission

#### `submit(uint256 typeId, string calldata evidenceCID)`

**Purpose**: Workers submit evidence of completed work for verification.

**Detailed Process**:

1. **Validation Phase**:

   ```solidity
   // Ensure evidence is provided
   if (bytes(evidenceCID).length == 0) revert InvalidInput("Evidence CID cannot be empty");

   // Check action type exists and is active
   Types.ValuableAction memory action = actionRegistry.getValuableAction(typeId);
   if (!actionRegistry.isValuableActionActive(typeId)) {
       revert InvalidInput("Action type is not active");
   }

   // Check worker isn't in cooldown period
   uint64 nextAllowed = workerCooldowns[msg.sender][typeId];
   if (block.timestamp < nextAllowed) revert InvalidInput("Worker is in cooldown period");

   // Check max concurrent engagements for this action type
   uint256 currentConcurrent = _countActiveEngagements(msg.sender, typeId);
   if (currentConcurrent >= action.maxConcurrent) {
       revert InvalidInput("Too many concurrent engagements for this action type");
   }
   ```

2. **Engagement Creation**:

   ```solidity
   engagementId = ++lastEngagementId;
   engagement.typeId = typeId;
   engagement.worker = msg.sender;
   engagement.evidenceCID = evidenceCID;
   engagement.status = Types.EngagementStatus.Pending;
   engagement.verifyDeadline = uint64(block.timestamp + action.verifyWindow);
   ```

3. **Automatic Juror Selection** (Integration with VerifierManager):
   ```solidity
   if (verifierManager != address(0) && verifierManager.code.length > 0) {
       try IVerifierManager(verifierManager).selectJurors(engagementId, communityId, randomSeed)
       returns (address[] memory selectedJurors, uint256[] memory selectedPowers) {
           engagement.jurors = selectedJurors;
           emit JurorsAssigned(engagementId, selectedJurors);
       } catch {
           // Graceful degradation: allow manual juror assignment
       }
   }
   ```

**Key Innovation**: Defensive integration with VerifierManager ensures the system continues functioning even if the verifier selection fails.

### Verification Process

#### `verify(uint256 engagementId, bool approve)`

**Purpose**: Assigned jurors evaluate evidence and cast their votes.

**Voting Logic**:

```solidity
// Prevent double voting
if (engagement.hasVoted[msg.sender]) revert InvalidInput("Juror already voted");

// Record both participation and decision
engagement.hasVoted[msg.sender] = true;
engagement.votes[msg.sender] = approve;

// Update anonymous aggregates
if (approve) {
    engagement.approvalsCount++;
} else {
    engagement.rejectionsCount++;
}

// Check for resolution
uint32 requiredApprovals = uint32(engagement.jurors.length / 2 + 1);
if (engagement.approvalsCount >= requiredApprovals) {
    _resolveEngagement(engagementId, Types.EngagementStatus.Approved);
} else if (engagement.rejectionsCount >= requiredApprovals) {
    _resolveEngagement(engagementId, Types.EngagementStatus.Rejected);
}
```

**Privacy Protection**: Individual votes are recorded but not exposed in public APIs. Only aggregate counts are visible to external observers.

### Engagement Resolution & Reputation Updates

#### `_resolveEngagement(uint256 engagementId, Types.EngagementStatus status)`

**Purpose**: Finalizes engagement decision and updates all related systems.

**Resolution Process**:

1. **Status Update**: Mark engagement as resolved with final status
2. **Reputation Integration**:
   ```solidity
   if (verifierManager != address(0) && engagement.jurors.length > 0) {
       _updateVerifierPerformance(engagementId, status);
   }
   ```
3. **Worker Rewards** (if approved):

   ```solidity
   // Set cooldown based on ValuableAction configuration
   if (valuableAction.cooldownPeriod > 0) {
       workerCooldowns[engagement.worker][engagement.typeId] = 
           uint64(block.timestamp + valuableAction.cooldownPeriod);
   }

   // Mint MembershipTokens for governance participation
   if (membershipToken != address(0) && valuableAction.membershipTokenReward > 0) {
       MembershipTokenERC20Votes(membershipToken).mint(
           engagement.worker,
           valuableAction.membershipTokenReward,
           "ValuableAction completion"
       );
   }

   // Mint SBT via ValuableActionRegistry
   if (valuableActionRegistry != address(0)) {
       valuableActionRegistry.issueEngagement(
           communityId,
           engagement.worker,
           EngagementSubtype.WORK,
           engagement.typeId,
           metadata
       );
   }
   ```

4. **Cleanup**: Remove from pending engagements lists

## 🔄 Appeals System

### Appeal Submission

#### `submitAppeal(uint256 engagementId, string calldata reason)`

**Purpose**: Allows workers to contest rejected engagements.

**Appeal Process**:

1. **Eligibility Check**: Only engagement worker can appeal rejected engagements
2. **Revocability Check**: Action type must allow appeals
3. **New Verification Round**: Appeals get fresh juror panels
4. **Independent Review**: Appeal jurors don't see original votes

### Appeal Resolution

Appeals follow the same M-of-N voting process as original engagements, but with:

- Different juror panel (prevents bias)
- Higher scrutiny threshold (configurable)
- Final decision (no appeals of appeals)

## 🛡️ Security & Anti-Gaming Features

### Cooldown System

```solidity
mapping(address => mapping(uint256 => uint64)) public workerCooldowns;
```

**Purpose**: Prevents spam submissions and ensures quality over quantity.

**Mechanism**: After engagement approval, worker must wait cooldown period before submitting another engagement of the same type.

### Deadline Enforcement

```solidity
if (block.timestamp > engagement.verifyDeadline)
    revert InvalidInput("Verification deadline passed");
```

**Purpose**: Prevents stale engagements from accumulating and ensures timely resolution.

### Access Control

- **Juror Verification**: Only assigned jurors can vote on specific engagements
- **Worker Authentication**: Only engagement submitter can appeal
- **Governance Override**: Can revoke approved engagements for revocable action types

## 📊 Data Architecture & Storage

### Efficient Indexing

```solidity
mapping(uint256 => uint256[]) public engagementsByWorker;    // Fast worker lookup
mapping(uint256 => uint256[]) public pendingEngagements;     // Fast status queries
```

### Event-Driven Architecture

All major state changes emit events for:

- Real-time UI updates
- Analytics and monitoring
- Integration with external systems
- Audit trail maintenance

### Gas Optimization

- **Batch operations** where possible
- **Lazy deletion** (mark as resolved instead of deleting)
- **Efficient array management** (swap-and-pop for removals)
- **Minimal storage writes** (pack related data)

## 🔍 Integration Points

### VerifierManager Integration

```solidity
// Automatic juror selection
IVerifierManager(verifierManager).selectJurors(engagementId, communityId, seed)

// Reputation feedback loop
IVerifierManager(verifierManager).updatePerformance(engagementId, jurors, successful)
```

### ValuableActionRegistry Integration

- Fetches verification parameters (panelSize, verifyWindow, cooldowns, maxConcurrent)
- Validates action type is active and properly configured
- Uses evidence specifications for validation
- Retrieves reward parameters (membershipTokenReward, communityTokenReward)
- Issues Engagement SBTs via `issueEngagement()`

### Current Integrations

- **ValuableActionSBT**: Mints soulbound tokens with WorkerPoints on approved engagements
- **MembershipTokenERC20Votes**: Mints governance tokens based on ValuableAction rewards
- **VerifierManager**: Handles democratic juror selection and performance tracking via VPS
- **ValuableActionRegistry**: Coordinates SBT issuance with proper subtype

### Related Manager Contracts

- **CredentialManager**: Handles CREDENTIAL subtype engagements (course completions)
- **PositionManager**: Handles ROLE subtype (minted when positions close successfully)
- **InvestmentCohortManager**: Handles Investment SBT issuance (separate from work verification)

## 📈 Economic Model

### Worker Incentives

- **MembershipTokens**: Governance voting power based on ValuableAction rewards
- **ValuableActionSBT + WorkerPoints**: Soulbound reputation tokens with quantified contribution tracking
- **Rich Metadata**: SBTs include engagement details, timestamps, and point values
- **Cooldown Management**: Balances quality vs. quantity based on action type configuration

### Verifier Incentives

- **Reputation Rewards**: Accurate voting increases selection probability
- **Reputation Penalties**: Inaccurate voting decreases future earnings
- **Participation Tracking**: Non-voting has reputation consequences

## 🎛️ Configuration & Governance

### Governance Controls

- Update contract addresses (VerifierManager, VerifierElection, ValuableActionSBT, etc.)
- Note: ValuableActionRegistry is immutable and cannot be updated
- Revoke approved engagements (for revocable action types)
- Emergency parameter adjustments

### Upgradeability

- **Modular design**: Components can be upgraded independently
- **Interface stability**: Standard interfaces maintain compatibility
- **Data migration**: State can be preserved during upgrades

---

The Engagements contract represents the operational core of Shift DeSoc's one-shot work verification system, implementing sophisticated privacy-preserving voting with reputation-based quality assurance. Its dual-layer approach ensures both transparency and accountability while maintaining a smooth user experience and robust economic incentives.
