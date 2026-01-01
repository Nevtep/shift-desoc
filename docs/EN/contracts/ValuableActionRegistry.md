# ValuableActionRegistry Contract

The ValuableActionRegistry serves as the central configuration hub for defining **Valuable Actions** - specific types of work that communities recognize as valuable and worth verifying within the Shift DeSoc ecosystem. It defines the parameters, requirements, and verification logic for different categories of community contributions.

## 🎯 Purpose & Role

The ValuableActionRegistry acts as a **democratic work definition system** that allows communities to define:

- What specific types of work can be submitted for verification
- How many peer verifiers are required for each Valuable Action
- What evidence standards prove legitimate completion
- Economic rewards and verification parameters

**Core Concept**: Communities democratically create "Valuable Actions" that define how specific types of contribution translate into governance power, economic rewards, and portable reputation.

## 🏗️ Core Architecture

### ValuableAction Structure

```solidity
struct ValuableAction {
    uint32 membershipTokenReward;   // MembershipToken amount minted on completion
    uint32 communityTokenReward;    // CommunityToken amount for salary periods
    uint32 investorSBTReward;      // InvestorSBT minting for investment actions
    uint32 jurorsMin;              // Minimum approvals needed (M in M-of-N)
    uint32 panelSize;              // Total jurors selected (N in M-of-N)
    uint32 verifyWindow;           // Time limit for verification (seconds)
    uint32 verifierRewardWeight;   // Points earned by accurate verifiers
    uint32 slashVerifierBps;       // Penalty for inaccurate verification
    uint32 cooldownPeriod;         // Minimum time between engagements
    uint32 maxConcurrent;          // Maximum active engagements per person
    bool revocable;                // Can governance revoke this SBT
    bool requiresGovernanceApproval; // Community vote needed to activate
    bool founderVerified;          // Bootstrap security mechanism
    string evidenceSpecCID;        // IPFS hash of evidence requirements
    string titleTemplate;          // Template for engagement titles
}
```

### Design Philosophy

The ValuableActionRegistry follows these key principles:

1. **Democratic Definition**: Communities decide what work is valuable through governance
2. **Economic Integration**: Each Valuable Action defines reward conversion rates across token types
3. **Bootstrap Security**: Founder verification enables community launch without governance delays
4. **Evidence Standards**: IPFS-based specifications ensure transparent work requirements

## ⚙️ Key Functions

### Valuable Action Management

#### `proposeValuableAction(uint256 communityId, Types.ValuableAction calldata params, string calldata ipfsDescription)`

**Purpose**: Creates a new Valuable Action that defines what work is valuable and how it's rewarded.

**Process**:

1. Validates all parameters are within acceptable ranges
2. Assigns unique ID to the Valuable Action
3. Determines activation path (founder verification, governance approval, or direct activation)
4. Emits event for indexing and UI updates

**Three Activation Paths**:

- **Founder Verified**: Bypass governance for community bootstrap
- **Governance Required**: Community vote needed for activation
- **Direct Activation**: Simple Valuable Actions activate immediately

#### `update(uint256 id, Types.ValuableAction calldata params)`

**Purpose**: Modifies existing Valuable Action parameters.

**Security**:

- Only moderators can update active Valuable Actions
- Validates all parameters before applying changes
- Preserves system integrity with proper authorization

### State Management

#### `deactivate(uint256 id)`

**Purpose**: Disable Valuable Actions without deletion, preventing new engagements.

**Use Cases**:

- Temporarily disable problematic work categories
- Seasonal work types (disable during off-seasons)
- Emergency response to discovered issues or exploitation

#### `activateFromGovernance(uint256 valuableActionId, uint256 approvedProposalId)`

**Purpose**: Activate Valuable Actions after successful governance approval.

**Security**: Only governance can call this function, ensuring democratic control over what work communities value.

## 🛡️ Security Features

### Input Validation

