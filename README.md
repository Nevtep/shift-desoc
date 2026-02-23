# Shift DeSoc - Meta-Governance Technology Platform

_Building the organizational tools that unlock human cooperation: Where communities coordinate abundant resources, make wise collective decisions, and share the value they create together_

## 🎯 **Production-Ready MVP (December 2025)**

**✅ LIVE DEPLOYMENT**: Complete ecosystem successfully deployed and verified on Base Sepolia with operational community.

- **All 22 Contracts Deployed**: Full system operational on Base Sepolia
- **Community ID 1 Active**: Complete governance and verification infrastructure
- **Ultra-Low Cost**: ~$0.19 per community deployment vs $9,600 on Ethereum
- **Automated Address Management**: deployments/{network}.json system with auto-loading
- **Base Mainnet Ready**: Gas optimized (0.05 gwei) for ~$10 production deployment
- **Complete Documentation**: 21 contracts fully documented with technical architecture

## 🏗️ **What is Shift DeSoc?**

**Shift DeSoc is meta-governance technology** - flexible infrastructure that enables communities to model any organizational structure they choose. Rather than imposing a specific governance model, Shift provides building blocks that communities configure to implement their unique decision-making processes, value definitions, and coordination patterns.

**Core Flow**: `Community Discussion → Collaborative Drafts → Multi-Choice Governance → Timelock Execution`

## 🚀 **Quick Start**

### Prerequisites

- Node.js >=22 (Vercel Node 24 compatible)
- pnpm >=8
- Frontend apps use Next.js 16

### For Developers

