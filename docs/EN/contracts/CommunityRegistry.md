# CommunityRegistry Contract

## 🎯 Purpose & Role

The **CommunityRegistry** serves as the single source of truth for community metadata, governance parameters, module addresses, and cross-community relationships in the Shift DeSoc ecosystem. It acts as the central coordination hub that enables communities to configure their governance systems, manage their organizational structure, and establish relationships with other communities.

## 🏗️ Core Architecture  

### Data Structures

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
    
    // Status and Relationships
    CommunityStatus status;
    uint256 parentCommunityId;   // Federation/hierarchy support
    uint256[] allyCommunityIds;  // Partnership relationships
}
```

### State Management

- **Community Storage**: Mapping from community ID to Community struct
- **Role Management**: Hierarchical access control with community-specific roles
- **Parameter Validation**: Enforced constraints on governance and economic parameters
- **Relationship Tracking**: Parent-child hierarchies and alliance networks

## ⚙️ Key Functions & Logic

### Community Registration

```solidity
function registerCommunity(CommunityParams calldata params) 
    external returns (uint256 communityId)
```

**Purpose**: Creates a new community with initial parameters and governance structure.

**Key Logic**:
- Validates community name uniqueness and parameter constraints
- Assigns sequential community ID and sets default governance parameters  
- Establishes initial admin role for the registrant
- Enables parent-child relationships for community federations
- Emits `CommunityRegistered` event for indexing

### Parameter Management

```solidity
function updateParameters(uint256 communityId, ParameterUpdate[] calldata updates) 
    external onlyAdmin(communityId)
```

**Purpose**: Allows community admins to modify governance and economic parameters.

**Supported Parameters**:
- **Governance Timing**: `debateWindow`, `voteWindow`, `executionDelay`
- **Eligibility Rules**: `minSeniority`, `minSBTs`, `proposalThreshold`  
- **Economic Splits**: `revenueSplit` ratios, `feeOnWithdraw`
- **Asset Management**: `backingAssets` whitelist

**Validation Logic**:
- Revenue splits must sum to 100%
- Time windows must be within reasonable bounds (1 hour to 30 days)
- Fee rates cannot exceed 10%
- Asset addresses must be valid ERC-20 contracts

### Module Address Management

```solidity
function setModuleAddress(uint256 communityId, bytes32 moduleKey, address moduleAddress) 
    external onlyAdmin(communityId)
```

**Purpose**: Links community to its governance and operational contract instances.

**Supported Modules**:
- Core governance: `governor`, `timelock`, `requestHub`, `draftsManager`
- Work verification: `claimsManager`, `actionTypeRegistry`, `verifierPool`, `workerSBT`
- Treasury management: `treasuryAdapter`

### Role Management

```solidity
function grantCommunityRole(uint256 communityId, address user, bytes32 role) 
    external onlyAdmin(communityId)
```

**Role Hierarchy**:
- **ADMIN_ROLE**: Full community management permissions
- **MODERATOR_ROLE**: Content moderation in RequestHub and discussions
- **CURATOR_ROLE**: ActionType management and verification oversight

## 🛡️ Security Features

### Access Control Matrix

```solidity
// Community-specific role checks
modifier onlyAdmin(uint256 communityId) {
    require(
        hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
        hasRole(communityAdmins[communityId], msg.sender),
        "Not authorized"
    );
}

// Cross-community relationship validation
modifier validAlliance(uint256 communityId, uint256 allyCommunityId) {
    require(communities[communityId].status == CommunityStatus.Active, "Community not active");
    require(communities[allyCommunityId].status == CommunityStatus.Active, "Ally not active");
    require(communityId != allyCommunityId, "Cannot ally with self");
}
```

### Parameter Validation

- **Economic Constraints**: Revenue splits validated to sum exactly to 100%
- **Timing Bounds**: Governance windows must be between 1 hour and 30 days
- **Address Validation**: Module addresses checked for contract existence
- **Circular Reference Prevention**: Parent-child relationships cannot form cycles

### Emergency Controls

```solidity
function setCommunityStatus(uint256 communityId, CommunityStatus status) 
    external onlyRole(DEFAULT_ADMIN_ROLE)
```

**Global admin can**:
- Suspend communities for governance violations
- Deactivate malicious or abandoned communities  
- Restore communities after dispute resolution
- Enforce protocol-wide policy changes

## 🔗 Integration Points

### With Governance Contracts

```solidity
// ShiftGovernor queries community parameters
CommunityRegistry registry = CommunityRegistry(communityRegistryAddress);
(uint256 debateWindow, uint256 voteWindow, uint256 executionDelay) = 
    registry.getGovernanceParameters(communityId);
