# Shift DeSoc - Smart Contract Development Guide

## Mission: On-Chain Governance Platform for Decentralized Community Work

Shift DeSoc implements fully on-chain governance with multi-choice voting for community decision-making, work verification, and token economy. Core flow: `requests → drafts → proposals → timelock execution` with claims verification and soulbound token rewards.

## Architecture Overview

Shift implements a comprehensive **Community Coordination → Work Verification → Governance Execution** pipeline with full on-chain transparency and economic incentive alignment.

### Community Coordination Layer (CRITICAL - Foundation of All Activity)
- **CommunityRegistry**: Single source of truth for community metadata, parameters, module addresses, and cross-community relationships
- **RequestHub**: Decentralized discussion forum for community needs, ideas, and collaborative solution development  
- **DraftsManager**: Collaborative proposal development with versioning, review cycles, and escalation workflows
- **ParamController**: Dynamic parameter management for governance timing, eligibility rules, and economic splits

**Core Flow**: `Community Need → Discussion → Collaborative Draft → Formal Proposal → Governance Vote → Execution`

### Core Governance Stack
- **ShiftGovernor**: OpenZeppelin Governor + multi-choice voting extension for nuanced decision-making
- **CountingMultiChoice**: Custom counting module for weighted multi-option votes across complex proposals
- **TimelockController**: Execution delays for governance decisions with emergency override capabilities
- **MembershipTokenERC20Votes**: Governance token with vote delegation and SBT-weighted eligibility

### Work Verification System
- **ActionTypeRegistry**: Configurable action types with verification parameters, evidence requirements, and economic incentives
- **VerifierPool**: M-of-N juror selection with reputation bonding, pseudo-random selection, and economic rewards
- **Claims**: Work submission and verification workflow with evidence validation and appeals process
- **WorkerSBT**: Soulbound tokens minted on approved claims with WorkerPoints EMA tracking and governance revocation

### Token Economy & Revenue Distribution
- **CommunityToken**: 1:1 USDC-backed stablecoin for transparent community payments and treasury management
- **RevenueRouter**: Automated revenue splits (50% workers / 30% treasury / 20% investors, governable)
- **Marketplace**: Decentralized service marketplace with quality verification and reputation-based discovery
- **ProjectFactory**: ERC-1155 crowdfunding with milestone validation and investor protection mechanisms

### Community Infrastructure Modules
- **HousingManager**: Co-housing reservations (ERC-1155 per night) with investor staking and worker discounts
- **TreasuryAdapter**: Treasury management with governance-controlled spending limits and emergency procedures

## Development Workflow

### Dual Toolchain (Hardhat + Foundry)
```bash
# Foundry for testing (primary)
pnpm forge:test -vvv                    # Run all tests with verbose output
pnpm forge:cov                          # Generate coverage report
pnpm cov:gate                          # Enforce ≥86% coverage gate

# Hardhat for deployment
pnpm hh:compile                        # Compile contracts
pnpm -C packages/hardhat hardhat run scripts/deploy.ts --network base_sepolia
```

### Testing Strategy
- **Unit tests**: Individual contract functionality in `packages/foundry/test/`
- **Integration tests**: Cross-contract interactions
- **Fuzz tests**: Edge cases and input validation
- **Coverage target**: ≥86% enforced by `scripts/check-coverage.sh`

### Network Deployment Priority
1. **Base Sepolia** (testnet) - Primary development target
2. **Base** (production) - Main deployment target  
3. **Ethereum Sepolia** (testnet) - Secondary target after Base success
4. **Ethereum** (production) - Final deployment after proven on Base

## Community Coordination & Discussion Architecture (CRITICAL LAYER)

### RequestHub - Decentralized Community Discussion Forum

**Purpose**: On-chain discussion entry point where community members post needs/ideas and collaborate on solutions that escalate into actionable proposals.

**Core Functionality**:
```solidity
// Request lifecycle management
struct RequestMeta {
    address author;
    string title;
    string cid;              // IPFS content reference
    Status status;           // OPEN_DEBATE, FROZEN, ARCHIVED  
    uint64 createdAt;
    string[] tags;           // Categorization and discovery
}

function createRequest(string title, string cid, string[] tags) returns (uint256 requestId)
function postComment(uint256 requestId, uint256 parentId, string cid) returns (uint256 commentId)
function setStatus(uint256 requestId, Status status) // Moderator-gated
```

**Moderation Model**:
- **Role-based moderation**: CommunityRegistry-defined moderators can freeze (lock new posts) and archive requests
- **Governance override**: Community governance can override moderator decisions and revoke moderator status
- **Spam prevention**: Rate limits, minimum SBT/tenure requirements, refundable stake-to-post mechanism

