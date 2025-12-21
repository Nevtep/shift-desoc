# Shift DeSoc - Smart Contract Development Guide

## Mission: Meta-Governance Technology for Flexible Community Organization

**Shift DeSoc is meta-governance technology** - flexible infrastructure that enables communities to model any organizational structure they choose. Rather than imposing a specific governance model, Shift provides building blocks (governance protocols, work verification systems, and economic mechanisms) that communities configure to implement their unique decision-making processes, value definitions, and coordination patterns. NEVER ADD PRIVATE KEYS TO ANY FILES.

Core flow: `requests → drafts → proposals → timelock execution` with ValuableAction-based merit verification and token rewards.

## 🎯 **Current Status: PRODUCTION-READY MVP (December 2025)**

**✅ PRODUCTION DEPLOYED**: Complete ecosystem successfully deployed and verified on Base Sepolia with operational community.

**Key Achievements:**

- **Complete Contract Suite**: All 22 contracts deployed and verified on Base Sepolia
- **API-Based Community Creation**: Scalable deployment system with JSON address management (~$0.19 per community vs $9,600 on Ethereum)
- **Real Deployments Verified**: Community ID 1 successfully operating on Base Sepolia with full configuration
- **Comprehensive Documentation**: 21 contracts fully documented with technical architecture and business value
- **Automated Address Management**: Deployment addresses auto-saved to deployments/{network}.json files
- **Production-Ready Infrastructure**: Complete deployment scripts, verification tools, and Base mainnet optimization (0.05 gwei gas)

**Target Networks:** Base (primary - optimized), Ethereum (secondary), with Base Sepolia for testing

**Deployed Contract Suite (22 contracts):**
- **Core Infrastructure**: CommunityRegistry, ParamController
- **Governance System**: ShiftGovernor, TimelockController (OpenZeppelin), CountingMultiChoice, MembershipTokenERC20Votes
- **Work Verification**: VerifierPowerToken1155, VerifierElection, VerifierManager, ValuableActionRegistry, Claims, ValuableActionSBT
- **Economic Layer**: CommunityToken, CohortRegistry, RevenueRouter, TreasuryAdapter
- **Community Modules**: RequestHub, DraftsManager, CommerceDisputes, Marketplace, HousingManager, ProjectFactory

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
- **MembershipTokenERC20Votes**: Pure governance token minted from ValuableAction completion, with vote delegation and anti-plutocracy concentration limits

### Work Verification System

- **ValuableActionRegistry**: Community-configured value definition system where communities define what work is valuable and how it translates into governance power, economic rewards, and reputation
- **VerifierPowerToken1155**: ERC1155 tokens representing verifier power per community, managed through timelock governance
- **VerifierElection**: Governance-controlled verifier set management with power token distribution and slashing capabilities
- **VerifierManager**: M-of-N juror selection from active verifier sets with configurable weighting and fraud reporting
- **Claims**: Work submission and verification workflow with evidence validation and appeals process
- **ValuableActionSBT** (formerly WorkerSBT): Soulbound tokens minted on approved claims with WorkerPoints EMA tracking and governance revocation

### Token Economy & Revenue Distribution

- **CommunityToken**: 1:1 USDC-backed stablecoin for transparent community payments and treasury management
- **RevenueRouter**: ROI-based revenue distribution where investor share automatically decreases as their return approaches target, ensuring sustainable returns
- **Marketplace**: Decentralized service marketplace with quality verification and reputation-based discovery
- **ProjectFactory**: ERC-1155 crowdfunding with milestone validation and investor protection mechanisms

### Community Infrastructure Modules

- **HousingManager**: Co-housing reservations (ERC-1155 per night) with investor staking and worker discounts
- **TreasuryAdapter**: Treasury management with governance-controlled spending limits and emergency procedures

### Community Bootstrap System

- **API-Based Community Creation**: Scalable deployment system that deploys complete communities via Next.js backend, avoiding blockchain size limits
- **CommunityFactory**: Factory pattern for deploying new communities with standardized governance infrastructure (replaced by API system)
- **Founder Verification**: Bootstrap security mechanism allowing founders to create initial ValuableActions without governance approval
- **Initial MembershipToken Distribution**: Founders receive governance tokens during community creation to enable initial decision-making
- **Base Network Deployment**: Ultra-low cost community creation (~$0.19 vs $9,600 on Ethereum mainnet)

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

