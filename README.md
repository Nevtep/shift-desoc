# Shift DeSoc - Meta-Governance Technology Platform

_Building the organizational tools that unlock human cooperation: Where communities coordinate abundant resources, make wise collective decisions, and share the value they create together_

## 🎯 **Production-Ready MVP (November 2025)**

**✅ LIVE DEPLOYMENT**: Complete ecosystem successfully deployed and verified on Base Sepolia with real community operations.

- **Real Communities Operating**: Community ID 3 deployed with full governance functionality
- **Ultra-Low Cost**: ~$0.19 per community deployment vs $9,600 on Ethereum
- **API-Based Scaling**: Automated deployment system avoids blockchain size limits
- **Mobile Ready**: Complete Next.js backend + Expo React Native integration

## 🏗️ **What is Shift DeSoc?**

**Shift DeSoc is meta-governance technology** - flexible infrastructure that enables communities to model any organizational structure they choose. Rather than imposing a specific governance model, Shift provides building blocks that communities configure to implement their unique decision-making processes, value definitions, and coordination patterns.

**Core Flow**: `Community Discussion → Collaborative Drafts → Multi-Choice Governance → Timelock Execution`

## 🚀 **Quick Start**

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
- **Claims**: M-of-N peer verification with democratic oversight
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

### 🏠 **Community Creation (6 scripts)**

- **`create-community`** - Standard community creation
- **`create-community:api`** - API-friendly community creation for UI integration
- **`create-community:direct`** - Manual deployment bypassing factory size limits
- **`deploy:mvp`** - Lightweight MVP deployment for testing
- **`setup:complete-community`** - Recovery tool for failed deployments
- **`setup:finalize-community`** - Production deployment completion
- **`setup:fix-issues`** - **Surgical fixes for deployment problems**

### 👀 **User-Friendly Monitoring (5 scripts)**

- **`check:balance`** - Simple wallet balance checker
- **`check:claims`** - **Comprehensive claim monitoring with detailed analysis**
- **`check:rewards`** - **Detailed reward tracking and analysis**
- **`check:governance`** - **Governance status monitoring with proposal tracking**
- **`check:permissions`** - **Debug admin permissions and roles**

### 🏛️ **Governance Operations (3 scripts)**

- **`governance:create-action`** - **Create ValuableActions through governance proposals**
- **`governance:monitor`** - **Real-time proposal monitoring with status tracking**
- **`governance:vote`** - **Cast votes on governance proposals**
- **`execute:proposal`** - **Execute succeeded governance proposals through timelock**

### 👥 **Verification Operations (2 scripts)**

- **`verifier:register`** - **Register as verifier with required bonding**
- **`verifier:verify-claim`** - **Verifier interface for M-of-N claim verification**

### 🔬 **System Analysis (2 scripts)**

- **`analyze:system`** - **Comprehensive system health diagnostics**
- **`analyze:verification`** - **Work verification system analysis and testing**

### 🧪 **E2E Testing Suite (3 scripts)**

- **`test:verification-e2e`** - **Complete work verification workflow test**
- **`test:governance-e2e`** - **Simple governance flow validation**
- **`test:validate-results`** - **Validate E2E test results**

### 🎛️ **System Administration & Utilities**

- **`manage`** - Interactive admin CLI for system operations
- **`status`** - Quick system status check
- **`submit:claim`** - **User-friendly claim submission interface**
- **`validate-deployment`** - Verify deployment completeness
- **`test:e2e`** - End-to-end scenario testing
- **`gas-costs`** - Gas cost analysis for operations
- **`dev:generate-wallets`** - **Generate test wallets for multi-user testing**

## 🎯 **Why This Toolkit Is Essential**

### **Production Readiness**

- **Multiple deployment strategies** + recovery tools for complex multi-contract deployments
- **Comprehensive monitoring** with user-friendly status checking vs diving into blockchain explorers
- **Surgical troubleshooting** for production issues without full redeployment