**Content & Storage**:
- **Hybrid approach**: Essential metadata on-chain, rich content via IPFS CIDs and attestations
- **Event-driven**: Append-only comments as events for off-chain indexing and notification systems
- **Categories/Tags**: Lightweight tagging system with author/moderator edit capabilities

### DraftsManager - Collaborative Proposal Development

**Purpose**: Multi-contributor proposal development with versioning, review cycles, and community consensus mechanisms before formal governance submission.

**Core Functionality**:
```solidity
struct Draft {
    uint256 requestId;           // Source request
    address[] contributors;      // Multi-contributor collaboration
    ActionBundle actions;        // Governance actions (targets, values, calldatas)
    string[] versionCIDs;       // Immutable version snapshots
    DraftStatus status;          // DRAFTING, REVIEW, ESCALATED, WON, LOST
    uint256 proposalId;         // Link to formal governance proposal
    ReviewState reviews;         // Community feedback and consensus tracking
}

function createDraft(uint256 requestId, ActionBundle actions, string cid) returns (uint256 draftId)
function addContributor(uint256 draftId, address contributor) // Collaborative editing
function snapshotVersion(uint256 draftId, string newVersionCID) // Immutable versioning
function submitForReview(uint256 draftId) // Community review phase
function finalizeForProposal(uint256 draftId) // Lock version for governance
function escalateToProposal(uint256 draftId, bool multiChoice, uint8 numOptions, string description) returns (uint256 proposalId)
```

**Collaboration Features**:
- **Multi-contributor**: Multiple community members can contribute to draft development
- **Version control**: Immutable snapshots with IPFS content references
- **Review process**: Community feedback and consensus signaling before escalation
- **Escalation criteria**: Configurable per community (author + reviewer quorum, consensus thresholds, or time windows)

### CommunityRegistry - Community Coordination Hub

**Purpose**: Single source of truth for community metadata, governance parameters, module addresses, and cross-community relationships.

**Core Functionality**:
```solidity
struct Community {
    string name;
    string description; 
    string metadataURI;
    
    // Governance Parameters
    uint256 debateWindow;
    uint256 voteWindow;
    uint256 executionDelay;
    
    // Eligibility Rules
    uint256 minSeniority;
    uint256 minSBTs;
    uint256 proposalThreshold;
    
    // Economic Parameters
    uint256[3] revenueSplit;     // [workers%, treasury%, investors%]
    uint256 feeOnWithdraw;
    address[] backingAssets;     // Approved collateral tokens
    
    // Module Addresses
    address governor;
    address timelock;
    address requestHub;
    address draftsManager;
    address claimsManager;
    address actionTypeRegistry;
    address verifierPool;
    address workerSBT;
    address treasuryAdapter;
    
    // Roles & Permissions
    mapping(address => bool) moderators;
    mapping(address => bool) curators;
    
    // Cross-Community Links
    uint256 parentCommunityId;   // Federation/hierarchy support
    uint256[] allyCommunityIds;  // Partnership relationships
}

function registerCommunity(CommunityParams params) returns (uint256 communityId)
function updateParameters(uint256 communityId, ParameterUpdate[] updates) // Governance-gated
function setModuleAddress(uint256 communityId, bytes32 moduleKey, address moduleAddress)
function grantRole(uint256 communityId, address user, bytes32 role) 
function getCommunityModules(uint256 communityId) returns (ModuleAddresses memory)
```

### Integration Workflows

#### **RequestHub → Claims Integration (Bounty System)**:
```solidity
// Requests can spawn bounties by linking ActionTypes
function createBountyRequest(string title, string cid, uint256 actionTypeId, uint256 reward) 
// Workers file claims referencing the source request
function submitClaim(uint256 requestId, string evidenceCID) returns (uint256 claimId)
```

#### **DraftsManager ↔ ActionTypeRegistry Integration**:
```solidity
// Drafts can propose new ActionTypes that activate after governance approval
function proposeActionType(uint256 draftId, ActionTypeParams params) 
// ActionTypes become active only after successful governance vote
function activateActionType(uint256 actionTypeId, uint256 approvedProposalId)
```

#### **WorkerSBT Influence on Discussion System**:
- **Eligibility & Weighting**: SBT holders get higher post limits, priority in juror selection, draft escalation privileges
- **Quality Signals**: SBT-weighted community consensus for draft escalation thresholds
- **Reputation Integration**: Discussion reputation separate from work verification, used for throttling and permissions

### Discussion & Coordination Mechanics

