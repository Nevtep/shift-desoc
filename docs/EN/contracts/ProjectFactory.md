# ProjectFactory Contract

## 🎯 Purpose & Role

The ProjectFactory contract enables **decentralized project creation and crowdfunding** within Shift DeSoc communities. It provides infrastructure for launching community projects, managing ERC-1155 crowdfunding campaigns, and coordinating milestone-based development with investor protection mechanisms.

## 🏗️ Core Architecture

### Project Management Structure

```solidity
struct Project { 
    address creator;             // Project initiator
    string cid;                 // IPFS content identifier
    address token1155;          // ERC-1155 crowdfunding token
    bool active;                // Project status
}

mapping(uint256 => Project) public projects;
uint256 public lastId;
```

**Current Design**: The contract implements a minimal viable project registry with basic IPFS metadata linking and ERC-1155 token association for future crowdfunding integration.

## ⚙️ Key Functions & Logic

### Project Creation

```solidity
function create(string calldata cid, address token1155) 
    external returns (uint256 id) {
    
    id = ++lastId; 
    projects[id] = Project(msg.sender, cid, token1155, true);
    
    emit ProjectCreated(id, msg.sender, cid, token1155);
}
```

**Current Functionality**:
- ✅ Project registration with IPFS metadata
- ✅ ERC-1155 token association for crowdfunding
- ✅ Creator attribution and project tracking
- ✅ Unique project ID generation

**Missing Functionality** (Planned for Future Enhancement):
- ❌ Milestone management and validation
- ❌ Crowdfunding mechanics and investor protection
- ❌ Progress tracking and reporting systems
- ❌ Revenue distribution to investors

## 🛡️ Security Features

### Access Control
- **Creator Attribution**: Each project is permanently linked to its creator
- **Project Status**: Active/inactive status prevents unauthorized modifications
- **Immutable Records**: Project creation records are permanent on-chain

### Data Integrity
- **IPFS Integration**: Decentralized metadata storage prevents censorship
- **Event Logging**: Complete audit trail of project creation and updates
- **Token Association**: Clear linking between projects and their funding mechanisms

## 🔗 Integration Points

### IPFS Metadata Structure

```json
{
  "name": "Community Solar Project",
  "description": "Installing solar panels for community energy independence",
  "category": "Infrastructure",
  "fundingGoal": "50000",
  "timeline": "6 months", 
  "milestones": [
    {
      "name": "Planning and Permits",
      "description": "Obtain necessary permits and finalize installation plan",
      "funding": "10000",
      "duration": "1 month"
    },
    {
      "name": "Equipment Procurement", 
      "description": "Purchase solar panels and installation equipment",
      "funding": "30000",
      "duration": "2 months"
    },
    {
      "name": "Installation and Testing",
      "description": "Install panels and test system functionality", 
      "funding": "10000",
      "duration": "3 months"
    }
  ],
  "team": [
    {
      "role": "Project Manager",
      "address": "0x...",
      "experience": "5 years renewable energy projects"
    }
  ],
  "images": ["QmHash1...", "QmHash2..."],
  "documents": ["QmHash3..."]
}
```

### ERC-1155 Crowdfunding Integration

```solidity
// Planned integration with ERC-1155 crowdfunding tokens
interface IProjectToken {
    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
}

// Example: Milestone-based funding
// Token ID 1: Funding for Milestone 1 (Planning)
// Token ID 2: Funding for Milestone 2 (Equipment) 
// Token ID 3: Funding for Milestone 3 (Installation)
```

### CommunityToken Integration

```solidity
// Projects can accept community tokens for funding
function fundProject(uint256 projectId, uint256 milestoneId, uint256 amount) external {
    // Transfer community tokens to project escrow
    // Mint corresponding ERC-1155 investor tokens
    // Update project funding status
}
```

## 📊 Use Case Flows

### 1. Community Infrastructure Project Flow

```
Community Need Identified → Project Proposal Created →
IPFS Metadata Published → ProjectFactory.create() →
ERC-1155 Crowdfunding Launch → Milestone Funding →
Progress Validation → Completion & Revenue Distribution
```

### 2. Collaborative Product Development Flow

