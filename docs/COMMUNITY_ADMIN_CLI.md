# Community Admin CLI Guide

**Purpose**: Complete lifecycle management for Shift DeSoc communities including creation, role grants, parameter configuration, and timelock administration.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Commands Reference](#commands-reference)
- [Usage Examples](#usage-examples)
- [Multi-Tenant Architecture](#multi-tenant-architecture)
- [Common Workflows](#common-workflows)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Environment Setup

Create/update `.env` file in project root:

```bash
# Required: Deployer private key (will be community founder/admin)
PRIVATE_KEY=0x...

# Required: Network RPC endpoints
RPC_BASE_SEPOLIA=https://sepolia.base.org
RPC_BASE=https://mainnet.base.org
RPC_SEPOLIA=https://ethereum-sepolia.rpc.com
RPC_MAINNET=https://ethereum.rpc.com

# Optional: Address overrides (CLI prefers deployments/<network>.json)
COMMUNITY_REGISTRY_ADDRESS=0x...
PARAM_CONTROLLER_ADDRESS=0x...
```

### 2. Deployed System

The admin CLI manages **multi-tenant** contracts already deployed on the network. Ensure you have:

- ✅ Complete system deployment on target network (Base Sepolia, Base, etc.)
- ✅ `deployments/<network>.json` file with contract addresses
- ✅ Deployer key with sufficient ETH for gas

**Check deployment status:**

```bash
HARDHAT_NETWORK=base_sepolia pnpm verify:addresses
```

### 3. Governance Authority

**IMPORTANT**: To set parameters, the deployer must be:
- **ParamController governance address** (for `set-params` commands), OR
- **CommunityRegistry DEFAULT_ADMIN_ROLE holder** (for `grant-role` commands)

Verify with:
```bash
# Check ParamController governance
cast call <PARAM_CONTROLLER_ADDRESS> "governance()(address)" --rpc-url <RPC_URL>
```

---

## Quick Start

### Using Package Scripts with Environment Variables (Recommended)

Due to Hardhat's argument handling limitations, use environment variables for parameters (all commands still accept positional args as a fallback):

```bash
# Grant moderator role (for RequestHub/Drafts moderation)
HARDHAT_NETWORK=base_sepolia \
  COMMUNITY_ID=1 \
  COMMUNITY_ROLE=moderator \
  COMMUNITY_USER=0x73af48d53f75827dB195189e6FeBaB726dF7D0e2 \
  pnpm admin:grant-role

# Create a new community
HARDHAT_NETWORK=base_sepolia \
  COMMUNITY_NAME="Pioneers DAO" \
  COMMUNITY_DESCRIPTION="First community" \
  COMMUNITY_METADATA_URI="ipfs://QmXYZ" \
  COMMUNITY_PARENT_ID=0 \
  pnpm admin:create

# Set governance parameters (use JSON for complex params)
HARDHAT_NETWORK=base_sepolia \
  COMMUNITY_ID=1 \
  GOVERNANCE_DEBATE_WINDOW=86400 \
  GOVERNANCE_VOTE_WINDOW=259200 \
  GOVERNANCE_EXECUTION_DELAY=86400 \
  pnpm admin:set-params

# Grant timelock roles to governor for execution
HARDHAT_NETWORK=base_sepolia \
  TIMELOCK_SUB=grant \
  TIMELOCK_ROLE=proposer \
  TIMELOCK_TARGET=0xGOVERNOR_ADDRESS \
  pnpm admin:timelock
```

### Direct CLI Usage (Alternative)

For interactive use, you can call the script directly with arguments:

```bash
# Full command syntax with positional arguments
HARDHAT_NETWORK=base_sepolia npx hardhat run scripts/manage-communities.ts -- grant-role 1 moderator 0x73af...

# Using the admin shortcut
HARDHAT_NETWORK=base_sepolia pnpm admin -- grant-role 1 moderator 0x73af...
```

---

## Commands Reference

### 1. Create Community

**Create a new community and register module addresses**

```bash
pnpm admin:create <name> <description> <metadataURI> [parentId]
```

**Arguments:**
- `name` - Community display name (e.g., "Pioneers DAO")
- `description` - Community description
- `metadataURI` - IPFS URI for additional metadata (e.g., "ipfs://QmHash...")
- `parentId` - (Optional) Parent community ID for nested communities (default: 0 = root)

**What it does:**
1. Registers community in CommunityRegistry
2. Grants deployer address community admin role
3. Sets all module addresses from deployments/<network>.json
4. Returns new community ID

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm admin:create \
  "Shift Pioneers" \
  "First pilot community on Shift DeSoc" \
  "ipfs://QmPioneersCommunityMetadata" \
  0
```

**Output:**
```
🏠 Creating community 'Shift Pioneers' on base_sepolia
✅ Community registered with ID 2
🔗 Setting module addresses...
✅ Module addresses set
👑 Founder/admin: 0xYourAddress
```

---

### 2. Grant Community Roles

**Grant moderator or curator roles for community management**

```bash
pnpm admin:grant-role <communityId> <role> <address>
```

**Arguments:**
- `communityId` - Community ID (1, 2, 3...)
- `role` - Role to grant: `moderator` | `curator`
- `address` - Ethereum address to receive the role

**Roles:**
- **`moderator`** - Can freeze/archive RequestHub posts and DraftsManager discussions
- **`curator`** - Can manage community content and metadata

**Example:**
```bash
# Grant moderator role for managing discussions
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 2 moderator 0xAbc123...

# Grant curator role for content management
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 2 curator 0xDef456...
```

---

### 3. Set Parameters

**Configure community parameters via ParamController**

#### 3a. Governance Parameters

```bash
pnpm admin:set-params governance <communityId> <debateWindow> <voteWindow> <executionDelay>
```

**Arguments:**
- `debateWindow` - Proposal debate period in seconds (e.g., 86400 = 1 day)
- `voteWindow` - Voting period in seconds (e.g., 259200 = 3 days)
- `executionDelay` - Timelock delay before execution in seconds (e.g., 86400 = 1 day)

**Example:**
```bash
# 1 day debate, 3 days voting, 1 day execution delay
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params governance 2 86400 259200 86400
```

#### 3b. Eligibility Parameters

```bash
pnpm admin:set-params eligibility <communityId> <minSeniority> <minSBTs> <proposalThresholdWei>
```

**Arguments:**
- `minSeniority` - Minimum account age in seconds (0 = no restriction)
- `minSBTs` - Minimum ValuableActionSBT count required (0 = no restriction)
- `proposalThresholdWei` - Minimum MembershipTokens to create proposal (in wei)

**Example:**
```bash
# No age/SBT restrictions, 100 tokens to propose
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params eligibility 2 0 0 100000000000000000000
```

#### 3c. Revenue Policy

```bash
pnpm admin:set-params revenue <communityId> <workersBps> <treasuryBps> <investorsBps> <spilloverTarget>
```

**Arguments:**
- `workersBps` - Workers share in basis points (2500 = 25%)
- `treasuryBps` - Treasury share in basis points (2500 = 25%)
- `investorsBps` - Investors share in basis points (5000 = 50%)
- `spilloverTarget` - Where excess goes: `0` = workers, `1` = treasury

**Constraint:** Must sum to 10000 (100%)

**Example:**
```bash
# 40% workers, 30% treasury, 30% investors, spillover to workers
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params revenue 2 4000 3000 3000 0
```

#### 3d. Verifier Parameters (VPT System)

```bash
pnpm admin:set-params verifier <communityId> <panelSize> <minApprovals> <maxPanels> <useWeighting> <maxWeight> <cooldown>
```

**Arguments:**
- `panelSize` - Number of verifiers selected per claim (3-9 recommended)
- `minApprovals` - M-of-N minimum approvals needed (e.g., 3 of 5)
- `maxPanels` - Maximum concurrent verification panels
- `useWeighting` - Use VPT amounts as weights: `true` | `false`
- `maxWeight` - Maximum weight per verifier
- `cooldown` - Fraud cooldown period in seconds

**Example:**
```bash
# 5 verifiers, need 3 approvals, max 20 panels, weighted, 1 day cooldown
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params verifier 2 5 3 20 true 1000 86400
```

---

### 4. Timelock Role Management

**Grant or renounce TimelockController roles**

```bash
# Grant role
pnpm admin:timelock grant <role> [address]

# Renounce role
pnpm admin:timelock renounce <role>
```

**Roles:**
- `proposer` - Can queue governance proposals in timelock
- `executor` - Can execute queued proposals after delay
- `canceller` - Can cancel queued proposals
- `admin` - Can manage timelock roles (dangerous - should be renounced after setup)

**Arguments:**
- `role` - Role name (see above)
- `address` - (Optional for grant) Target address (defaults to deployer)

**Examples:**
```bash
# Grant proposer/executor/canceller to governor contract
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant proposer 0xGOVERNOR_ADDRESS
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant executor 0xGOVERNOR_ADDRESS
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant canceller 0xGOVERNOR_ADDRESS

# Renounce admin role after setup (recommended for decentralization)
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock renounce admin
```

---

## Multi-Tenant Architecture

### What Does NOT Need Per-Community Deployment

The following contracts are **shared across all communities** (keyed by `communityId`):

✅ CommunityRegistry  
✅ ParamController  
✅ ShiftGovernor (shared, but each community gets its own governance instance via ID)  
✅ CountingMultiChoice  
✅ RequestHub  
✅ DraftsManager  
✅ ValuableActionRegistry  
✅ VerifierPowerToken1155 (ERC1155 with communityId as tokenId)  
✅ VerifierElection  
✅ VerifierManager  
✅ Claims  
✅ ValuableActionSBT  
✅ RevenueRouter  
✅ TreasuryAdapter  
✅ Marketplace  
✅ HousingManager  
✅ ProjectFactory  

### What DOES Need Per-Community Deployment

❗ **CommunityToken** - Each community gets its own 1:1 USDC-backed stablecoin

**Deployment steps for CommunityToken:**

```solidity
// Example: Deploy CommunityToken for community ID 2
const CommunityToken = await ethers.getContractFactory("CommunityToken");
const communityToken = await CommunityToken.deploy(
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC Base Sepolia
  2,                                              // communityId
  "Pioneers Community Token",                     // name
  "PCT",                                          // symbol
  treasuryAddress,                                // treasury
  ethers.parseEther("1000000"),                  // maxSupply
  paramControllerAddress                          // paramController
);

// Then set in CommunityRegistry
await registry.setModuleAddress(
  2,
  ethers.keccak256(ethers.toUtf8Bytes("communityToken")),
  await communityToken.getAddress()
);
```

**Note:** The current admin CLI assumes CommunityToken exists in deployments/<network>.json. You must deploy it manually first, then update the JSON or extend the CLI.

---

## Common Workflows

### Workflow 1: Bootstrap New Community from Scratch

```bash
# Step 1: Create community (auto-sets deployer as admin)
HARDHAT_NETWORK=base_sepolia pnpm admin:create \
  "New DAO" \
  "Community description" \
  "ipfs://QmMetadata" \
  0

# Output shows: Community ID 2

# Step 2: Deploy CommunityToken for this community (manual script or deployment)
# [See Multi-Tenant Architecture section above]

# Step 3: Set governance parameters
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params governance 2 86400 259200 86400

# Step 4: Set eligibility rules
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params eligibility 2 0 0 100000000000000000000

# Step 5: Set revenue policy
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params revenue 2 4000 3000 3000 0

# Step 6: Set verifier parameters
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params verifier 2 5 3 20 true 1000 86400

# Step 7: Grant timelock roles to governor
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant proposer 0xGOVERNOR
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant executor 0xGOVERNOR
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant canceller 0xGOVERNOR

# Step 8: Grant moderator roles to community managers
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 2 moderator 0xMODERATOR_1
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 2 moderator 0xMODERATOR_2

# Step 9: (Optional) Renounce timelock admin for decentralization
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock renounce admin
```

### Workflow 2: Update Existing Community Parameters

```bash
# Adjust governance timing for faster decisions
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params governance 1 43200 172800 43200

# Update revenue split to favor workers more
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params revenue 1 5000 2500 2500 0

# Increase verifier panel size for better security
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params verifier 1 7 5 20 true 1000 86400
```

### Workflow 3: Delegate Community Moderation

```bash
# Grant moderator to multiple addresses
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 1 moderator 0xMod1
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 1 moderator 0xMod2
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 1 moderator 0xMod3

# Grant curator for content management
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 1 curator 0xCurator
```

---

## Troubleshooting

### Error: "No deployment addresses found"

**Cause:** Missing or invalid `deployments/<network>.json` file

**Fix:**
```bash
# Verify deployment file exists
ls deployments/base_sepolia.json

# If missing, redeploy system or copy from latest.json
cp deployments/latest.json deployments/base_sepolia.json
```

### Error: "NotAuthorized" when setting parameters

**Cause:** Deployer is not ParamController governance address

**Fix:**
```bash
# Check current governance
cast call <PARAM_CONTROLLER> "governance()(address)" --rpc-url <RPC_URL>

# Update governance (requires current governance to sign)
cast send <PARAM_CONTROLLER> "updateGovernance(address)" <NEW_GOV> \
  --private-key $PRIVATE_KEY \
  --rpc-url <RPC_URL>
```

### Error: "Missing address for X"

**Cause:** Required contract address missing from deployments JSON

**Fix:**
```bash
# Manually add missing address to deployments/<network>.json
# Or set environment variable override
export TIMELOCK_ADDRESS=0x...
```

### Error: "Revenue split must sum to 10000 bps"

**Cause:** Revenue parameters don't add up to 100%

**Fix:**
```bash
# Ensure workers + treasury + investors = 10000
# Example: 40% + 30% + 30% = 100%
pnpm admin:set-params revenue 2 4000 3000 3000 0
```

### Error: "Insufficient funds for gas"

**Cause:** Deployer address has insufficient ETH

**Fix:**
```bash
# Check balance
cast balance <DEPLOYER_ADDRESS> --rpc-url <RPC_URL>

# Fund from faucet (testnet) or transfer ETH (mainnet)
# Base Sepolia faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
```

---

## Network-Specific Notes

### Base Sepolia (Testnet)

- **RPC:** https://sepolia.base.org
- **USDC:** 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- **Block Explorer:** https://sepolia.basescan.org
- **Faucet:** https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

### Base (Mainnet)

- **RPC:** https://mainnet.base.org
- **USDC:** 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- **Block Explorer:** https://basescan.org
- **Gas Optimization:** 0.05 gwei for production (~$10 deployment cost vs $9,600 on Ethereum)

### Ethereum Sepolia (Testnet)

- **RPC:** https://ethereum-sepolia.rpc.com
- **USDC:** 0xA0b86a33E6417547e65D22763FB8ce30cCDbdC79
- **Block Explorer:** https://sepolia.etherscan.io

### Ethereum (Mainnet)

- **RPC:** https://ethereum.rpc.com
- **USDC:** 0xA0b86a33E6417547e65D22763FB8ce30cCDbdC79
- **Block Explorer:** https://etherscan.io

---

## Advanced Usage

### Using Environment Variable Overrides

For one-off operations without updating deployments JSON:

```bash
export COMMUNITY_REGISTRY_ADDRESS=0x...
export PARAM_CONTROLLER_ADDRESS=0x...
export TIMELOCK_ADDRESS=0x...

HARDHAT_NETWORK=base_sepolia pnpm admin:create "Test Community" "Test" "ipfs://..." 0
```

### Programmatic Usage (TypeScript/JavaScript)

```typescript
import { CommunityAdmin, AddressBook } from "./scripts/manage-communities";

const addresses: AddressBook = {
  communityRegistry: "0x...",
  paramController: "0x...",
  // ... other addresses
};

const admin = new CommunityAdmin("base_sepolia", addresses);
await admin.init();

// Create community
const communityId = await admin.createCommunity(
  "My DAO",
  "Description",
  "ipfs://...",
  0
);

// Grant roles
await admin.grantCommunityRole(communityId, "moderator", "0x...");

// Set parameters
await admin.setGovernanceParams(communityId, 86400, 259200, 86400);
```

---

## Help & Support

### CLI Help

```bash
HARDHAT_NETWORK=base_sepolia pnpm admin
# Shows command usage and examples
```

### Related Documentation

- [Architecture Overview](./EN/Architecture.md)
- [Whitepaper](./EN/Whitepaper.md)
- [Contract Documentation](./EN/contracts/)
- [Deployment Guide](../README.md)

### Common Scripts

```bash
# Check system status
HARDHAT_NETWORK=base_sepolia pnpm status

# Verify deployment addresses
pnpm verify:addresses

# Check community info
HARDHAT_NETWORK=base_sepolia pnpm manage community info 1

# Check governance parameters
HARDHAT_NETWORK=base_sepolia pnpm manage community params 1
```

---

## Security Best Practices

1. **Use Hardware Wallet** - For production/mainnet operations
2. **Test on Sepolia First** - Always test workflows on testnet before mainnet
3. **Renounce Admin Roles** - After setup, renounce timelock admin for decentralization
4. **Multi-Sig Governance** - Use Gnosis Safe or similar for ParamController governance
5. **Gradual Decentralization** - Start with founder control, gradually transfer to community governance
6. **Audit Parameters** - Review all parameters before finalizing community creation
7. **Backup Private Keys** - Securely store deployer keys; loss = permanent lockout

---

**Last Updated:** December 2025  
**Version:** 1.0.0  
**Maintainer:** Shift DeSoc Core Team