#### **Anti-Spam & Quality Control**:
- **Rate Limiting**: Post frequency limits based on tenure and SBT count
- **Economic Stakes**: Refundable deposits for request creation (prevents spam, returned on legitimate activity)
- **Moderation Powers**: Community-selected moderators can freeze threads and archive low-quality content
- **Governance Appeals**: All moderation decisions appealable through governance process

#### **Notification & Discovery System**:
- **Event-Driven**: All actions emit standardized events for off-chain indexing
- **Push Notifications**: Integration with Push Protocol for real-time updates on discussions, draft changes, votes
- **Content Discovery**: Tag-based categorization and search, SBT-weighted relevance scoring

#### **Time Management Policies**:
```solidity
enum RequestPolicy {
    OPEN_ENDED,     // Requires periodic activity to stay active, auto-archive if stale
    TIME_BOXED,     // Auto-transition debate → vote via ParamController timing
    URGENT          // Expedited escalation path for time-sensitive decisions
}
```

## Smart Contract Patterns

### Multi-Choice Voting Implementation
```solidity
// In ShiftGovernor.sol
function proposeMultiChoice(
    address[] memory targets,
    uint256[] memory values, 
    bytes[] memory calldatas,
    string memory description,
    uint8 numOptions
) public returns (uint256 proposalId) {
    proposalId = propose(targets, values, calldatas, description);
    _numOptions[proposalId] = numOptions;
    if (multiCounter != address(0)) {
        ICountingMultiChoice(multiCounter).enableMulti(proposalId, numOptions);
    }
}

// In CountingMultiChoice.sol
function castVoteMulti(
    uint256 proposalId,
    address voter,
    uint256 weight,
    uint256[] calldata weights,
    string calldata reason
) external returns (uint256 weightUsed) {
    // weights array must sum ≤ 1e18 (100%)
    require(_sumWeights(weights) <= 1e18, "Invalid weights");
    // Apply voter's weight proportionally to each option
}
```

### Claims Verification Flow
```solidity
// ActionType configuration
struct ActionType {
    uint32 weight;              // WorkerPoints reward
    uint32 jurorsMin;           // M (minimum approvals)
    uint32 panelSize;           // N (total jurors)
    uint32 verifyWindow;        // Time limit for verification
    uint32 cooldown;            // Cooldown between claims
    uint32 rewardVerify;        // Verifier reward points
    uint32 slashVerifierBps;    // Slashing rate for bad verifiers
    bool revocable;             // Can be revoked by governance
    string evidenceSpecCID;     // IPFS evidence requirements
}

// Claims workflow: submit → verify (M-of-N) → approve → mint SBT
```

### Token Economy Patterns
```solidity
// CommunityToken: 1:1 USDC backing
function mint(uint256 usdcAmount) external {
    USDC.transferFrom(msg.sender, address(this), usdcAmount);
    _mint(msg.sender, usdcAmount);
}

function redeem(uint256 tokenAmount) external {
    _burn(msg.sender, tokenAmount);
    USDC.transfer(msg.sender, tokenAmount);
}
```

## Development Guidelines

### Code Standards
- **Solidity**: ^0.8.24 with OpenZeppelin 5.x
- **Gas optimization**: 200 optimizer runs, avoid unbounded loops
- **Security**: CEI pattern, reentrancy guards, input validation
- **Documentation**: Complete NatSpec for all public functions

### Error Handling
```solidity
// Use custom errors from contracts/libs/Errors.sol
error InvalidProposalId(uint256 proposalId);
error InsufficientVotingPower(address voter, uint256 required, uint256 actual);
error VotingPeriodEnded(uint256 proposalId, uint256 deadline);
```

### Testing Patterns
```solidity
// Base test contract pattern
contract TestBase is Test {
    ShiftGovernor governor;
    CountingMultiChoice counting;
    MembershipToken token;
    
    function setUp() public {
        token = new MembershipToken();
        governor = new ShiftGovernor(address(token), address(timelock));
        counting = new CountingMultiChoice();
        governor.setCountingMulti(address(counting));
    }
}
```

### Documentation Requirements

After implementing any new contract or major feature, **MANDATORY** documentation must be created in the `/docs` folder:

#### Technical Documentation (`/docs/contracts/[ContractName].md`)
Create comprehensive technical documentation that includes:

1. **Purpose & Role** - Clear explanation of the contract's function in the ecosystem
2. **Core Architecture** - Data structures, state management, and design patterns  
3. **Key Functions & Logic** - Detailed breakdown of major functions with code examples
4. **Security Features** - Access control, validation, and attack mitigation strategies
5. **Integration Points** - How the contract interacts with other system components
6. **Economic Model** - Incentive structures, token flows, and economic parameters
7. **Configuration Examples** - Practical parameter settings for different use cases
8. **Advanced Features** - Future enhancements and scalability considerations