```
Product Idea → Team Formation → Project Registration →
Crowdfunding Campaign → Development Milestones →
Product Launch → Revenue Sharing with Backers
```

### 3. Research and Development Flow

```
Research Proposal → Community Review → Project Creation →
Milestone-Based Funding → Research Execution →
Results Publication → IP Management
```

## 🎛️ Configuration Examples

### Infrastructure Project Setup

```solidity
// Community solar installation project
string memory cid = "QmSolarProjectMetadata...";
address token1155 = deployCrowdfundingToken(
    "Community Solar Crowdfunding",
    "SOLAR",
    3  // 3 milestones
);

uint256 projectId = projectFactory.create(cid, token1155);
```

### Product Development Project

```solidity
// Community mobile app development
string memory cid = "QmMobileAppProject...";
address token1155 = deployCrowdfundingToken(
    "Community App Crowdfunding", 
    "APP",
    4  // 4 development phases
);

uint256 projectId = projectFactory.create(cid, token1155);
```

## 🚀 Planned Enhancements

### Milestone Management System

```solidity
// Planned: Advanced milestone tracking
struct Milestone {
    string name;
    string description;
    uint256 fundingRequired;
    uint256 fundingReceived;
    uint256 deadline;
    bool completed;
    bool validated;
    address[] validators;
    uint256 validationThreshold;
}

mapping(uint256 => mapping(uint256 => Milestone)) public projectMilestones;
```

### Investor Protection Mechanisms

```solidity
// Planned: Refund and dispute resolution
struct InvestorProtection {
    uint256 refundWindow;        // Time limit for refund requests
    uint256 disputeThreshold;    // Percentage of investors needed for dispute
    address arbitrator;          // Community governance or third party
    uint256 escrowReleaseDelay;  // Delay before milestone funding release
}
```

### Revenue Distribution System

```solidity
// Planned: Project revenue sharing
function distributeProjectRevenue(uint256 projectId, uint256 revenue) external {
    // Distribute revenue proportionally to ERC-1155 token holders
    // Account for different milestone contribution levels
    // Handle creator rewards and community treasury share
}
```

### Cross-Community Project Federation

```solidity
// Planned: Multi-community project collaboration
struct FederatedProject {
    uint256[] participatingCommunities;
    mapping(uint256 => uint256) communityContributions;
    mapping(uint256 => uint256) communityRevenueShares;
}
```

## 💡 Innovation Opportunities

### Decentralized Venture Capital
- Community-driven project evaluation and funding
- Reputation-based project creator verification
- Cross-community investment syndication

### Sustainable Development Focus
- Carbon footprint tracking for funded projects
- Environmental impact assessment requirements
- Renewable energy and sustainability project prioritization

### Open Source Integration
- Mandatory open source requirements for community-funded projects
- IP sharing models for collaborative development
- Community ownership of project outcomes

### Integration with Work Verification System

```solidity
// Link project work to ValuableAction completion
function validateMilestoneWork(uint256 projectId, uint256 milestoneId, uint256[] calldata claimIds) external {
    // Validate that required work claims have been approved
    // Release milestone funding based on verified work completion
    // Mint WorkerSBT tokens for project contributors
}
```

## 📈 Economic Model

### Funding Flow
1. **Community Investment**: Members fund projects with community tokens
2. **Milestone Release**: Funds released upon milestone completion validation  
3. **Revenue Distribution**: Project income shared with investors proportionally
4. **Community Treasury**: Percentage of project success flows to treasury

### Risk Management
- **Escrow System**: Funds held until milestone validation
- **Community Oversight**: Governance can intervene in disputed projects
- **Refund Mechanisms**: Investor protection for failed or abandoned projects

### Success Incentives
- **Creator Rewards**: Project creators receive success bonuses
- **Community Benefits**: Successful projects enhance community reputation
- **Reinvestment Cycle**: Project profits fund future community initiatives

---

The ProjectFactory contract establishes the foundation for **community-driven innovation and development**, enabling transparent, milestone-based project funding while maintaining investor protection and community oversight. Its integration with the broader Shift DeSoc ecosystem creates sustainable incentive alignment between project creators, community investors, and long-term community development goals.