```solidity
function _validateValuableAction(Types.ValuableAction calldata params) internal pure {
    // Ensure meaningful rewards
    if (params.membershipTokenReward == 0) revert Errors.InvalidInput("MembershipToken reward cannot be zero");

    // M-of-N validation: M must be achievable with N
    if (params.jurorsMin > params.panelSize) {
        revert Errors.InvalidInput("Minimum jurors cannot exceed panel size");
    }

    // Time windows must be reasonable
    if (params.verifyWindow == 0) revert Errors.InvalidInput("Verify window cannot be zero");
    if (params.slashVerifierBps > 10000) revert Errors.InvalidInput("Slash rate cannot exceed 100%");

    // Evidence requirements
    if (bytes(params.evidenceSpecCID).length == 0) {
        revert Errors.InvalidInput("Evidence spec CID cannot be empty");
    }
}
```

### Access Control

- **Governance**: Full control over Valuable Action lifecycle and moderator management
- **Moderators**: Can update and deactivate Valuable Actions (governance-appointed)
- **Founders**: Bootstrap privileges for community launch phase
- **Public**: Read-only access to all Valuable Action configurations

### Bootstrap Security

- **Founder Whitelist**: Prevents unauthorized bootstrap Valuable Actions
- **Community Scoped**: Founder privileges limited to specific community ID
- **Governance Override**: Community can revoke founder status through normal governance

## 📊 Economic Model

### Triple Reward System

Each Valuable Action defines how approved engagements translate into three types of value:

**MembershipToken Rewards** (Governance Power):

```solidity
membershipTokenReward  // Voting power minted for each approved engagement
```

**CommunityToken Rewards** (Economic Value):

```solidity
communityTokenReward   // Salary basis for periodic distributions
```

**InvestorSBT Rewards** (Capital Recognition):

```solidity
investorSBTReward      // For investment-type Valuable Actions
```

### Verifier Incentives

```solidity
verifierRewardWeight   // Points earned by accurate verifiers
slashVerifierBps       // Penalty for incorrect decisions (basis points)
```

**Balanced Incentive Structure**:

- **Participation rewards** encourage quality verifier engagement
- **Accuracy penalties** ensure careful decision-making
- **Reputation building** creates long-term incentive alignment

## 🔄 Workflow Integration

### 1. Valuable Action Creation

```
Community Need → Governance Proposal → Vote → Timelock → ValuableAction Activated
Alternative: Founder → Bootstrap ValuableAction → Immediate Activation
```

### 2. Work Submission Flow

```
Worker checks ValuableAction requirements → Submits engagement → Verification begins
```

### 3. Verification Parameter Usage

```
Engagements contract reads ValuableAction → Configures M-of-N verification → Selects jurors
```

### 4. Economic Integration

```
Approved Engagement → Mint MembershipTokens → Update CommunityToken salary basis → Mint ValuableActionSBT
```

## 📈 Advanced Features

### Evidence Specifications (IPFS)

Each Valuable Action references an IPFS document describing:

- Required proof of work completion
- Quality standards and acceptance criteria
- Submission format requirements
- Example evidence for clarity

### Bootstrap System

**Founder Verification** enables communities to launch without governance delays:

```solidity
mapping(address => mapping(uint256 => bool)) public founderWhitelist;
mapping(uint256 => address[]) public communityFounders;
```

### Governance Integration

**Pending System** for community-controlled Valuable Action approval:

```solidity
mapping(uint256 => uint256) public pendingValuableActions; // valuableActionId => proposalId
```

### Query Functions

Essential getters for frontend integration:

- `getActiveValuableActions()` - All currently active Valuable Actions
- `getCommunityFounders(uint256 communityId)` - Founder list per community
- `isValuableActionActive(uint256 id)` - Quick status check

## 🎛️ Configuration Examples

### Senior Software Development

