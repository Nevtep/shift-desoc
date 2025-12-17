# Base Sepolia Deployment Configuration Guide

## 🌐 **Network Configuration**

### **Base Sepolia Testnet Details**

```bash
Network Name: Base Sepolia
Chain ID: 84532
RPC URL: https://sepolia.base.org
Block Explorer: https://sepolia.basescan.org
Currency Symbol: ETH
```

### **Required Environment Variables**

Create `.env` file in project root:

```bash
# Base Sepolia RPC Configuration
RPC_BASE_SEPOLIA="https://sepolia.base.org"

# Deployer Configuration
PRIVATE_KEY="0x..." # Your deployer private key (ensure it has Base Sepolia ETH)

# Contract Verification
BASESCAN_API_KEY="..." # Get from https://basescan.org/apis

# USDC Integration (Base Sepolia)
USDC_BASE_SEPOLIA="0x036CbD53842c5426634e7929541eC2318f3dCF7e"

# Multicall3 (Standard across networks)
MULTICALL3="0xcA11bde05977b3631167028862bE2a173976CA11"
```

## 💰 **Pre-Deployment Setup**

### **1. Get Base Sepolia ETH**

```bash
# Option 1: Base Sepolia Faucet
# Visit: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

# Option 2: Bridge from Ethereum Sepolia
# Visit: https://bridge.base.org/deposit

# Ensure deployer has at least 0.1 ETH for deployment gas
```

### **2. Verify Network Connection**

```bash
# Test RPC connection
curl -X POST https://sepolia.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Should return current block number
```

## 📋 **Deployment Script Configuration**

### **Step-by-Step Deployment Flow**

#### **Phase 1: Core Infrastructure**

```typescript
// scripts/hardhat/deploy-mvp.ts

async function deployPhase1() {
  console.log("🚀 Phase 1: Core Infrastructure");

  // 1. Deploy CommunityFactory
  const communityFactory = await ethers.deployContract("CommunityFactory");
  console.log("✅ CommunityFactory:", communityFactory.target);

  // 2. Verify contract
  await run("verify:verify", {
    address: communityFactory.target,
    constructorArguments: [],
  });

  return { communityFactory };
}
```

#### **Phase 2: First Community Setup**

```typescript
async function deployPhase2(communityFactory: Contract) {
  console.log("🏛️ Phase 2: Shift Core Community");

  // 1. Prepare community parameters
  const communityParams = {
    name: "Shift DeSoc Core",
    description:
      "The foundational governance community for Shift DeSoc platform",
    debateWindow: 3 * 24 * 60 * 60, // 3 days
    voteWindow: 5 * 24 * 60 * 60, // 5 days
    executionDelay: 2 * 24 * 60 * 60, // 2 days
    minSeniority: 0, // No minimum for initial community
    minSBTs: 1, // Must have at least 1 SBT to participate
    proposalThreshold: ethers.parseEther("100"), // 100 MembershipTokens to propose
  };

  // 2. Setup founders (initial team addresses)
  const founders = [
    "0x...", // Add founder addresses here
    "0x...",
  ];

  // 3. Create community
  const tx = await communityFactory.createCommunity(communityParams, founders);
  const receipt = await tx.wait();

  // Extract community ID from events
  const communityCreatedEvent = receipt.logs.find(
    (log) => log.eventName === "CommunityCreated",
  );
  const communityId = communityCreatedEvent.args.communityId;

  console.log("✅ Community Created, ID:", communityId);
  return { communityId };
}
```

#### **Phase 3: Initial ValuableActions Setup**

```typescript
async function deployPhase3(communityId: bigint) {
  console.log("⚡ Phase 3: Bootstrap ValuableActions");

  // Get deployed contracts from community
  const registry = await ethers.getContractAt(
    "CommunityRegistry",
    await communityFactory.getCommunityRegistry(communityId),
  );

  const valuableActionRegistry = await ethers.getContractAt(
    "ValuableActionRegistry",
    await registry.getModuleAddress(communityId, "valuableActionRegistry"),
  );

  // Create foundational ValuableActions
  const actions = [
    {
      name: "Senior Development Work",
      membershipTokenReward: 100, // 100 tokens per completion
      communityTokenReward: 50, // 50 tokens salary weight
      jurorsMin: 3, // Need 3 approvals
      panelSize: 5, // From panel of 5
      verifyWindow: 7 * 24 * 60 * 60, // 7 days to verify
      cooldownPeriod: 14 * 24 * 60 * 60, // 14 days between claims
      evidenceTypes: 0b111, // CODE_REVIEW | DEPLOYMENT_PROOF | IMPACT_METRICS
      founderVerified: true, // Skip governance for bootstrap
    },
    {
      name: "Community Moderation",
      membershipTokenReward: 25,
      communityTokenReward: 15,
      jurorsMin: 2,
      panelSize: 3,
      verifyWindow: 3 * 24 * 60 * 60, // 3 days
      cooldownPeriod: 7 * 24 * 60 * 60, // 7 days
      evidenceTypes: 0b001, // COMMUNITY_FEEDBACK only
      founderVerified: true,
    },
  ];

  for (const action of actions) {
    const tx = await valuableActionRegistry.proposeValuableAction(
      communityId,
      action,
      "ipfs://...", // IPFS hash with detailed requirements
    );
    console.log(`✅ Created ValuableAction: ${action.name}`);
  }
}
```