1. **Base Sepolia** (testnet) - ✅ PRIMARY DEPLOYMENT COMPLETE - Community ID 3 operational
2. **Base** (production) - Main deployment target ready for production launch
3. **Ethereum Sepolia** (testnet) - Secondary target after Base success
4. **Ethereum** (production) - Final deployment after proven on Base

### Current Deployment Status

- **Base Sepolia**: ✅ Community ID 1 deployed with 22 contracts successfully configured
- **Contract Verification**: ✅ All contracts verified on BaseScan
- **Cost Analysis**: ✅ ~$0.19 USD per community deployment confirmed (testnet)
- **API Integration**: ✅ Next.js backend deployment system operational
- **Address Management**: ✅ Automated JSON-based address saving/loading system
- **Base Mainnet Ready**: ✅ Gas optimized (0.05 gwei) for ~$10 production deployment

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
    uint256[3] revenueSplit;     // [workers%, treasury%, investors%] - governance configurable
    uint256 feeOnWithdraw;
    address[] backingAssets;     // Approved collateral tokens

    // Module Addresses
    address governor;
    address timelock;
    address requestHub;
    address draftsManager;
    address claimsManager;
    address valuableActionRegistry;
    address verifierElection;
    address verifierManager;
    address valuableActionSBT;
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
// Requests can spawn bounties by linking ValuableActions
function createBountyRequest(string title, string cid, uint256 valuableActionId, uint256 reward)
// Workers file claims referencing the source request
function submitClaim(uint256 requestId, string evidenceCID) returns (uint256 claimId)
```

#### **DraftsManager ↔ ValuableActionRegistry Integration**:

```solidity
// Drafts can propose new ValuableActions that activate after governance approval
function proposeValuableAction(uint256 draftId, ValuableActionParams params)
// ValuableActions become active only after successful governance vote
function activateValuableAction(uint256 valuableActionId, uint256 approvedProposalId)
```

#### **ValuableActionSBT Influence on Discussion System**:

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

## Verifier Power System (VPS) Architecture

Shift uses a **governance-controlled verifier power system** instead of economic bonding for work verification:

### Core VPS Components

#### **VerifierPowerToken1155**: ERC1155 Verifier Power Tokens

- **Per-Community Power**: Each community has its own verifier power token (community ID as token ID)
- **Timelock Governance**: Only timelock can mint/burn verifier power tokens
- **No Economic Bonding**: Verifiers don't stake tokens - they receive power grants from governance
- **Community Isolation**: Verifier power in Community A doesn't affect Community B

#### **VerifierElection**: Governance-Controlled Verifier Management

- **Timelock Only**: Only timelock can modify verifier sets (no self-bonding or economic staking)
- **Power Distribution**: Mints VPT tokens when adding verifiers, burns when removing
- **Slashing**: Can reduce verifier power for misconduct without economic penalties
- **Democratic Control**: All verifier changes require governance approval

#### **VerifierManager**: M-of-N Juror Selection & Coordination

- **Configurable Selection**: M-of-N parameters set via governance (not economics)
- **Weight-Based Selection**: Uses VPT balances for juror selection probability
- **No Bonding Required**: Jurors selected based on granted power, not staked tokens
- **Fraud Reporting**: Reports bad actors to VerifierElection for governance action

### VPS vs Economic Bonding

**❌ OLD SYSTEM (Don't Implement)**:

- Verifiers bond tokens to participate
- Economic slashing for bad behavior
- Self-service verifier registration
- Token-weighted voting power

**✅ CURRENT VPS SYSTEM**:

- Governance grants verifier power via timelock
- Social reputation and governance accountability
- Democratic verifier set management
- Community-controlled quality standards

### VPS Integration Patterns

```solidity
// Claims verification workflow with VPS
function verifyClaimVPS(uint256 claimId, bool approved) external {
    // 1. VerifierManager validates juror has power for this community
    require(verifierManager.isActiveJuror(msg.sender, claimId), "Not selected juror");

    // 2. Record vote (no bonding/slashing)
    _recordJurorVote(claimId, msg.sender, approved);

    // 3. Check if M-of-N threshold reached
    if (_hasReachedThreshold(claimId)) {
        _finalizeVerification(claimId);
    }
}