**Template Structure**:
```markdown
# [ContractName] Contract

## 🎯 Purpose & Role
[Clear explanation of what this contract does and why it's needed]

## 🏗️ Core Architecture  
[Data structures, state variables, design patterns]

## ⚙️ Key Functions & Logic
[Detailed function breakdown with code examples]

## 🛡️ Security Features
[Access control, validation, attack prevention]

## 🔗 Integration Points
[How this contract works with others]

## 📊 Economic Model (if applicable)
[Token flows, incentives, parameters]

## 🎛️ Configuration Examples
[Practical parameter settings]

## 🚀 Advanced Features
[Future enhancements, scalability]
```

#### Business Documentation Updates
For major new features, update `/docs/Whitepaper.md` to include:

- **Business value proposition** of the new functionality
- **Market impact** and competitive advantages  
- **Revenue implications** and monetization opportunities
- **Use case scenarios** with real-world examples
- **Investment considerations** and risk assessment

#### Architecture Documentation Updates
Update `/docs/Architecture.md` to reflect:

- **Component relationships** and data flows
- **Security implications** of new functionality  
- **Scalability impact** and performance considerations
- **Integration workflows** and system dependencies

### Documentation Standards

#### Technical Accuracy
- **Code examples** must be functional and tested
- **Security analysis** must address real attack vectors
- **Performance claims** must be measurable and verified
- **Integration examples** must reflect actual implementation

#### Business Accessibility  
- **Explain technical terms** when first introduced with references
- **Use concrete examples** rather than abstract concepts
- **Focus on business value** and practical applications
- **Include visual aids** (diagrams, workflows) when helpful

#### Comprehensive Coverage
- **All public functions** documented with usage examples
- **Error conditions** and edge cases explained
- **Gas costs** and optimization considerations included  
- **Upgrade paths** and migration strategies outlined

### Documentation Validation Checklist

Before considering implementation complete, verify:

- [ ] Technical documentation covers all major functions and use cases
- [ ] Business documentation explains value proposition for non-technical stakeholders  
- [ ] Architecture documentation shows integration with existing system
- [ ] Code examples are functional and tested
- [ ] Security implications are thoroughly analyzed
- [ ] Economic model (if applicable) is clearly explained with concrete examples
- [ ] Configuration examples provide practical deployment guidance
- [ ] Documentation bridges technical complexity with business applications

**Goal**: Documentation should enable both developers to implement/integrate and business stakeholders to understand value and make informed decisions about the technology.

## Critical Implementation Tasks

### Phase 1: Community Coordination Layer (PRIORITY - FOUNDATION)
1. **CommunityRegistry**: Complete community metadata, parameters, module addresses, and role management
2. **RequestHub**: Full discussion forum with commenting, moderation, tagging, and spam prevention
3. **DraftsManager**: Multi-contributor proposal development with versioning and review cycles
4. **Integration workflows**: RequestHub → Claims bounties, DraftsManager → ActionType proposals

### Phase 2: Core Governance
1. Complete `CountingMultiChoice` with weight snapshots and events
2. Implement `ShiftGovernor` hooks and multi-choice integration
3. Add comprehensive getters for UI integration
4. **Integrate with DraftsManager**: Seamless draft → proposal escalation

### Phase 3: Verification System  
1. `ActionTypeRegistry` with configurable verification parameters
2. `VerifierPool` with pseudo-random juror selection and bonding
3. `Claims` end-to-end workflow with appeal windows and RequestHub integration
4. `WorkerSBT` with WorkerPoints EMA tracking and discussion privileges

### Phase 4: Economic Modules
1. `CommunityToken` with 1:1 USDC backing
2. `RevenueRouter` with configurable splits
3. `Marketplace` and `ProjectFactory` basic functionality
4. **TreasuryAdapter** with CommunityRegistry parameter integration

### Phase 4: Deployment & Testing
1. Complete deployment scripts for all networks
2. On-chain smoke tests covering full workflows
3. Achieve ≥86% test coverage
4. Base Sepolia deployment and verification

## Quick Start Commands

```bash
# Setup and test
pnpm install
pnpm build                    # Compile both toolchains
pnpm forge:test              # Run Foundry tests
pnpm cov:gate                # Check coverage

# Deploy to testnet
pnpm -C packages/hardhat hardhat run scripts/deploy.ts --network base_sepolia

# Format code
pnpm fmt
```

Focus on building robust, well-tested contracts that form the foundation of decentralized community governance and work verification.