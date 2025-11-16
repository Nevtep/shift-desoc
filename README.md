# Shift DeSoc - Meta-Governance Technology Platform

*Building the organizational tools that unlock human cooperation: Where communities coordinate abundant resources, make wise collective decisions, and share the value they create together*

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
- **Claims**: M-of-N peer verification with economic incentives
- **WorkerSBT**: Soulbound reputation tokens with portable credentials

### **Economic Distribution Engine** ✅ Production Ready
- **CommunityToken**: 1:1 USDC-backed community currency
- **RevenueRouter**: ROI-based distribution favoring long-term contributors
- **TreasuryAdapter**: Governance-controlled community treasury management

## 💻 **Development Workflow**

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