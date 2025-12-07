# DraftsManager Contract

## 🎯 Purpose & Role

DraftsManager enables **collaborative proposal development** within the Shift DeSoc ecosystem, providing a structured workflow for communities to develop governance proposals through multi-contributor collaboration, version control, and consensus-building before formal escalation to on-chain voting.

The contract serves as the bridge between RequestHub discussions and formal governance proposals, ensuring that community ideas are thoroughly developed, reviewed, and refined through collaborative processes before reaching the voting stage.

## 🏗️ Core Architecture

### Data Structures

```solidity
struct Draft {
    uint256 communityId;           // Source community
    uint256 requestId;             // Optional source request
    address author;                // Original creator
    address[] contributors;        // All contributors
    ActionBundle actions;          // Governance actions to execute
    string[] versionCIDs;         // Version history (IPFS)
    DraftStatus status;           // Current workflow stage
    uint64 createdAt;             // Creation timestamp
    uint64 reviewStartedAt;       // Review phase start
    uint64 finalizedAt;           // Finalization timestamp
    uint256 proposalId;           // Linked governance proposal
    ReviewState reviews;          // Community feedback
    mapping(address => bool) isContributor;
}

// Storage: Dynamic array of drafts
Draft[] internal _drafts;

struct ActionBundle {
    address[] targets;      // Contract addresses to call
    uint256[] values;       // ETH values for each call
    bytes[] calldatas;      // Function call data
    bytes32 actionsHash;    // Hash for verification
}

struct ReviewState {
    uint256 supportCount;        // Positive reviews
    uint256 opposeCount;         // Negative reviews
    uint256 neutralCount;        // Neutral feedback
    uint256 requestChangesCount; // Change requests
    uint256 totalReviews;        // Total review count
    mapping(address => Review) reviews;
}
```

### Status Workflow

```
DRAFTING → REVIEW → FINALIZED → ESCALATED → [WON/LOST]
    ↓         ↓         ↓           ↓
Collab    Community  Ready for   In Governance
Dev       Feedback   Proposal    Voting
```

## ⚙️ Key Functions & Logic

### Draft Creation & Management

```solidity
function createDraft(
    uint256 communityId,
    uint256 requestId,      // Optional: 0 if standalone
    ActionBundle calldata actions,
    string calldata versionCID
) external returns (uint256 draftId)
```

**Creates new collaborative draft** with initial version and governance actions.

- **Community Integration**: Links to specific community context
- **Request Linking**: Optional connection to RequestHub discussions
- **Action Definition**: Specifies exact governance actions to execute
- **Version Tracking**: Immutable IPFS content versioning

**🚧 Validation Status**: Currently accepts any communityId and requestId without validation. Community and request existence checks are planned for future implementation.

### Collaborative Features

```solidity
function addContributor(uint256 draftId, address contributor) external
function removeContributor(uint256 draftId, address contributor) external
function snapshotVersion(uint256 draftId, string calldata newVersionCID) external
```

**Multi-contributor collaboration** enabling:

- **Permission Management**: Author and contributors can modify drafts
- **Version Control**: Immutable snapshots with IPFS content
- **Collaborative Editing**: Multiple community members can contribute
- **Change Tracking**: Complete audit trail of modifications

### Review & Consensus System

```solidity
function submitReview(
    uint256 draftId,
    ReviewType reviewType,    // SUPPORT, OPPOSE, NEUTRAL, REQUEST_CHANGES
    string calldata reasonCID // Detailed feedback (IPFS)
) external

function finalizeForProposal(uint256 draftId) external
```

**Community consensus building** through:

- **Review Types**: Support, oppose, neutral, or request changes
- **Feedback System**: Detailed reasoning via IPFS content
- **Consensus Thresholds**: Configurable support requirements (default 60%)
- **Time Requirements**: Minimum review periods (default 3 days)
- **Quality Gates**: Minimum review count requirements (default 3)

### Governance Escalation

```solidity
function escalateToProposal(
    uint256 draftId,
    bool multiChoice,
    uint8 numOptions,
    string calldata description
) external returns (uint256 proposalId)
```

**Seamless governance integration**:

- **Binary Proposals**: Standard yes/no governance votes
- **Multi-Choice Voting**: Complex decisions with multiple options
- **Governor Integration**: Direct submission to ShiftGovernor
- **Proposal Tracking**: Bidirectional linking with governance system

## 🛡️ Security Features

### Access Control