// Governance adds verifier (timelock only)
function addVerifier(uint256 communityId, address verifier, uint256 power) external onlyTimelock {
    verifierElection.grantVerifierPower(communityId, verifier, power, "governance-decision");
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
// ValuableAction configuration
struct ValuableAction {
    // Economic Parameters
    uint32 membershipTokenReward;   // MembershipToken amount minted on completion
    uint32 communityTokenReward;    // CommunityToken amount earned for period salary calculation
    uint32 investorSBTReward;      // InvestorSBT minting for investment-type actions

    // Verification Parameters
    uint32 jurorsMin;              // M (minimum approvals needed)
    uint32 panelSize;              // N (total jurors selected)
    uint32 verifyWindow;           // Time limit for jury decision
    uint32 verifierRewardWeight;   // Points earned by accurate verifiers
    uint32 slashVerifierBps;       // Penalty for inaccurate verification

    // Quality Control
    uint32 cooldownPeriod;         // Minimum time between claims of this type
    uint32 maxConcurrent;          // Maximum active claims per person
    bool revocable;                // Can community governance revoke this SBT
    uint32 evidenceTypes;          // Bitmask of required evidence formats

    // Governance Requirements
    uint256 proposalThreshold;     // Governance tokens needed to propose new Valuable Actions
    address proposer;              // Who proposed this Valuable Action
    bool requiresGovernanceApproval; // Whether this action needs community vote to activate

    // Metadata & Automation
    string evidenceSpecCID;        // IPFS: detailed evidence requirements
    string titleTemplate;          // Template for claim titles
    bytes32[] automationRules;     // Integration with external systems (GitHub, etc)

    // Time-Based Parameters
    uint64 activationDelay;        // Governance approval → active period
    uint64 deprecationWarning;     // Time before auto-deactivation
    bool founderVerified;          // Special status for community bootstrapping
}

// Claims workflow: submit → verify (M-of-N) → approve → mint SBT + MembershipTokens
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

### ROI-Based Revenue Distribution

```solidity
// RevenueRouter: Investor revenue share decreases as ROI approaches target
function calculateInvestorShare(address investor) external view returns (uint256) {
    InvestorRevenue memory inv = investorRevenue[investor];

    // Calculate current ROI percentage achieved
    uint256 currentROI = (inv.cumulativeRevenue * 10000) / inv.totalInvested;

    if (currentROI >= inv.targetROI) {
        return 0; // ROI target reached, no more revenue
    }

    // Linear decay: share decreases as ROI approaches target
    uint256 progress = (currentROI * 10000) / inv.targetROI;
    return inv.currentShare * (10000 - progress) / 10000;
}
```

## Development Guidelines

### Code Standards

- **Solidity**: ^0.8.24 with OpenZeppelin 5.x
- **Gas optimization**: 200 optimizer runs, avoid unbounded loops
- **Security**: CEI pattern, reentrancy guards, input validation
- **Documentation**: Complete NatSpec for all public functions

### Verifier Power System (VPS) Guidelines

**CRITICAL**: Use VPS architecture only - DO NOT implement economic bonding/staking patterns:

- **Verifier Management**: Use VerifierElection with timelock governance, not self-bonding
- **Juror Selection**: Use VerifierManager weight-based selection, not economic stakes
- **Power Distribution**: VPT tokens granted by governance, not earned through bonding
- **Quality Control**: Governance accountability and slashing, not economic penalties
- **Integration**: Always use `verifierManager.isActiveJuror()` for authorization

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

For major new features, update `/docs/EN/Whitepaper.md` to include:

- **Business value proposition** of the new functionality
- **Market impact** and competitive advantages
- **Revenue implications** and monetization opportunities
- **Use case scenarios** with real-world examples
- **Investment considerations** and risk assessment

#### Architecture Documentation Updates

Update `/docs/EN/Architecture.md` to reflect:

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

## Development Status & Implementation Phases

### ✅ COMPLETED PHASES (Production Ready)

#### **Phase 1: Community Coordination Layer ✅ COMPLETE**

1. ✅ **CommunityRegistry**: Complete community metadata, parameters, module addresses, and role management
2. ✅ **RequestHub**: Full discussion forum with commenting, moderation, tagging, and spam prevention
3. ✅ **DraftsManager**: Multi-contributor proposal development with versioning and review cycles
4. ✅ **API-Based Community Creation**: Scalable deployment system replacing oversized factory contracts
5. ✅ **Integration workflows**: RequestHub → Claims bounties, DraftsManager → ValuableAction proposals

#### **Phase 2: Core Governance ✅ COMPLETE**

1. ✅ **CountingMultiChoice**: Complete with weight snapshots, events, and enterprise-grade features
2. ✅ **ShiftGovernor**: Full hooks and multi-choice integration with timelock
3. ✅ **UI Integration**: Comprehensive getters for frontend integration
4. ✅ **DraftsManager Integration**: Seamless draft → proposal escalation

#### **Phase 3: Verification System ✅ COMPLETE**

1. ✅ **ValuableActionRegistry**: Complete with configurable verification parameters and governance integration
2. ✅ **VerifierPowerToken1155**: ERC1155 verifier power tokens with timelock governance and community isolation
3. ✅ **VerifierElection**: Governance-controlled verifier set management with power distribution and slashing
4. ✅ **VerifierManager**: M-of-N juror selection with configurable parameters and fraud reporting integration
5. ✅ **Claims**: Complete end-to-end workflow with VPS integration, appeal windows, and RequestHub integration
6. ✅ **ValuableActionSBT**: WorkerPoints EMA tracking, discussion privileges, and governance integration

#### **Phase 4: Economic Modules ✅ COMPLETE**

1. ✅ **CommunityToken**: 1:1 USDC backing with treasury management
2. ✅ **RevenueRouter**: ROI-based revenue decay with mathematical distribution
3. ✅ **MembershipTokenERC20Votes**: Pure merit-based governance token
4. ✅ **TreasuryAdapter**: CommunityRegistry parameter integration

#### **Phase 5: Deployment & Testing ✅ COMPLETE**

1. ✅ **API deployment scripts**: Complete Next.js backend system with automated address management
2. ✅ **On-chain testing**: Real deployments on Base Sepolia verified
3. ✅ **Test coverage**: Comprehensive test suite with CI/CD (≥86% coverage enforced)
4. ✅ **Base Sepolia deployment**: Community ID 1 operational with all 22 contracts configured
5. ✅ **Automated address management**: deployments/{network}.json system with auto-loading
6. ✅ **Base mainnet optimization**: Gas settings optimized (0.05 gwei for ~$10 deployment cost)
7. ✅ **Comprehensive documentation**: 21 contracts fully documented in /docs/EN/contracts/

#### **Phase 6: Community Modules ✅ COMPLETE**

1. ✅ **Marketplace**: Service marketplace with quality verification and dispute integration
2. ✅ **ProjectFactory**: ERC-1155 crowdfunding with milestone validation
3. ✅ **HousingManager**: Co-housing reservations with investor staking and worker discounts
4. ✅ **CommerceDisputes**: Dedicated dispute resolution for commercial transactions
5. ✅ **CohortRegistry**: Investment cohort management with Target ROI tracking

### 🚀 CURRENT PHASE: Production Launch & Ecosystem Growth

**Immediate Next Steps:**

1. **Base Mainnet Deployment**: Production launch with optimized gas settings
2. **Community Onboarding**: First 5-10 pilot communities
3. **Frontend Polish**: User experience optimization for non-technical users
4. **Mobile App Launch**: React Native app with production API integration

**Q1 2026 Roadmap:**

1. **Cross-Community Features**: Reputation portability and federation mechanisms
2. **Advanced Governance**: Multi-stakeholder voting enhancements
3. **Economic Optimization**: Dynamic revenue distribution based on performance metrics
4. **Verifier Democracy**: Enhanced VPT election system with term limits and accountability

## Quick Start Commands

```bash
# Setup and test
pnpm install
pnpm build                    # Compile both toolchains
pnpm forge:test              # Run Foundry tests
pnpm cov:gate                # Check coverage (≥86% enforced)

# Deploy complete system to testnet
pnpm -C packages/hardhat hardhat run scripts/deploy-complete.ts --network base_sepolia

# Verify deployment addresses
pnpm verify:addresses

# Manage deployed system
pnpm manage:system --network base_sepolia

# Format code
pnpm fmt
```

## Deployment Infrastructure

### API-Based Community Creation

Shift uses an **API-based deployment system** avoiding blockchain size limits:

```typescript
// Backend deploys complete 22-contract suite
POST /api/communities/deploy
{
  "communityName": "New Community",
  "founderAddress": "0x...",
  "network": "base_sepolia"
}

// Addresses auto-saved to deployments/{network}.json
```

### Automated Address Management

```bash
# Deployment automatically saves addresses
deployments/base_sepolia.json      # Network-specific
deployments/latest.json            # Most recent

# Scripts auto-load from JSON (no manual configuration needed)
pnpm manage:system --network base_sepolia
```

**Benefits:**
- **Cost**: ~$0.19 on Base Sepolia, ~$10 on Base mainnet
- **No Size Limits**: Independent deployments avoid contract size constraints
- **Automatic Config**: Addresses saved/loaded automatically
- **Network Flexible**: Works across Base, Ethereum, and testnets

Focus on building robust, well-tested contracts that form the foundation of decentralized community governance and work verification.