```solidity
ValuableAction({
    membershipTokenReward: 2000,     // Substantial governance power
    communityTokenReward: 1500,      // High salary basis weight
    investorSBTReward: 0,           // Not an investment action
    jurorsMin: 3,                   // Require 3 approvals
    panelSize: 5,                   // From pool of 5 technical verifiers
    verifyWindow: 259200,           // 3 days to verify code quality
    verifierRewardWeight: 50,       // Modest verifier reward
    slashVerifierBps: 100,          // 1% reputation penalty for errors
    cooldownPeriod: 86400,          // Daily contribution limit
    maxConcurrent: 2,               // Max 2 active code engagements
    revocable: true,                // Governance can revoke if bugs found
    requiresGovernanceApproval: true, // Community vote required
    founderVerified: false,         // Not a bootstrap action
    evidenceSpecCID: "QmX...",      // IPFS hash of coding standards
    titleTemplate: "Code Contribution: {description}"
})
```

### Community Moderation

```solidity
ValuableAction({
    membershipTokenReward: 300,      // Moderate governance power
    communityTokenReward: 200,       // Lower salary weight
    investorSBTReward: 0,           // Not an investment action
    jurorsMin: 2,                   // Simple majority from 3
    panelSize: 3,                   // Smaller panel for efficiency
    verifyWindow: 86400,            // 24 hours for quick turnaround
    verifierRewardWeight: 25,       // Lower verifier reward (higher volume)
    slashVerifierBps: 200,          // 2% penalty (subjective decisions)
    cooldownPeriod: 3600,           // 1 hour between moderation engagements
    maxConcurrent: 5,               // Allow multiple concurrent moderation
    revocable: false,               // Moderation decisions should be final
    requiresGovernanceApproval: false, // Direct activation
    founderVerified: false,         // Community action, not bootstrap
    evidenceSpecCID: "QmY...",      // Community guidelines reference
    titleTemplate: "Moderation: {violation_type}"
})
```

## 🔍 Frontend Integration

### Essential Getters

```solidity
// Check if a Valuable Action exists and is active
function isValuableActionActive(uint256 id) external view returns (bool)

// Get full configuration for UI display
function getValuableAction(uint256 id) external view returns (Types.ValuableAction memory)

// List all active Valuable Actions for selection UI
function getActiveValuableActions() external view returns (uint256[] memory)

// Community founder management
function getCommunityFounders(uint256 communityId) external view returns (address[] memory)
```

### Event Tracking

```solidity
event ValuableActionCreated(uint256 indexed id, Types.ValuableAction valuableAction, address indexed creator);
event ValuableActionActivated(uint256 indexed id, uint256 indexed proposalId);
event ValuableActionDeactivated(uint256 indexed id, address indexed deactivator);
event ModeratorUpdated(address indexed account, bool isModerator, address indexed updater);
```

## � Usage Examples

### Creating a Bootstrap Valuable Action

```solidity
// Founder creates immediate Valuable Action for community launch
proposeValuableAction(
    communityId,
    ValuableAction({
        membershipTokenReward: 1000,
        communityTokenReward: 500,
        // ... other parameters
        founderVerified: true,  // Bypass governance
        requiresGovernanceApproval: false
    }),
    "ipfs://QmBootstrap..."
);
// Result: Immediately active, ready for engagements
```

### Creating a Governance-Controlled Valuable Action

```solidity
// Community member proposes new work category
proposeValuableAction(
    communityId,
    ValuableAction({
        membershipTokenReward: 2000,
        communityTokenReward: 1500,
        // ... other parameters
        founderVerified: false,
        requiresGovernanceApproval: true  // Requires community vote
    }),
    "ipfs://QmProposal..."
);
// Result: Pending governance approval, not yet active
```

**Production Ready**: ValuableActionRegistry provides the democratic infrastructure for communities to define their own value systems while maintaining security through founder verification for bootstrap and governance approval for ongoing evolution.

---

_This documentation reflects the actual implementation using correct "ValuableAction" terminology rather than the outdated "ActionType" references, ensuring alignment with the project vision and codebase._