```solidity
modifier onlyAuthorOrContributor(uint256 draftId) {
    Draft storage draft = _drafts[draftId];
    if (msg.sender != draft.author && !draft.isContributor[msg.sender]) {
        revert NotAuthorized(msg.sender);
    }
    _;
}
```

**Collaborative permissions**:

- **Author Control**: Original creator maintains full control
- **Contributor Rights**: Added contributors can modify and version
- **Review Restrictions**: Contributors cannot review their own drafts
- **Status Gates**: Operations restricted by current workflow stage

**⚠️ Admin Access Control Gap**:

- `updateGovernor()` and `updateConfiguration()` functions currently lack proper governance authorization
- `updateProposalOutcome()` needs authorization from governance or proposal outcome oracle
- These functions are marked with TODOs for future security implementation

### Consensus Validation

```solidity
// Minimum review period enforcement
if (timeElapsed < reviewPeriod) {
    revert ReviewPeriodNotMet(reviewPeriod - timeElapsed);
}

// Support threshold validation
uint256 supportBps = (reviewState.supportCount * 10000) / reviewState.totalReviews;
if (supportBps < supportThresholdBps) {
    revert InsufficientSupport(supportBps, supportThresholdBps);
}
```

**Quality assurance**:

- **Time Gates**: Prevents rushed proposals
- **Consensus Requirements**: Ensures community support
- **Review Minimums**: Guarantees adequate feedback
- **Status Validation**: Enforces proper workflow progression

### Input Validation

- **Non-empty Content**: All IPFS CIDs validated
- **Zero Address Checks**: Prevents invalid contributor addresses
- **Status Transitions**: Enforces valid workflow progression
- **Parameter Bounds**: Support thresholds ≤ 100%

## 🔗 Integration Points

### RequestHub Integration

```solidity
// Direct link from community discussions
uint256 draftId = draftsManager.createDraft(
    communityId,
    requestId,    // Links to specific RequestHub discussion
    actions,
    versionCID
);
```

**Seamless discussion → proposal workflow**:

- **Request Linking**: Optional connection to community discussions
- **Context Preservation**: Maintains discussion history
- **Bounty Integration**: Can implement bounty-driven development
- **Community Continuity**: Same community context throughout

### ShiftGovernor Integration

```solidity
// Direct proposal creation
if (multiChoice) {
    proposalId = IGovernorLike(governor).proposeMultiChoice(
        draft.actions.targets,
        draft.actions.values,
        draft.actions.calldatas,
        description,
        numOptions
    );
}
```

**Governance workflow**:

- **Action Execution**: Direct translation to governance calls
- **Multi-Choice Support**: Complex voting scenarios
- **Proposal Tracking**: Bidirectional ID linking
- **Outcome Updates**: Success/failure status tracking

**⚠️ Implementation Note**: Proposal outcome updates currently lack proper authorization checks and should only be callable by governance or authorized systems.

### CommunityRegistry Integration

**Community context**:

- **Parameter Compliance**: Follows community governance rules
- **Permission Inheritance**: Uses community role system
- **Configuration Binding**: Community-specific thresholds
- **Cross-Community Coordination**: Supports alliance workflows

**🚧 Development Status**: Community and request validation are not yet implemented but are planned for future versions.

## 📊 Economic Model

### Incentive Alignment

The DraftsManager creates economic incentives for **quality proposal development**:

- **Contributor Recognition**: Public attribution for all contributors
- **Reputation Building**: Quality drafts enhance community standing
- **Outcome Tracking**: Success rates visible for continuous improvement
- **Integration Rewards**: Can link to WorkerSBT point awards

### Resource Management

**Gas Optimization**:

- **Efficient Storage**: Mappings for O(1) lookups
- **Event-Driven**: Off-chain indexing for complex queries
- **Minimal On-Chain**: IPFS for large content storage
- **Batch Operations**: Combined actions for efficiency

## 🎛️ Configuration Examples

### Community Governance Parameters

```solidity
// Conservative community (high consensus requirements)
reviewPeriod = 7 days;
minReviewsForEscalation = 5;
supportThresholdBps = 7500; // 75% support required

// Agile community (faster iteration)
reviewPeriod = 1 days;
minReviewsForEscalation = 3;
supportThresholdBps = 6000; // 60% support required
```

### Integration Scenarios

**RequestHub → DraftsManager → Governance**:

```solidity
// 1. Community discusses need in RequestHub
uint256 requestId = requestHub.createRequest(communityId, "Treasury Upgrade", cid, tags);

// 2. Developer creates draft proposal
uint256 draftId = draftsManager.createDraft(communityId, requestId, actions, "v1.0");

// 3. Collaborative development
draftsManager.addContributor(draftId, contributor1);
draftsManager.snapshotVersion(draftId, "v2.0");

// 4. Community review
draftsManager.submitForReview(draftId);
// Multiple community members review...

// 5. Governance escalation
draftsManager.finalizeForProposal(draftId);
uint256 proposalId = draftsManager.escalateToProposal(draftId, false, 0, description);

// 6. Outcome tracking
draftsManager.updateProposalOutcome(draftId, DraftStatus.WON);
```

## � Current Implementation Status

### Completed Features ✅

- **Draft Creation & Management**: Full collaborative editing system
- **Version Control**: Immutable IPFS-based versioning
- **Review System**: Complete consensus-building mechanism
- **Governance Escalation**: Direct integration with ShiftGovernor
- **Multi-Choice Support**: Complex proposal types
- **Access Control**: Author/contributor permission system

### Pending Implementation 🔄

- **Authorization System**: Admin functions lack governance checks
- **Community Validation**: Registry integration not implemented
- **Request Validation**: RequestHub linking validation missing
- **Event System**: Missing governance and configuration update events
- **Advanced Security**: Additional authorization layers needed

### Technical Debt 📋

```solidity
// Current TODOs in contract:
// 1. updateProposalOutcome: Add proper authorization check
// 2. updateGovernor: Add governance authorization + emit events
// 3. updateConfiguration: Add governance authorization + emit events
// 4. createDraft: Validate community exists via CommunityRegistry
// 5. createDraft: Validate request exists if requestId > 0
```

## �🚀 Advanced Features

### Version Control System

**Git-like versioning** for proposals:

- **Immutable History**: All versions permanently stored
- **Content Addressing**: IPFS ensures content integrity
- **Branching Support**: Multiple contributors can work simultaneously
- **Merge Workflow**: Review process acts as merge gate

### Multi-Community Coordination

**Cross-community proposals**:

- **Alliance Support**: Drafts can span allied communities
- **Parent-Child Relations**: Hierarchical community governance
- **Federation Models**: Coordinated governance across communities
- **Resource Sharing**: Shared development costs and benefits

### Governance Innovation

**Advanced voting patterns**:

- **Multi-Choice Proposals**: Complex decision trees
- **Conditional Execution**: Dependent action sequences
- **Parametric Governance**: Dynamic parameter adjustment
- **Experimental Features**: A/B testing for governance changes

### Analytics & Insights

**Data-driven governance**:

- **Success Tracking**: Proposal outcome analytics
- **Contributor Metrics**: Development participation rates
- **Review Quality**: Feedback effectiveness measurement
- **Community Health**: Engagement and consensus indicators

### Administrative Functions (⚠️ Incomplete)

**Current admin functions lack proper authorization:**

```solidity
function updateGovernor(address newGovernor) external {
    // TODO: Add governance authorization
    // TODO: Emit GovernanceUpdated event with oldGovernor
}

function updateConfiguration(
    uint256 newReviewPeriod,
    uint256 newMinReviews,
    uint256 newSupportThreshold
) external {
    // TODO: Add governance authorization
    // TODO: Emit configuration updated event
}
```

**Security Implications**:

- Functions are currently callable by anyone
- No event emissions for governance changes
- Missing proper access control integration

### Future Enhancements

**Planned improvements**:

- **Authorization System**: Proper governance-gated admin functions
- **AI-Assisted Drafting**: Content suggestions and optimization
- **Automated Testing**: Proposal simulation before voting
- **Cross-Chain Coordination**: Multi-network governance
- **Reputation Integration**: Weighted reviews based on contribution history
- **Economic Incentives**: Token rewards for quality contributions

### Integration Workflows

**DraftsManager serves as the critical link** in the complete Shift DeSoc governance pipeline:

RequestHub (Discussion) → DraftsManager (Development) → ShiftGovernor (Voting) → TimelockController (Execution)

This creates a **comprehensive governance system** where:

1. **Community needs** are identified and discussed
2. **Collaborative solutions** are developed and refined
3. **Consensus building** occurs before formal voting
4. **Quality proposals** reach the governance stage
5. **Successful execution** of community decisions

The result is **higher quality governance** with better community engagement and more thoughtful decision-making processes.
