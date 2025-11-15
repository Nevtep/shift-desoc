# Claims Contract

The Claims contract is the heart of Shift DeSoc's work verification system. It manages the complete lifecycle of work submissions, from initial claim through M-of-N juror verification to final resolution and appeals. This contract orchestrates the interaction between workers, verifiers, and the broader ecosystem.

## 🎯 Purpose & Role

The Claims contract serves as the **central verification engine** that:
- Receives and validates work submissions from community members
- Coordinates with VerifierPool to select qualified jurors
- Manages the voting process with both anonymous aggregates and individual tracking
- Handles appeals and dispute resolution
- Integrates with reputation systems and token rewards

Think of it as a **decentralized court system** where community members submit evidence of work, and qualified jurors evaluate and vote on the validity of those claims.

## 🏗️ Core Architecture

### Dual Privacy System

The Claims contract implements a sophisticated **two-layer privacy model** that balances transparency with accountability:

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

### Claim Lifecycle States

```solidity
enum ClaimStatus {
    Pending,     // Submitted, awaiting verification
    Approved,    // Verified and accepted
    Rejected,    // Verified and denied  
    Revoked      // Governance override (for revocable types)
}
```

## ⚙️ Key Functions & Logic

### Claim Submission

#### `submit(uint256 typeId, string calldata evidenceCID)`
**Purpose**: Workers submit evidence of completed work for verification.

**Detailed Process**:
1. **Validation Phase**:
   ```solidity
   // Ensure evidence is provided
   if (bytes(evidenceCID).length == 0) revert InvalidInput("Evidence CID cannot be empty");
   
   // Check worker isn't in cooldown period
   uint64 nextAllowed = workerCooldowns[msg.sender][typeId];
   if (block.timestamp < nextAllowed) revert InvalidInput("Worker is in cooldown period");
   ```

2. **Claim Creation**:
   ```solidity
   claimId = ++lastClaimId;
   claim.typeId = typeId;
   claim.worker = msg.sender;
   claim.evidenceCID = evidenceCID;
   claim.status = Types.ClaimStatus.Pending;
   claim.verifyDeadline = uint64(block.timestamp + 24 hours); // From ActionTypeRegistry
   ```

3. **Automatic Juror Selection** (Integration with VerifierPool):
   ```solidity
   if (verifierPool != address(0) && verifierPool.code.length > 0) {
       try IVerifierPool(verifierPool).selectJurors(claimId, panelSize, randomSeed) 
       returns (address[] memory selectedJurors) {
           claim.jurors = selectedJurors;
           emit JurorsAssigned(claimId, selectedJurors);
       } catch {
           // Graceful degradation: allow manual juror assignment
       }
   }
   ```

**Key Innovation**: Defensive integration with VerifierPool ensures the system continues functioning even if the verifier selection fails.

### Verification Process

#### `verify(uint256 claimId, bool approve)`
**Purpose**: Assigned jurors evaluate evidence and cast their votes.

**Voting Logic**:
```solidity
// Prevent double voting
if (claim.hasVoted[msg.sender]) revert InvalidInput("Juror already voted");

// Record both participation and decision
claim.hasVoted[msg.sender] = true;
claim.votes[msg.sender] = approve;

// Update anonymous aggregates
if (approve) {
    claim.approvalsCount++;
} else {
    claim.rejectionsCount++;
}

// Check for resolution
uint32 requiredApprovals = uint32(claim.jurors.length / 2 + 1);
if (claim.approvalsCount >= requiredApprovals) {
    _resolveClaim(claimId, Types.ClaimStatus.Approved);
} else if (claim.rejectionsCount >= requiredApprovals) {
    _resolveClaim(claimId, Types.ClaimStatus.Rejected);
}
```

**Privacy Protection**: Individual votes are recorded but not exposed in public APIs. Only aggregate counts are visible to external observers.

### Claim Resolution & Reputation Updates

#### `_resolveClaim(uint256 claimId, Types.ClaimStatus status)`
**Purpose**: Finalizes claim decision and updates all related systems.

**Resolution Process**:
1. **Status Update**: Mark claim as resolved with final status
2. **Reputation Integration**: 
   ```solidity
   if (verifierPool != address(0) && claim.jurors.length > 0) {
       _updateVerifierReputations(claimId, status);
   }
   ```
3. **Worker Rewards** (if approved):
   - Set cooldown period based on ActionType configuration
   - Trigger WorkerSBT minting (future integration)
   - Award WorkerPoints (future integration)
4. **Cleanup**: Remove from pending claims lists

#### `_updateVerifierReputations(uint256 claimId, Types.ClaimStatus finalStatus)`
**Purpose**: Analyze voting accuracy and update verifier reputations.