### **Community Operations**

- **Guided governance workflows** for proposal creation, voting, and execution
- **Work verification coordination** between verifiers with M-of-N verification tools
- **Economic transparency** with reward tracking and treasury monitoring

### **Operational Excellence**

- **Complete test coverage** for all workflows from governance to verification
- **System intelligence** with deep diagnostic tools for proactive issue detection
- **Multi-user support** with wallet generation and validation tools

**Result**: Production-ready toolkit covering every scenario from development to community governance to system maintenance.

### **System Management**

Complete management interface for all system operations including governance, verifier elections, claims processing, and community administration.

#### **System Status & Monitoring**

```bash
# Check overall system status
npm run status

# Get community information
npm run manage community info 1
npm run manage community params 1
```

#### **Governance Operations**

```bash
# Check proposal information
npm run manage governance proposal <proposalId>

# Vote on governance proposal (0=Against, 1=For, 2=Abstain)
npm run manage governance vote <proposalId> 1 "Supporting this proposal"
```

#### **Claims & Work Verification**

```bash
# Submit work claim
npm run manage claims submit 1 1 "QmEvidenceHash..."

# Check claim status
npm run manage claims info 42

# Verify claim (for verifiers)
npm run manage claims verify 42 true
```

#### **VPT Token Management**

```bash
# Check VPT balance
npm run manage vpt balance 0x123... 1

# Mint VPT tokens (governance only)
npm run manage vpt mint 0x123... 1 1000

# Check voting eligibility
npm run manage vpt eligibility 0x123... 1
```

### **Example Deployment Workflow**

```bash
# 1. Deploy core Shift DeSoc contracts
pnpm -C packages/hardhat hardhat run scripts/deploy.ts --network base_sepolia

# 2. Deploy VPT system migration
pnpm vpt:deploy:base-sepolia

# 3. Create first verifier election
pnpm vpt:manage create-election \
  --community-id 1 \
  --seats 3 \
  --term-length 90 \
  --network base_sepolia

# 4. Community members apply and vote
# [Applications and voting happen through UI or individual commands]

# 5. Check election results and verifier status
pnpm vpt:manage list-verifiers --community-id 1 --network base_sepolia
```

## 🌐 **Network Support**

- **✅ Base Sepolia** (testnet) - Live deployment with Community ID 3 operational
- **🎯 Base Mainnet** (production) - Ready for mainnet deployment
- **⚠️ Ethereum** (mainnet/testnet) - Supported but higher gas costs

## 📊 **Business Model**

Shift DeSoc enables **meta-governance for any organizational structure**:

- **Blockchain Protocols**: Enhance DAO governance beyond simple token voting
- **Open Source Projects**: Transparent contributor coordination and merit recognition
- **Local Cooperatives**: Democratic decision-making for resource-sharing communities
- **Enterprise Organizations**: Transition to more democratic and transparent management

## 🎉 **Current Status**

**Phase 1-5 COMPLETED** - All core systems production-ready:

- ✅ Community coordination infrastructure
- ✅ Multi-choice governance engine
- ✅ Work verification & merit system
- ✅ Economic distribution & treasury management
- ✅ Base Sepolia deployment & API integration

**Current Focus**: Documentation alignment and production deployment preparation.

---

## 📖 **Documentation Hub**

- **🏗️ Development**: [`.github/copilot-instructions.md`](.github/copilot-instructions.md) - Complete development guide
- **📋 Project Management**: [`.github/project-management/`](.github/project-management/) - Status & planning docs
- **🚀 Deployment**: [`.github/deployment/`](.github/deployment/) - Network deployment guides
- **💼 Business**: [`docs/EN/Whitepaper.md`](docs/EN/Whitepaper.md) - Investment & community overview
- **⚙️ Technical**: [`docs/EN/Architecture.md`](docs/EN/Architecture.md) - System architecture & contracts

---

**Building the future of collaborative abundance through meta-governance technology** 🚀
