# Claims Contract

The Claims contract is the heart of Shift DeSoc's work verification system. It manages the complete lifecycle of work submissions, from initial claim through M-of-N juror verification to final resolution and appeals. This contract orchestrates the interaction between workers, verifiers, and the broader ecosystem.

## 🎯 Purpose & Role

The Claims contract serves as the **central verification engine** that:

- Receives and validates work submissions from community members
- Coordinates with VerifierManager for democratic M-of-N juror selection using VPS
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

   // Check action type exists and is active
   Types.ValuableAction memory action = actionRegistry.getValuableAction(typeId);
   if (!actionRegistry.isValuableActionActive(typeId)) {
       revert InvalidInput("Action type is not active");
   }

   // Check worker isn't in cooldown period
   uint64 nextAllowed = workerCooldowns[msg.sender][typeId];
   if (block.timestamp < nextAllowed) revert InvalidInput("Worker is in cooldown period");

   // Check max concurrent claims for this action type
   uint256 currentConcurrent = _countActiveClaims(msg.sender, typeId);
   if (currentConcurrent >= action.maxConcurrent) {
       revert InvalidInput("Too many concurrent claims for this action type");
   }
   ```

2. **Claim Creation**:

   ```solidity
   claimId = ++lastClaimId;
   claim.typeId = typeId;
   claim.worker = msg.sender;
   claim.evidenceCID = evidenceCID;
   claim.status = Types.ClaimStatus.Pending;
   claim.verifyDeadline = uint64(block.timestamp + action.verifyWindow); // From ValuableActionRegistry
   ```

3. **Automatic Juror Selection** (Integration with VerifierManager):
   ```solidity
   if (verifierManager != address(0) && verifierManager.code.length > 0) {
       try IVerifierManager(verifierManager).selectJurors(claimId, communityId, randomSeed)
       returns (address[] memory selectedJurors, uint256[] memory selectedPowers) {
           claim.jurors = selectedJurors;
           emit JurorsAssigned(claimId, selectedJurors);
       } catch {
           // Graceful degradation: allow manual juror assignment
       }
   }
   ```

**Key Innovation**: Defensive integration with VerifierManager ensures the system continues functioning even if the verifier selection fails.

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
   if (verifierManager != address(0) && claim.jurors.length > 0) {
       _updateVerifierPerformance(claimId, status);
   }
   ```
3. **Worker Rewards** (if approved):

   ```solidity
   // Set cooldown based on ValuableAction configuration
   if (valuableAction.cooldownPeriod > 0) {
       workerCooldowns[claim.worker][claim.typeId] = uint64(block.timestamp + valuableAction.cooldownPeriod);
   }

   // Mint MembershipTokens for governance participation
   if (membershipToken != address(0) && valuableAction.membershipTokenReward > 0) {
       MembershipTokenERC20Votes(membershipToken).mint(
           claim.worker,
           valuableAction.membershipTokenReward,
           "ValuableAction completion"
       );
   }

   // Mint SBT with WorkerPoints and rich metadata
   if (valuableActionSBT != address(0)) {
       uint256 workerPoints = valuableAction.membershipTokenReward > 0 ?
           valuableAction.membershipTokenReward : 10; // Default 10 points

       string memory metadataURI = "{\"type\":\"claim\",\"id\":" + claimId +
           ",\"valuableAction\":" + claim.typeId + ",\"points\":" + workerPoints + "}";

       IValuableActionSBT(valuableActionSBT).mintAndAwardPoints(claim.worker, workerPoints, metadataURI);
   }
   ```

4. **Cleanup**: Remove from pending claims lists

#### `_updateVerifierReputations(uint256 claimId, Types.ClaimStatus finalStatus)`

**Purpose**: Analyze voting accuracy and update verifier reputations.

**Reputation Logic**:

```solidity
for (uint256 i = 0; i < claim.jurors.length; i++) {
    address juror = claim.jurors[i];

    // Skip non-participants (they get penalized by VerifierManager)
    if (!claim.hasVoted[juror]) {
        successful[i] = false;
        continue;
    }

    // Check if juror voted with the majority
    bool jurorApproved = claim.votes[juror];
    successful[i] = (finalStatus == Types.ClaimStatus.Approved) ?
                    jurorApproved : !jurorApproved;
}

// Send results to VerifierManager for performance updates
IVerifierManager(verifierManager).updatePerformance(claimId, claim.jurors, successful);
```

**Economic Incentive**: Verifiers who consistently vote with the majority earn reputation, while those who don't lose reputation over time.

**⚠️ Known Issue - Reputation System Flaw**: The current implementation has a timing issue where claims resolve immediately when enough votes are reached, causing remaining jurors who haven't voted yet to be unfairly penalized. This incentivizes rushed voting over thorough evidence review. Potential solutions include:

1. Only updating reputation for jurors who actually voted before resolution
2. Allowing full voting window and resolving based on deadline expiry
3. Implementing separate reputation logic for non-participation vs wrong decisions
4. Time-weighted voting where early accurate votes get bonus points

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

### VerifierManager Integration

```solidity
// Automatic juror selection
IVerifierManager(verifierManager).selectJurors(claimId, communityId, seed)

// Reputation feedback loop
IVerifierManager(verifierManager).updatePerformance(claimId, jurors, successful)
```

### ValuableActionRegistry Integration

- Fetches verification parameters (panelSize, verifyWindow, cooldowns, maxConcurrent)
- Validates action type is active and properly configured
- Uses evidence specifications for validation
- Retrieves reward parameters (membershipTokenReward, communityTokenReward)

### Current Integrations

- **ValuableActionSBT**: Mints soulbound tokens with WorkerPoints on approved claims
- **MembershipTokenERC20Votes**: Mints governance tokens based on ValuableAction rewards
- **VerifierManager**: Handles democratic juror selection and performance tracking via VPS

### Future Integrations

- **Treasury**: Handle payment distributions and CommunityToken rewards
- **Enhanced Metadata**: Richer SBT metadata with evidence links and validation history

## 📈 Economic Model

### Worker Incentives

- **MembershipTokens**: Governance voting power based on ValuableAction rewards
- **ValuableActionSBT + WorkerPoints**: Soulbound reputation tokens with quantified contribution tracking
- **Rich Metadata**: SBTs include claim details, timestamps, and point values
- **Cooldown Management**: Balances quality vs. quantity based on action type configuration

### Verifier Incentives

- **Reputation Rewards**: Accurate voting increases selection probability
- **Reputation Penalties**: Inaccurate voting decreases future earnings
- **Participation Tracking**: Non-voting has reputation consequences

## 🎛️ Configuration & Governance

### Governance Controls

- Update contract addresses (VerifierManager, VerifierElection, ValuableActionSBT, etc.)
- Note: ValuableActionRegistry is immutable and cannot be updated
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