**Reputation Logic**:
```solidity
for (uint256 i = 0; i < claim.jurors.length; i++) {
    address juror = claim.jurors[i];
    
    // Skip non-participants (they get penalized by VerifierPool)
    if (!claim.hasVoted[juror]) {
        successful[i] = false;
        continue;
    }
    
    // Check if juror voted with the majority
    bool jurorApproved = claim.votes[juror];
    successful[i] = (finalStatus == Types.ClaimStatus.Approved) ? 
                    jurorApproved : !jurorApproved;
}

// Send results to VerifierPool for reputation updates
IVerifierPool(verifierPool).updateReputations(claimId, claim.jurors, successful);
```

**Economic Incentive**: Verifiers who consistently vote with the majority earn reputation, while those who don't lose reputation over time.

## 🔄 Appeals System

### Appeal Submission
#### `submitAppeal(uint256 claimId, string calldata reason)`
**Purpose**: Allows workers to contest rejected claims.

**Appeal Process**:
1. **Eligibility Check**: Only claim worker can appeal rejected claims
2. **Revocability Check**: Action type must allow appeals
3. **New Verification Round**: Appeals get fresh juror panels
4. **Independent Review**: Appeal jurors don't see original votes

### Appeal Resolution
Appeals follow the same M-of-N voting process as original claims, but with:
- Different juror panel (prevents bias)
- Higher scrutiny threshold (configurable)
- Final decision (no appeals of appeals)

## 🛡️ Security & Anti-Gaming Features

### Cooldown System
```solidity
mapping(address => mapping(uint256 => uint64)) public workerCooldowns;
```
**Purpose**: Prevents spam submissions and ensures quality over quantity.

**Mechanism**: After claim approval, worker must wait cooldown period before submitting another claim of the same type.

### Deadline Enforcement
```solidity
if (block.timestamp > claim.verifyDeadline) 
    revert InvalidInput("Verification deadline passed");
```
**Purpose**: Prevents stale claims from accumulating and ensures timely resolution.

### Access Control
- **Juror Verification**: Only assigned jurors can vote on specific claims
- **Worker Authentication**: Only claim submitter can appeal
- **Governance Override**: Can revoke approved claims for revocable action types

## 📊 Data Architecture & Storage

### Efficient Indexing
```solidity
mapping(uint256 => uint256[]) public claimsByWorker;    // Fast worker lookup
mapping(uint256 => uint256[]) public pendingClaims;     // Fast status queries
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

### VerifierPool Integration
```solidity
// Automatic juror selection
IVerifierPool(verifierPool).selectJurors(claimId, panelSize, seed)

// Reputation feedback loop  
IVerifierPool(verifierPool).updateReputations(claimId, jurors, successful)
```

### ActionTypeRegistry Integration
- Fetches verification parameters (M, N, deadlines, cooldowns)
- Validates action type is active and properly configured
- Uses evidence specifications for validation

### Future Integrations
- **WorkerSBT**: Mint soulbound tokens on approved claims
- **WorkerPoints**: Award points based on action type weights
- **Treasury**: Handle payment distributions and rewards

## 📈 Economic Model

### Worker Incentives
- **WorkerPoints**: Quantified contribution tracking
- **Soulbound Tokens**: Non-transferable reputation building
- **Cooldown Management**: Balances quality vs. quantity

### Verifier Incentives
- **Reputation Rewards**: Accurate voting increases selection probability
- **Reputation Penalties**: Inaccurate voting decreases future earnings
- **Participation Tracking**: Non-voting has reputation consequences

## 🎛️ Configuration & Governance

### Governance Controls
- Update contract addresses (VerifierPool, ActionTypeRegistry, etc.)
- Revoke approved claims (for revocable action types)
- Emergency parameter adjustments

### Upgradeability
- **Modular design**: Components can be upgraded independently
- **Interface stability**: Standard interfaces maintain compatibility
- **Data migration**: State can be preserved during upgrades

## 🔮 Advanced Features

### Claim Analytics
The contract provides rich data for:
- **Success rates** by action type and worker
- **Verification patterns** and juror performance
- **Appeal outcomes** and system fairness metrics
- **Economic efficiency** of different parameters

### Batch Processing
Future enhancements for scalability:
- Bulk claim submissions for related work
- Batch juror assignments for efficiency
- Mass resolution for expired claims

---

The Claims contract represents the operational core of Shift DeSoc's verification system, implementing sophisticated privacy-preserving voting with reputation-based quality assurance. Its dual-layer approach ensures both transparency and accountability while maintaining a smooth user experience and robust economic incentives.