```

### With RequestHub & DraftsManager

```solidity
// Access control checks
require(
    registry.hasRole(communityId, msg.sender, MODERATOR_ROLE),
    "Not authorized to moderate"
);
```

### With Economic Modules

```solidity
// Revenue distribution configuration
uint256[3] memory splits = registry.getEconomicParameters(communityId).revenueSplit;
// Apply splits: workers, treasury, investors
```

## 📊 Economic Model

### Revenue Split Configuration

Communities can configure three-way revenue distribution:

```solidity
struct EconomicParameters {
    uint256[3] revenueSplit;  // [workers%, treasury%, investors%] basis points (must sum to 10000)
    uint256 feeOnWithdraw;    // Withdrawal fee in basis points (max 1000 = 10%)
    address[] backingAssets;  // Whitelisted collateral tokens
}
```

**Default Configuration**:
- Workers: 70% (7000 bp) - Rewards for verified work
- Treasury: 20% (2000 bp) - Community development fund
- Investors: 10% (1000 bp) - Return for community supporters

### Fee Structure

- **Withdrawal Fees**: 0-10% configurable fee on treasury withdrawals
- **Gas Subsidies**: Communities can subsidize transaction costs for members
- **Cross-Community Transfers**: Reduced fees for allied communities

## 🎛️ Configuration Examples

### Basic Community Setup

```solidity
CommunityParams memory params = CommunityParams({
    name: "DeveloperDAO",
    description: "Decentralized community for Web3 developers",
    metadataURI: "ipfs://QmCommunityMetadata...",
    
    // Standard governance timing
    debateWindow: 3 days,
    voteWindow: 7 days,
    executionDelay: 2 days,
    
    // Member eligibility
    minSeniority: 30 days,
    minSBTs: 1,
    proposalThreshold: 100e18, // 100 governance tokens
    
    // Revenue allocation
    revenueSplit: [7000, 2000, 1000], // 70% workers, 20% treasury, 10% investors
    feeOnWithdraw: 250, // 2.5% withdrawal fee
    backingAssets: [USDC_ADDRESS, DAI_ADDRESS], // Accept stablecoins
    
    // No parent community
    parentCommunityId: 0
});

uint256 communityId = registry.registerCommunity(params);
```

### Federation Setup

```solidity
// Parent community (e.g., "DeSoc Ecosystem")
uint256 parentId = registry.registerCommunity(parentParams);

// Child community inherits some parent policies
CommunityParams memory childParams = baseParams;
childParams.parentCommunityId = parentId;
childParams.name = "DeSoc - Developer Chapter";

uint256 childId = registry.registerCommunity(childParams);

// Establish alliance between peer communities  
registry.formAlliance(childId, anotherCommunityId);
```

### Parameter Updates

```solidity
// Adjust governance timing after launch
ParameterUpdate[] memory updates = new ParameterUpdate[](2);
updates[0] = ParameterUpdate({
    key: "voteWindow",
    value: abi.encode(5 days) // Reduce from 7 to 5 days
});
updates[1] = ParameterUpdate({
    key: "revenueSplit", 
    value: abi.encode([6500, 2500, 1000]) // Increase treasury allocation
});

registry.updateParameters(communityId, updates);
```

## 🚀 Advanced Features

### Community Federation

**Hierarchical Governance**:
- Child communities can inherit policies from parents
- Parent communities can set binding constraints on children
- Federal voting can affect multiple communities simultaneously

**Alliance Networks**:
- Peer communities can form alliances for resource sharing
- Alliance members get preferential treatment in cross-community work
- Shared dispute resolution and reputation systems

### Dynamic Parameter Adjustment

**Governance Evolution**:
- Communities can adapt their governance as they mature
- Parameter changes require community approval through governance
- Emergency overrides for protocol security

**Economic Adaptation**:
- Revenue splits can be adjusted based on community needs  
- Fee structures can incentivize desired behaviors
- Asset backing can be expanded to support growth

### Cross-Community Workflows

**Federated Governance**:
- Proposals can affect multiple communities in a federation
- Cross-community reputation and work verification
- Shared treasury and resource pools

**Alliance Benefits**:
- Reduced transaction fees between allied communities
- Shared ActionType libraries and verification pools
- Collaborative project funding and execution

## 📈 Scaling Considerations

### Storage Optimization

- Community data packed efficiently to minimize gas costs
- Lazy loading of module addresses and relationships
- Event-driven architecture for off-chain indexing

### Gas Efficiency

- Batch operations for parameter updates and role management
- Minimal on-chain storage with IPFS references for metadata
- Optimized access control checks with role hierarchies

### Network Effects

- Registry becomes more valuable as more communities join
- Shared infrastructure reduces costs for all participants
- Alliance networks create positive feedback loops for growth

The CommunityRegistry forms the foundational layer that enables the entire Shift DeSoc ecosystem to scale while maintaining decentralization and community autonomy.