#### **Phase 4: Configuration & Testing**

```typescript
async function deployPhase4(communityId: bigint) {
  console.log("🔧 Phase 4: Configuration & Testing");

  // 1. Setup USDC integration
  const communityToken = await ethers.getContractAt(
    "CommunityToken",
    await registry.getModuleAddress(communityId, "communityToken"),
  );

  await communityToken.setBackingAsset(process.env.USDC_BASE_SEPOLIA, true);
  console.log("✅ USDC backing configured");

  // 2. Test basic functionality
  await testBasicFunctionality(communityId);

  // 3. Output deployment summary
  await outputDeploymentSummary(communityId);
}
```

## 🧪 **Deployment Commands**

### **Execute Deployment**

```bash
# 1. Compile contracts
npm run build

# 2. Run deployment script
npm run hh:deploy:base-sepolia

# 3. Verify all contracts (automatically done in script)
# Manual verification if needed:
npx hardhat verify --network base_sepolia <CONTRACT_ADDRESS> [CONSTRUCTOR_ARGS]
```

### **Post-Deployment Verification**

```bash
# 1. Check contract verification on BaseScan
echo "Check: https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>"

# 2. Test contract interaction
npx hardhat run scripts/hardhat/test-deployment.ts --network base_sepolia

# 3. Run integration smoke tests
npm run test:integration:base-sepolia
```

## 📊 **Expected Deployment Output**

```bash
🚀 Shift DeSoc MVP Deployment to Base Sepolia
==========================================

📋 Network: Base Sepolia (84532)
💰 Deployer: 0x742d35Cc6234Aa1bc3B1509D0e85eE5D886467B8
⛽ Gas Price: 0.1 gwei

Phase 1: Core Infrastructure
✅ CommunityFactory: 0x1234...
✅ Verified on BaseScan

Phase 2: Shift Core Community
✅ Community ID: 1
✅ ShiftGovernor: 0x5678...
✅ TimelockController: 0x9abc...
✅ MembershipToken: 0xdef0...

Phase 3: Bootstrap ValuableActions
✅ ValuableActionRegistry: 0x1111...
✅ Senior Development Work (ID: 1)
✅ Community Moderation (ID: 2)

Phase 4: Configuration
✅ USDC backing configured
✅ Integration tests passed
✅ System ready for use

🎉 MVP Successfully Deployed!

📖 Usage Guide: https://docs.shift-desoc.org/deployment/base-sepolia
🔗 Explorer: https://sepolia.basescan.org/address/0x1234...
```

## 🛠️ **Troubleshooting**

### **Common Issues**

#### **1. Insufficient Gas**

```bash
# Error: Transaction underpriced
# Solution: Increase gas price in hardhat.config.ts
networks: {
    base_sepolia: {
        gasPrice: 1000000000, // 1 gwei
    }
}
```

#### **2. Contract Verification Fails**

```bash
# Error: Contract verification failed
# Solution: Manual verification with flattened source
npx hardhat flatten contracts/CommunityFactory.sol > flattened.sol
# Upload flattened.sol to BaseScan manually
```

#### **3. USDC Integration Issues**

```bash
# Error: USDC contract not found
# Solution: Verify Base Sepolia USDC address
# Current: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### **Emergency Recovery**

```typescript
// If deployment partially fails, resume from specific phase:
async function resumeDeployment() {
  const existingFactory = await ethers.getContractAt(
    "CommunityFactory",
    "0x...", // Address from previous deployment
  );

  // Continue from failed phase
  await deployPhase3(existingCommunityId);
}
```

## ✅ **Deployment Checklist**

- [ ] Base Sepolia ETH funded (≥0.1 ETH)
- [ ] Environment variables configured
- [ ] Contracts compile successfully
- [ ] Tests pass locally
- [ ] BaseScan API key configured
- [ ] Deployment script tested on local hardhat network
- [ ] Founder addresses confirmed
- [ ] USDC contract address verified
- [ ] Gas price configured appropriately
- [ ] Emergency recovery plan ready

---

**Ready to Deploy**: Execute `npm run hh:deploy:base-sepolia` when all checklist items are complete.
