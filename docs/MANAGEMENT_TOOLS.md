# Shift DeSoc Management Tools

Complete guide to the two CLI management tools for operating deployed Shift DeSoc systems on Base Sepolia, Base, Ethereum Sepolia, and Ethereum mainnet.

## Table of Contents

- [Overview](#overview)
- [Community Admin CLI](#community-admin-cli) - Community lifecycle management
- [System Management CLI](#system-management-cli) - Day-to-day operations
- [Prerequisites](#prerequisites)
- [Complete Workflows](#complete-workflows)
- [Network Reference](#network-reference)

---

## Overview

Shift DeSoc provides two complementary CLI tools for managing deployed systems:

### 1. **Community Admin CLI** (`manage-communities.ts`)

**Purpose**: Community lifecycle and configuration management

**Use for:**
- ✅ Creating new communities
- ✅ Granting moderator/curator roles
- ✅ Setting governance parameters (timing, eligibility, revenue splits)
- ✅ Configuring verifier system (VPT parameters)
- ✅ Managing timelock roles (proposer/executor/canceller/admin)

**Who uses it:** Community founders, system administrators, governance teams

**Frequency:** Once during setup, occasionally for parameter updates

---

### 2. **System Management CLI** (`manage-system.ts`)

**Purpose**: Day-to-day operations and monitoring

**Use for:**
- ✅ Checking system status and community info
- ✅ Creating and managing verifier elections
- ✅ Viewing governance proposals and voting
- ✅ Submitting and verifying work claims
- ✅ Minting VPT tokens and checking balances
- ✅ Monitoring community activity

**Who uses it:** Community members, verifiers, workers, governance participants

**Frequency:** Daily/weekly for routine operations

---

## Prerequisites

### Environment Setup

Both tools require the same `.env` configuration:

```bash
# Required: Deployer/operator private key
PRIVATE_KEY=0x...

# Required: Network RPC endpoints
RPC_BASE_SEPOLIA=https://sepolia.base.org
RPC_BASE=https://mainnet.base.org
RPC_SEPOLIA=https://ethereum-sepolia.rpc.com
RPC_MAINNET=https://ethereum.rpc.com

# Optional: Address overrides (tools prefer deployments/<network>.json)
COMMUNITY_REGISTRY_ADDRESS=0x...
PARAM_CONTROLLER_ADDRESS=0x...
# ... (other contract addresses)
```

### Deployment Files

Both tools load contract addresses from `deployments/<network>.json`:

```bash
# Verify deployment file exists
ls deployments/base_sepolia.json

# Check addresses are valid
pnpm verify:addresses
```

### Network Selection

Set the target network via environment variable:

```bash
# Base Sepolia (testnet)
export HARDHAT_NETWORK=base_sepolia

# Base (mainnet)
export HARDHAT_NETWORK=base

# Or inline with each command
HARDHAT_NETWORK=base_sepolia pnpm admin:create "Community Name" ...
```

---

# Community Admin CLI

**Script:** `scripts/manage-communities.ts`

**Package shortcuts:** `pnpm admin`, `pnpm admin:create`, `pnpm admin:grant-role`, `pnpm admin:set-params`, `pnpm admin:timelock`

## Commands

### 1. Create Community

**Register a new community and configure module addresses**

```bash
# Using package script (recommended)
HARDHAT_NETWORK=base_sepolia pnpm admin:create <name> <description> <metadataURI> [parentId]

# Direct invocation
HARDHAT_NETWORK=base_sepolia ts-node scripts/manage-communities.ts create <name> <description> <metadataURI> [parentId]
```

**Arguments:**
- `name` - Community display name
- `description` - Community description
- `metadataURI` - IPFS URI for additional metadata
- `parentId` - (Optional) Parent community ID for nested communities (default: 0)

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm admin:create \
  "Shift Pioneers" \
  "First pilot community on Shift DeSoc" \
  "ipfs://QmPioneersCommunityMetadata" \
  0

# Output:
# 🏠 Creating community 'Shift Pioneers' on base_sepolia
# ✅ Community registered with ID 2
# 🔗 Setting module addresses...
# ✅ Module addresses set
# 👑 Founder/admin: 0xYourAddress
```

**What it does:**
1. Calls `CommunityRegistry.registerCommunity()`
2. Grants deployer address community admin role automatically
3. Sets all module addresses (governor, timelock, requestHub, draftsManager, etc.)
4. Returns new community ID

---

### 2. Grant Community Roles

**Grant moderator or curator roles to users**

```bash
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role <communityId> <role> <address>
```

**Roles:**
- `moderator` - Can freeze/archive RequestHub posts and DraftsManager discussions
- `curator` - Can manage community content and metadata

**Examples:**
```bash
# Grant moderator role
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 2 moderator 0xAbc123...

# Grant curator role
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 2 curator 0xDef456...
```

---

### 3. Set Parameters

**Configure community parameters via ParamController**

⚠️ **Required Authority:** Caller must be ParamController governance address

#### 3a. Governance Parameters

```bash
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params governance <communityId> <debateWindow> <voteWindow> <executionDelay>
```

**Arguments (all in seconds):**
- `debateWindow` - Proposal debate period (e.g., 86400 = 1 day)
- `voteWindow` - Voting period (e.g., 259200 = 3 days)
- `executionDelay` - Timelock delay before execution (e.g., 86400 = 1 day)

**Example:**
```bash
# 1 day debate, 3 days voting, 1 day execution delay
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params governance 2 86400 259200 86400
```

#### 3b. Eligibility Parameters

```bash
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params eligibility <communityId> <minSeniority> <minSBTs> <proposalThresholdWei>
```

**Arguments:**
- `minSeniority` - Minimum account age in seconds (0 = no restriction)
- `minSBTs` - Minimum ValuableActionSBT count (0 = no restriction)
- `proposalThresholdWei` - Minimum MembershipTokens to propose (in wei)

**Example:**
```bash
# No restrictions, 100 tokens to propose
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params eligibility 2 0 0 100000000000000000000
```

#### 3c. Revenue Policy

```bash
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params revenue <communityId> <workersBps> <treasuryBps> <investorsBps> <spilloverTarget>
```

**Arguments (all in basis points, must sum to 10000):**
- `workersBps` - Workers share (2500 = 25%)
- `treasuryBps` - Treasury share (2500 = 25%)
- `investorsBps` - Investors share (5000 = 50%)
- `spilloverTarget` - Where excess goes: `0` = workers, `1` = treasury

**Example:**
```bash
# 40% workers, 30% treasury, 30% investors, spillover to workers
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params revenue 2 4000 3000 3000 0
```

#### 3d. Verifier Parameters

```bash
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params verifier <communityId> <panelSize> <minApprovals> <maxPanels> <useWeighting> <maxWeight> <cooldown>
```

**Arguments:**
- `panelSize` - Verifiers selected per claim (3-9 recommended)
- `minApprovals` - M-of-N minimum approvals needed
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
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant <role> [address]

# Renounce role
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock renounce <role>
```

**Roles:**
- `proposer` - Can queue governance proposals
- `executor` - Can execute queued proposals after delay
- `canceller` - Can cancel queued proposals
- `admin` - Can manage timelock roles (should be renounced after setup)

**Examples:**
```bash
# Grant proposer/executor/canceller to governor
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant proposer 0xGOVERNOR
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant executor 0xGOVERNOR
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant canceller 0xGOVERNOR

# Renounce admin role for decentralization
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock renounce admin
```

---

# System Management CLI

**Script:** `scripts/manage-system.ts`

**Package shortcuts:** `pnpm manage`, `pnpm status`

## Commands

### 1. System Status

**View overall system health and community summary**

```bash
HARDHAT_NETWORK=base_sepolia pnpm status

# Or
HARDHAT_NETWORK=base_sepolia pnpm manage status
```

**Output:**
```
📊 Shift DeSoc System Status on base_sepolia
============================================================
Communities: 3
Total Governance Tokens: 50000.0
Deployer: 0xYourAddress
Balance: 0.5 ETH

📍 Core Contracts:
   CommunityRegistry: 0x...
   Governor: 0x...
   VerifierElection: 0x...
   Claims: 0x...

🏘️  Communities:
   1. Pioneers DAO - First community
   2. Builders Collective - Tech builders
   3. Artists Guild - Creative community
```

---

### 2. Verifier Elections

**Create and manage VPT-based verifier elections**

#### Create Election

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage elections create <communityId> <candidates> [durationHours]
```

**Arguments:**
- `communityId` - Community ID
- `candidates` - Comma-separated addresses (e.g., "0xAbc...,0xDef...,0x123...")
- `durationHours` - (Optional) Election duration in hours (default: 72)

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage elections create 1 \
  "0xAbc123...,0xDef456...,0x789012..." \
  72
```

#### View Election Info

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage elections info <electionId>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage elections info 1

# Output:
# 📊 Election 1 Information:
#    Community: 1
#    Status: Active
#    End Time: 12/24/2025, 10:00:00 AM
#    Min Voting Power: 100 VPT
#    Finalized: false
#
#    👥 Candidates (3):
#       1. 0xAbc... - 500 VPT votes
#       2. 0xDef... - 300 VPT votes
#       3. 0x789... - 200 VPT votes
```

#### Cast Vote

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage elections vote <electionId> <candidateIndex> <vptAmount>
```

**Example:**
```bash
# Vote 250 VPT for candidate 0 in election 1
HARDHAT_NETWORK=base_sepolia pnpm manage elections vote 1 0 250
```

#### Finalize Election

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage elections finalize <electionId>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage elections finalize 1
```

---

### 3. Governance Operations

#### View Proposal

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage governance proposal <proposalId>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage governance proposal 12345...

# Output:
# 📊 Proposal 12345...:
#    State: Active
#    Vote Start: 12/21/2025, 9:00:00 AM
#    Vote End: 12/24/2025, 9:00:00 AM
```

#### Vote on Proposal

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage governance vote <proposalId> <support> [reason]
```

**Support values:**
- `0` = Against
- `1` = For
- `2` = Abstain

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage governance vote 12345... 1 "I support this proposal"
```

---

### 4. Claims & Work Verification

#### Submit Claim

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage claims submit <communityId> <valuableActionId> <evidenceCID>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage claims submit 1 5 "QmEvidenceHash..."
```

#### View Claim Info

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage claims info <claimId>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage claims info 42

# Output:
# 📊 Claim 42:
#    Worker: 0xWorker...
#    Community: 1
#    ValuableAction: 5
#    Evidence: QmEvidenceHash...
#    Status: 1
```

#### Verify Claim (Juror only)

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage claims verify <claimId> <true|false>
```

**Example:**
```bash
# Approve claim
HARDHAT_NETWORK=base_sepolia pnpm manage claims verify 42 true

# Reject claim
HARDHAT_NETWORK=base_sepolia pnpm manage claims verify 42 false
```

---

### 5. VPT Token Management

#### Mint VPT

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage vpt mint <address> <communityId> <amount>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage vpt mint 0xVerifier... 1 1000
```

#### Check VPT Balance

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage vpt balance <address> <communityId>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage vpt balance 0xVerifier... 1

# Output:
# 💰 VPT Balance: 0xVerifier... has 1000 VPT in Community 1
```

#### Check Voting Eligibility

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage vpt eligibility <address> <communityId>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage vpt eligibility 0xVerifier... 1

# Output:
# 🗳️  Voting Eligibility Check:
#    Address: 0xVerifier...
#    Community: 1
#    VPT Balance: 1000
#    Required: 100
#    Eligible: YES
```

---

### 6. Community Information

#### View Community Info

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage community info <communityId>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage community info 1

# Output:
# 🏘️  Community 1 Information:
#    Name: Pioneers DAO
#    Description: First pilot community
#    Metadata URI: ipfs://Qm...
#    Debate Window: 86400 seconds
#    Vote Window: 259200 seconds
#    Execution Delay: 86400 seconds
#    Revenue Split: 40/30/30
```

#### View VPT Parameters

```bash
HARDHAT_NETWORK=base_sepolia pnpm manage community params <communityId>
```

**Example:**
```bash
HARDHAT_NETWORK=base_sepolia pnpm manage community params 1

# Output:
# ⚙️  VPT Parameters for Community 1:
#    Panel Size: 5
#    Min Approvals: 3
#    Max Panels: 20
#    Use Weighting: true
#    Max Weight: 1000
#    Fraud Cooldown: 86400 seconds
```

---

# Complete Workflows

## Workflow 1: Bootstrap New Community

**Goal:** Create and fully configure a new community from scratch

```bash
# Step 1: Create community (auto-grants deployer admin role)
HARDHAT_NETWORK=base_sepolia pnpm admin:create \
  "Builders Collective" \
  "Tech builders community" \
  "ipfs://QmBuildersMetadata" \
  0

# Output shows: Community ID 2

# Step 2: Set governance parameters (1d debate, 3d vote, 1d delay)
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params governance 2 86400 259200 86400

# Step 3: Set eligibility rules (no age/SBT restrictions, 100 tokens to propose)
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params eligibility 2 0 0 100000000000000000000

# Step 4: Set revenue policy (40% workers, 30% treasury, 30% investors)
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params revenue 2 4000 3000 3000 0

# Step 5: Set verifier parameters (5 jurors, need 3, max 20 panels, weighted)
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params verifier 2 5 3 20 true 1000 86400

# Step 6: Grant timelock roles to governor
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant proposer 0xGOVERNOR_ADDRESS
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant executor 0xGOVERNOR_ADDRESS
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock grant canceller 0xGOVERNOR_ADDRESS

# Step 7: Grant moderator roles
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 2 moderator 0xMOD1_ADDRESS
HARDHAT_NETWORK=base_sepolia pnpm admin:grant-role 2 moderator 0xMOD2_ADDRESS

# Step 8: Verify setup
HARDHAT_NETWORK=base_sepolia pnpm manage community info 2
HARDHAT_NETWORK=base_sepolia pnpm manage community params 2

# Step 9: (Optional) Renounce timelock admin for decentralization
HARDHAT_NETWORK=base_sepolia pnpm admin:timelock renounce admin
```

---

## Workflow 2: Conduct Verifier Election

**Goal:** Elect new verifiers for a community

```bash
# Step 1: Check current system status
HARDHAT_NETWORK=base_sepolia pnpm status

# Step 2: Create election with 3 candidates for 72 hours
HARDHAT_NETWORK=base_sepolia pnpm manage elections create 1 \
  "0xCandidate1...,0xCandidate2...,0xCandidate3..." \
  72

# Output shows: Election 1 created

# Step 3: Mint VPT to voters (if needed)
HARDHAT_NETWORK=base_sepolia pnpm manage vpt mint 0xVoter1... 1 500
HARDHAT_NETWORK=base_sepolia pnpm manage vpt mint 0xVoter2... 1 300

# Step 4: Voters cast votes (as each voter)
HARDHAT_NETWORK=base_sepolia pnpm manage elections vote 1 0 500  # Voter1 → Candidate1
HARDHAT_NETWORK=base_sepolia pnpm manage elections vote 1 1 300  # Voter2 → Candidate2

# Step 5: Check election status periodically
HARDHAT_NETWORK=base_sepolia pnpm manage elections info 1

# Step 6: Finalize election after deadline
HARDHAT_NETWORK=base_sepolia pnpm manage elections finalize 1
```

---

## Workflow 3: Submit and Verify Work Claim

**Goal:** Worker submits claim, verifiers review and approve/reject

```bash
# Step 1: Worker submits claim with evidence
HARDHAT_NETWORK=base_sepolia pnpm manage claims submit 1 5 "QmEvidenceIPFSHash..."

# Output shows: Claim submitted (assume claim ID 42)

# Step 2: Check claim status
HARDHAT_NETWORK=base_sepolia pnpm manage claims info 42

# Step 3: Selected verifiers verify claim
# (Each selected juror runs this)
HARDHAT_NETWORK=base_sepolia pnpm manage claims verify 42 true

# Step 4: Check claim status after M-of-N threshold
HARDHAT_NETWORK=base_sepolia pnpm manage claims info 42

# Step 5: Verify worker received SBT and tokens
HARDHAT_NETWORK=base_sepolia pnpm manage community info 1
```

---

## Workflow 4: Governance Proposal Lifecycle

**Goal:** Create, vote on, and execute a governance proposal

```bash
# Step 1: Check voting power
HARDHAT_NETWORK=base_sepolia pnpm manage community info 1

# Step 2: Create proposal (via governor contract - not in CLI, requires custom script)
# See: scripts/governance-valuableaction-creation.ts

# Step 3: View proposal status
HARDHAT_NETWORK=base_sepolia pnpm manage governance proposal 0x12345...

# Step 4: Cast vote during voting period
HARDHAT_NETWORK=base_sepolia pnpm manage governance vote 0x12345... 1 "Supporting this proposal"

# Step 5: Execute proposal (via execute-proposal.ts)
HARDHAT_NETWORK=base_sepolia pnpm execute:proposal --network base_sepolia
```

---

# Network Reference

## Base Sepolia (Testnet)

- **RPC:** https://sepolia.base.org
- **Chain ID:** 84532
- **USDC:** 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- **Explorer:** https://sepolia.basescan.org
- **Faucet:** https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Gas:** ~0.001 gwei (very cheap)
- **Use case:** Testing and development

**Set network:**
```bash
export HARDHAT_NETWORK=base_sepolia
```

---

## Base (Mainnet)

- **RPC:** https://mainnet.base.org
- **Chain ID:** 8453
- **USDC:** 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
- **Explorer:** https://basescan.org
- **Gas:** ~0.05 gwei (optimized for production)
- **Deployment cost:** ~$10 for full system (vs $9,600 on Ethereum)
- **Use case:** Production deployment

**Set network:**
```bash
export HARDHAT_NETWORK=base
```

---

## Ethereum Sepolia (Testnet)

- **RPC:** https://ethereum-sepolia.rpc.com
- **Chain ID:** 11155111
- **USDC:** 0xA0b86a33E6417547e65D22763FB8ce30cCDbdC79
- **Explorer:** https://sepolia.etherscan.io
- **Faucet:** https://sepoliafaucet.com
- **Use case:** Ethereum-compatible testing

**Set network:**
```bash
export HARDHAT_NETWORK=ethereum_sepolia
```

---

## Ethereum (Mainnet)

- **RPC:** https://ethereum.rpc.com
- **Chain ID:** 1
- **USDC:** 0xA0b86a33E6417547e65D22763FB8ce30cCDbdC79
- **Explorer:** https://etherscan.io
- **Gas:** Variable, typically 20-50 gwei
- **Deployment cost:** ~$9,600 for full system (high)
- **Use case:** Production deployment (if cost justified)

**Set network:**
```bash
export HARDHAT_NETWORK=ethereum
```

---

# Troubleshooting

## Common Issues

### "No deployment addresses found"

**Fix:**
```bash
# Verify file exists
ls deployments/base_sepolia.json

# If missing, deploy system first
HARDHAT_NETWORK=base_sepolia pnpm deploy:base-sepolia
```

### "NotAuthorized" when setting parameters

**Fix:**
```bash
# Check current ParamController governance
cast call <PARAM_CONTROLLER> "governance()(address)" --rpc-url <RPC_URL>

# Update governance if needed (requires current governance signature)
cast send <PARAM_CONTROLLER> "updateGovernance(address)" <NEW_GOV> \
  --private-key $PRIVATE_KEY --rpc-url <RPC_URL>
```

### "Insufficient funds for gas"

**Fix:**
```bash
# Check balance
cast balance <YOUR_ADDRESS> --rpc-url <RPC_URL>

# Fund from faucet (testnet) or transfer (mainnet)
```

### "Revenue split must sum to 10000 bps"

**Fix:**
```bash
# Ensure workers + treasury + investors = 10000 (100%)
# Example: 4000 + 3000 + 3000 = 10000 ✓
HARDHAT_NETWORK=base_sepolia pnpm admin:set-params revenue 2 4000 3000 3000 0
```

---

# Quick Reference

## Community Admin Commands

```bash
# Create community
pnpm admin:create <name> <desc> <metadataURI> [parentId]

# Grant roles
pnpm admin:grant-role <communityId> <moderator|curator> <address>

# Set governance params
pnpm admin:set-params governance <cid> <debate> <vote> <exec>

# Set eligibility params
pnpm admin:set-params eligibility <cid> <minAge> <minSBTs> <threshold>

# Set revenue policy
pnpm admin:set-params revenue <cid> <workers> <treasury> <investors> <spillover>

# Set verifier params
pnpm admin:set-params verifier <cid> <panel> <min> <maxPanels> <weight> <maxW> <cool>

# Timelock roles
pnpm admin:timelock grant <role> [address]
pnpm admin:timelock renounce <role>
```

## System Management Commands

```bash
# Status
pnpm status

# Elections
pnpm manage elections create <cid> <candidates> [hours]
pnpm manage elections info <electionId>
pnpm manage elections vote <electionId> <candidateIdx> <vptAmount>
pnpm manage elections finalize <electionId>

# Governance
pnpm manage governance proposal <proposalId>
pnpm manage governance vote <proposalId> <support> [reason]

# Claims
pnpm manage claims submit <cid> <vaId> <evidenceCID>
pnpm manage claims info <claimId>
pnpm manage claims verify <claimId> <true|false>

# VPT
pnpm manage vpt mint <address> <cid> <amount>
pnpm manage vpt balance <address> <cid>
pnpm manage vpt eligibility <address> <cid>

# Community info
pnpm manage community info <communityId>
pnpm manage community params <communityId>
```

---

# Security Best Practices

1. **Hardware Wallet** - Use hardware wallet for mainnet operations
2. **Test on Sepolia** - Always test workflows on testnet first
3. **Renounce Admin Roles** - After setup, renounce timelock admin
4. **Multi-Sig Governance** - Use Gnosis Safe for ParamController governance
5. **Backup Keys** - Securely store deployer private keys
6. **Audit Parameters** - Review all parameters before finalizing
7. **Monitor Activity** - Regularly check system status and community health

---

**Documentation Version:** 1.0.0  
**Last Updated:** December 2025  
**Maintainer:** Shift DeSoc Core Team

For detailed community admin workflows, see: [COMMUNITY_ADMIN_CLI.md](./COMMUNITY_ADMIN_CLI.md)