1. **Read the development guide**: [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
2. **Check architecture**: [`docs/EN/Architecture.md`](docs/EN/Architecture.md)
3. **Deploy to testnet**: [`.github/deployment/BASE_SEPOLIA_DEPLOYMENT_GUIDE.md`](.github/deployment/BASE_SEPOLIA_DEPLOYMENT_GUIDE.md)

### For Communities & Organizations

1. **Understand the vision**: [`docs/EN/Whitepaper.md`](docs/EN/Whitepaper.md)
2. **See real examples**: [`.github/project-management/PROJECT_STATUS.md`](.github/project-management/PROJECT_STATUS.md)
3. **Plan implementation**: [`docs/EN/Architecture.md`](docs/EN/Architecture.md)

## 📁 **Project Structure**

```
├── 📄 .github/                     # Development coordination & deployment
│   ├── copilot-instructions.md     # → Primary development guide
│   ├── project-management/         # → Status reports & architecture analysis
│   └── deployment/                 # → Network deployment guides
├── 📄 contracts/                   # → Smart contract implementations
│   ├── core/                       # → Governance (ShiftGovernor, CountingMultiChoice)
│   ├── modules/                    # → Community coordination & work verification
│   └── tokens/                     # → MembershipToken & CommunityToken
├── 📄 docs/                        # → Business & technical documentation
│   ├── EN/                         # → English documentation
│   └── ES/                         # → Spanish documentation
└── 📄 scripts/                     # → Deployment & testing automation
```

## 🔗 **Core Technology Stack**

### **Community Coordination Layer** ✅ Production Ready

- **RequestHub**: On-chain discussion forum with moderation
- **DraftsManager**: Collaborative proposal development with versioning
- **CommunityRegistry**: Community metadata and parameter management

### **Democratic Governance Engine** ✅ Production Ready

- **ShiftGovernor**: Multi-choice voting beyond binary decisions
- **CountingMultiChoice**: Weighted voting across multiple options
- **MembershipToken**: Merit-based governance tokens (work → voting power)

### **Work Verification System** ✅ Production Ready

- **ValuableActionRegistry**: Community-defined work value system
- **Engagements**: M-of-N peer verification with democratic oversight
- **VerifierPowerToken1155 (VPT)**: Community-elected verifiers with governance accountability
- **ValuableActionSBT**: Soulbound reputation tokens with portable credentials

### **Democratic Verifier System (VPT)** 🆕 Latest Innovation

**Governance-Elected Verification** - Communities democratically elect their own verifiers through transparent processes, replacing economic barriers with community trust.

**Key Benefits:**

- 🗳️ **Democratic Selection**: Communities elect verifiers based on merit, not wealth
- 🔄 **Term Limits**: Regular elections ensure accountability and fresh perspectives
- 📊 **Performance Monitoring**: Transparent tracking of verifier accuracy and behavior
- 🛡️ **Fraud Prevention**: Community oversight and reporting mechanisms
- 🚫 **No Economic Barriers**: Removes financial requirements that exclude qualified participants
- ⚖️ **Community Justice**: Local accountability through elected representatives

### **Economic Distribution Engine** ✅ Production Ready

- **CommunityToken**: 1:1 USDC-backed community currency
- **RevenueRouter**: ROI-based distribution favoring long-term contributors
- **TreasuryAdapter**: Governance-controlled community treasury management

## 💻 **Development Workflow**

### **Core Development Commands**

```bash
# Setup and test
pnpm install
pnpm build                    # Compile both toolchains
pnpm forge:test              # Run Foundry tests
pnpm cov:gate                # Check coverage

# Deploy complete system (fresh deployment)
npm run deploy:base-sepolia   # Deploy to Base Sepolia testnet
npm run deploy:base           # Deploy to Base mainnet
npm run deploy:ethereum       # Deploy to Ethereum mainnet

# 📝 Deployment automatically saves contract addresses to:
#    deployments/{network}.json
#    deployments/latest.json
# Management scripts auto-load addresses from these files!

# Format code
pnpm fmt
```

## 🔧 **Complete Script Catalog - 47 npm Scripts**

### 🛠️ **Core Development (7 scripts)**

- **`fmt`** - Code formatting with Prettier
- **`lint`** - Solidity linting with solhint
- **`lint:fix`** - Auto-fix linting issues
- **`quality`** - Run all quality checks (lint + test + coverage)
- **`sanity`** - Complete quality validation pipeline
- **`build`** - Compile contracts (Foundry + Hardhat)
- **`test`** - Run Foundry tests

### 🚀 **Network Deployment (4 scripts)**

- **`deploy:base-sepolia`** - Deploy to Base Sepolia testnet
- **`deploy:base`** - Deploy to Base mainnet
- **`deploy:ethereum-sepolia`** - Deploy to Ethereum Sepolia testnet
- **`deploy:ethereum`** - Deploy to Ethereum mainnet

### 🧩 **Canonical Community Deployment (4 scripts)**

- **`deploy:shared-infra`** - Deploy/reuse shared infra (AccessManager/ParamController/CommunityRegistry)
- **`deploy:community-stack`** - Deploy per-community contracts and register modules
- **`deploy:wire-community`** - Apply selector-level least-privilege role wiring
- **`deploy:verify-community`** - Verify deployment invariants and critical role paths

### 👀 **Monitoring & Verification (3 scripts)**

- **`check:balance`** - D-1 backing ratio monitor
- **`check:engagements`** - D-2 engagement anomaly monitor
- **`verify:base-sepolia`** - Base Sepolia integration/accessibility verification

### 🛠️ **Administration & Operations**

- **`admin` / `admin:create` / `admin:grant-role` / `admin:set-params` / `admin:timelock`** - community admin CLI commands
- **`manage:cohorts`** - cohort lifecycle and revenue cohort operations
- **`dev:generate-wallets`** - local wallet generation helper

### 📦 **Build & ABI Tooling**

- **`forge:build`** - Foundry build + ABI sync to indexer/web
- **`hh:compile`** - Hardhat compile
- **`forge:cov`** + **`cov:gate`** - coverage and gate enforcement

### 🗃️ **Legacy Scripts**

- Historical, one-off, and broken/outdated scripts are archived under `scripts/legacy/`.
- They are reference-only and intentionally not exposed as package commands.
- See `scripts/README.md` for the maintained active script surface.

## 🎯 **Why This Toolkit Is Essential**

### **Production Readiness**

- **Single canonical deployment path** for deterministic and auditable setup
- **Focused monitoring scripts** for backing ratio and engagement anomalies
- **Reduced operator ambiguity** by archiving outdated workflows

### **Community Operations**

- **Admin CLI** for community creation, role assignment, and parameter updates
- **Cohort tooling** for economic-layer operations
- **Deployment JSON-based wiring** to keep scripts network-aware

### **Operational Excellence**

- **Coverage gates** and dual-toolchain validation
- **ABI sync tooling** for web/indexer consistency
- **Clear script governance** (active vs archived)

**Result**: Lean, maintainable toolkit for current deployment and operations.

## 📝 **Deployment Address Management**

Shift DeSoc **automatically saves and loads contract addresses** - no manual configuration needed!

### **Automatic Address Saving**

When you deploy, addresses are automatically saved to:
- `deployments/{network}.json` - Network-specific addresses (e.g., `base_sepolia.json`)
- `deployments/latest.json` - Most recent deployment across all networks

### **Automatic Address Loading**

Active operational scripts load addresses from deployment files:

```bash
# No manual configuration needed - addresses auto-loaded where supported
pnpm check:balance --network base_sepolia
pnpm check:engagements --network base_sepolia
pnpm verify:base-sepolia
```

### **Deployment File Format**

```json
{
  "network": "base_sepolia",
  "timestamp": "2025-12-08T00:00:00Z",
  "deployer": "0x73af48d53f75827dB195189e6FeBaB726dF7D0e2",
  "communityId": 1,
  "addresses": {
    "communityRegistry": "0x...",
    "governor": "0x...",
    "marketplace": "0x...",
    // ... all 22 contract addresses
  },
  "configuration": {
    "communityName": "Shift DeSoc Community",
    "votingDelay": 7200,
    "votingPeriod": 86400,
    "revenueSplit": [60, 30, 10]
  }
}
```

📚 **See [`deployments/README.md`](deployments/README.md) for complete documentation**

### **Script Inventory**

For the complete and current script inventory, see `scripts/README.md`.

## 🌐 **Network Support**

- **✅ Base Sepolia** (testnet) - Live deployment with Community ID 1 operational (22 contracts)
- **🎯 Base Mainnet** (production) - Ready for mainnet deployment (~$10 per community)
- **⚠️ Ethereum** (mainnet/testnet) - Supported but higher gas costs (~$9,600 per community)

## 📊 **Business Model**

Shift DeSoc enables **meta-governance for any organizational structure**:

- **Blockchain Protocols**: Enhance DAO governance beyond simple token voting
- **Open Source Projects**: Transparent contributor coordination and merit recognition
- **Local Cooperatives**: Democratic decision-making for resource-sharing communities
- **Enterprise Organizations**: Transition to more democratic and transparent management

## 🎉 **Current Status**

**Phase 1-6 COMPLETED** - All core systems production-ready:

- ✅ Community coordination infrastructure (RequestHub, DraftsManager, CommunityRegistry, ParamController)
- ✅ Multi-choice governance engine (ShiftGovernor, CountingMultiChoice, Timelock, MembershipToken)
- ✅ Work verification & merit system (ValuableActionRegistry, Engagements, VPT system, ValuableActionSBT)
- ✅ Economic distribution & treasury management (CommunityToken, RevenueRouter, CohortRegistry, TreasuryAdapter)
- ✅ Community modules (Marketplace, ProjectFactory, HousingManager, CommerceDisputes)
- ✅ Deployment infrastructure (API-based deployment, automated address management, Base mainnet optimization)

**Current Focus**: Base mainnet deployment and first pilot communities.

---

## 📖 **Documentation Hub**

- **🏗️ Development**: [`.github/copilot-instructions.md`](.github/copilot-instructions.md) - Complete development guide
- **📋 Project Management**: [`.github/project-management/`](.github/project-management/) - Status & planning docs
- **🚀 Deployment**: [`.github/deployment/`](.github/deployment/) - Network deployment guides
- **💼 Business**: [`docs/EN/Whitepaper.md`](docs/EN/Whitepaper.md) - Investment & community overview
- **⚙️ Technical**: [`docs/EN/Architecture.md`](docs/EN/Architecture.md) - System architecture & contracts

---

**Building the future of collaborative abundance through meta-governance technology** 🚀
