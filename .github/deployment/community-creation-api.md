# Community Creation API - Deployment Guide

## 🎯 Overview

This guide documents the complete process for deploying Shift DeSoc communities via API, designed for Next.js backend integration that serves mobile Expo applications. The API-based approach avoids blockchain size limits while providing a robust, scalable solution for community creation.

## 🏗️ Architecture Overview

```
Expo Mobile App → Next.js API Backend → Hardhat Scripts → Base Network → Smart Contracts
```

### Key Components
- **Mobile Frontend**: Expo React Native app for community creation UI
- **Backend API**: Next.js server with community creation endpoints
- **Deployment Engine**: Hardhat-based contract deployment system
- **Blockchain Layer**: Base network with deployed community infrastructure

## 📋 Prerequisites

### Environment Setup
```bash
# Node.js and package management
node >= 18.0.0
pnpm >= 8.0.0

# Blockchain development
hardhat >= 2.27.0
ethers.js >= 6.15.0

# Network access
Base Sepolia (testnet): RPC endpoint
Base Mainnet: RPC endpoint + real ETH
```

### Required Environment Variables
```bash
# Network Configuration
PRIVATE_KEY="0x..." # Deployer private key with ETH balance
BASE_SEPOLIA_RPC="https://sepolia.base.org"
BASE_MAINNET_RPC="https://mainnet.base.org"

# API Configuration
NEXT_PUBLIC_API_URL="https://your-api.com"
DATABASE_URL="postgresql://..." # For storing deployment results

# Optional: Monitoring
ETHERSCAN_API_KEY="..." # For contract verification
```

## 🚀 Community Creation Process

### Step 1: Core Governance Deployment

The first phase deploys the fundamental governance infrastructure:

```typescript
// 1. Deploy MembershipToken (ERC20Votes)
const membershipToken = await MembershipTokenFactory.deploy(
  `${communityName} Membership`,
  `${communityName.substring(0, 4).toUpperCase()}M`
);

// 2. Deploy TimelockController
const timelock = await TimelockFactory.deploy(
  executionDelay, // e.g., 172800 (48 hours)
  [], // proposers (will be set to governor)
  [], // executors (will be set to governor)
  deployer // admin (temporary)
);

// 3. Deploy ShiftGovernor
const governor = await GovernorFactory.deploy(
  membershipToken.target,
  timelock.target,
  debateWindow, // e.g., 86400 (24 hours)
  voteWindow,   // e.g., 259200 (72 hours)
  proposalThreshold // e.g., 100 tokens
);
```

**Gas Cost**: ~8.4M gas (~$0.025 USD on Base)

### Step 2: Community Registration

Register the new community in the global registry:

```typescript
// Connect to existing CommunityRegistry
const registry = await ethers.getContractAt(
  "CommunityRegistry", 
  "0x67eC4cAcC44D80B43Ce7CCA63cEF6D1Ae3E57f8B" // Base Sepolia
);

// Register community with governance contracts
const registerTx = await registry.registerCommunity(
  communityName,
  description,
  founderAddress,
  governor.target,
  timelock.target,
  membershipToken.target
);

const receipt = await registerTx.wait();
const communityId = receipt.logs.find(log => 
  log.topics[0] === registry.interface.getEvent("CommunityRegistered").topicHash
).args.communityId;
```

**Gas Cost**: ~425K gas (~$0.001 USD on Base)

### Step 3: Work Verification Modules

Deploy the work verification and claims system:

```typescript
// 1. ValuableActionRegistry - Defines what work is valuable
const actionRegistry = await ActionRegistryFactory.deploy(
  communityId,
  registry.target
);

// 2. WorkerSBT - Soulbound tokens for verified contributors  
const workerSBT = await WorkerSBTFactory.deploy(
  `${communityName} Worker`,
  `${communityName.substring(0, 4).toUpperCase()}W`,
  actionRegistry.target
);

// 3. VerifierPool - Jury selection for work verification
const verifierPool = await VerifierPoolFactory.deploy(
  workerSBT.target,
  registry.target,
  communityId
);

// 4. Claims - Work submission and verification workflow
const claims = await ClaimsFactory.deploy(
  actionRegistry.target,
  verifierPool.target,
  workerSBT.target,
  membershipToken.target
);
```

**Gas Cost**: ~9.8M gas (~$0.030 USD on Base)

### Step 4: Community Coordination Modules

Deploy discussion and collaboration infrastructure:

```typescript
// 1. RequestHub - Community discussion forum
const requestHub = await RequestHubFactory.deploy(
  communityId,
  registry.target,
  workerSBT.target
);

// 2. DraftsManager - Collaborative proposal development
const draftsManager = await DraftsManagerFactory.deploy(
  requestHub.target,
  governor.target,
  workerSBT.target,
  communityId
);

// 3. CommunityToken - 1:1 USDC-backed stable token
const communityToken = await CommunityTokenFactory.deploy(
  `${communityName} Token`,
  `${communityName.substring(0, 4).toUpperCase()}T`,
  usdcAddress // Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
);
```

**Gas Cost**: ~6.9M gas (~$0.021 USD on Base)

### Step 5: Permission Configuration

Set up access controls and role management:

```typescript
// Grant governor control over timelock
const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();

await timelock.grantRole(PROPOSER_ROLE, governor.target);
await timelock.grantRole(EXECUTOR_ROLE, governor.target);

// Configure multi-choice voting
const countingMultiChoice = "0x9a254605ccEf5c69Ce51b0a8C0a65016dD476c83";
await governor.setCountingMulti(countingMultiChoice);

// Grant claims contract minting permissions
const MINTER_ROLE = await membershipToken.MINTER_ROLE();
await membershipToken.grantRole(MINTER_ROLE, claims.target);

// Grant claims contract SBT management permissions  
const MANAGER_ROLE = await workerSBT.MANAGER_ROLE();
await workerSBT.grantRole(MANAGER_ROLE, claims.target);
```

**Gas Cost**: ~800K gas (~$0.002 USD on Base)

### Step 6: Founder Bootstrap

Initialize the founder with governance tokens and cleanup permissions:

```typescript
// Grant deployer temporary minting permission
await membershipToken.grantRole(MINTER_ROLE, deployer);

// Mint initial governance tokens for founder
const founderTokens = ethers.parseEther("10000"); // 10,000 tokens
await membershipToken.mint(founderAddress, founderTokens);

// Transfer minter role to claims contract and revoke from deployer
await membershipToken.grantRole(MINTER_ROLE, claims.target);
await membershipToken.revokeRole(MINTER_ROLE, deployer);

// Remove deployer admin access from timelock
await timelock.revokeRole(TIMELOCK_ADMIN_ROLE, deployer);
```

**Gas Cost**: ~400K gas (~$0.001 USD on Base)

### Step 7: Module Registration

Register all deployed modules in the community registry for discoverability:

```typescript
const moduleRegistrations = [
  { key: "governor", address: governor.target },
  { key: "timelock", address: timelock.target },
  { key: "claimsManager", address: claims.target },
  { key: "actionTypeRegistry", address: actionRegistry.target },
  { key: "verifierPool", address: verifierPool.target },
  { key: "workerSBT", address: workerSBT.target },
  { key: "requestHub", address: requestHub.target },
  { key: "draftsManager", address: draftsManager.target },
  { key: "communityToken", address: communityToken.target }
];

for (const { key, address } of moduleRegistrations) {
  await registry.setModuleAddress(communityId, key, address);
}
```

**Gas Cost**: ~1.8M gas (~$0.005 USD on Base)

## 💰 Cost Analysis

### Total Deployment Costs

| Network | Gas Used | ETH Cost | USD Cost (ETH=$3000) |
|---------|----------|----------|---------------------|
| **Base Sepolia** | 64M gas | 0.064 ETH | **$0.19** |
| **Base Mainnet** | 64M gas | 0.064 ETH | **$0.19** |
| **Ethereum Mainnet** | 64M gas | 3.2 ETH | **$9,600** |

### Cost Breakdown by Phase

| Phase | Gas Used | Base Cost | Description |
|-------|----------|-----------|-------------|
| Core Governance | 8.4M | $0.025 | Governor, Timelock, MembershipToken |
| Community Registration | 425K | $0.001 | Registry entry |
| Work Modules | 9.8M | $0.030 | Claims, SBTs, Verification |
| Community Modules | 6.9M | $0.021 | Discussions, Proposals, Token |
| Permissions | 800K | $0.002 | Role setup |
| Founder Bootstrap | 400K | $0.001 | Initial tokens |
| Module Registration | 1.8M | $0.005 | Registry updates |
| **TOTAL** | **28M** | **$0.085** | **Complete community** |

## 🌐 Next.js API Integration

### API Endpoint Structure

```typescript
// pages/api/communities/create.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createCommunityForUI } from '../../../lib/community-deployer';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      name,
      description,
      founderAddress,
      governanceParams
    } = req.body;

    // Validate input parameters
    if (!name || !founderAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Deploy community
    const result = await createCommunityForUI({
      name,
      description,
      founderAddress,
      governanceParams: {
        debateWindow: governanceParams?.debateWindow || 86400,
        voteWindow: governanceParams?.voteWindow || 259200,
        executionDelay: governanceParams?.executionDelay || 172800,
        proposalThreshold: governanceParams?.proposalThreshold || 100
      }
    });

    // Store in database for tracking
    await saveCommunityDeployment(result);

    res.status(201).json(result);
  } catch (error) {
    console.error('Community creation failed:', error);
    res.status(500).json({ 
      error: 'Community creation failed',
      details: error.message 
    });
  }
}
```

### Database Schema

```sql
-- Community deployments tracking
CREATE TABLE community_deployments (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL,
  community_name VARCHAR(255) NOT NULL,
  founder_address VARCHAR(42) NOT NULL,
  
  -- Contract addresses
  governor_address VARCHAR(42) NOT NULL,
  timelock_address VARCHAR(42) NOT NULL,
  membership_token_address VARCHAR(42) NOT NULL,
  claims_address VARCHAR(42) NOT NULL,
  worker_sbt_address VARCHAR(42) NOT NULL,
  request_hub_address VARCHAR(42) NOT NULL,
  drafts_manager_address VARCHAR(42) NOT NULL,
  community_token_address VARCHAR(42) NOT NULL,
  
  -- Deployment metadata
  network_name VARCHAR(50) NOT NULL,
  chain_id INTEGER NOT NULL,
  total_gas_used BIGINT,
  deployment_cost_eth DECIMAL(20, 18),
  tx_hashes TEXT[], -- Array of transaction hashes
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'deploying',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  -- Indexes
  UNIQUE(community_id, network_name),
  INDEX(founder_address),
  INDEX(community_name),
  INDEX(status)
);
```

## 📱 Expo Mobile Integration

### Community Creation Flow

```typescript
// Mobile app: Create community screen
import { useCommunityCreation } from '../hooks/useCommunityCreation';

export function CreateCommunityScreen() {
  const { createCommunity, loading, error } = useCommunityCreation();
  
  const handleCreate = async (formData) => {
    try {
      const result = await createCommunity({
        name: formData.name,
        description: formData.description,
        founderAddress: wallet.address,
        governanceParams: {
          debateWindow: formData.debateHours * 3600,
          voteWindow: formData.voteHours * 3600,
          executionDelay: formData.delayHours * 3600
        }
      });
      
      // Navigate to success screen with community details
      navigation.navigate('CommunitySuccess', { 
        communityId: result.communityId,
        contracts: result.contracts 
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <ScrollView>
      <CommunityForm onSubmit={handleCreate} loading={loading} />
      {error && <ErrorMessage message={error} />}
    </ScrollView>
  );
}
```

### Real-time Deployment Tracking

```typescript
// Hook for community creation with progress tracking
export function useCommunityCreation() {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  
  const createCommunity = async (params) => {
    // Connect to WebSocket for real-time updates
    const ws = new WebSocket('wss://api.shift.com/deploy-progress');
    
    ws.onmessage = (event) => {
      const { step, progress } = JSON.parse(event.data);
      setCurrentStep(step);
      setProgress(progress);
    };
    
    // Call API endpoint
    const response = await fetch('/api/communities/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    return response.json();
  };
  
  return { createCommunity, progress, currentStep };
}
```

## 🔧 Deployment Script Usage

### Direct Script Execution

```bash
# Create community via environment variables
COMMUNITY_NAME="My New Community" \
FOUNDER_ADDRESS="0x73af48d53f75827dB195189e6FeBaB726dF7D0e2" \
npx hardhat run scripts/hardhat/create-community-api.ts --network base_sepolia
```

### Programmatic Usage

```typescript
import { createCommunityForUI } from './create-community-api';

const result = await createCommunityForUI({
  name: "Tech Innovators DAO",
  description: "A community for technology innovators",
  founderAddress: "0x73af48d53f75827dB195189e6FeBaB726dF7D0e2",
  governanceParams: {
    debateWindow: 86400,    // 24 hours
    voteWindow: 259200,     // 72 hours  
    executionDelay: 172800, // 48 hours
    proposalThreshold: 100  // 100 tokens to propose
  }
});

console.log('Community ID:', result.communityId);
console.log('Governor:', result.contracts.governor);
```

## 📊 Success Response Format

```typescript
interface CommunityCreationResult {
  // Community identification
  communityId: number;
  founder: string;
  
  // All deployed contract addresses
  contracts: {
    communityRegistry: string;
    countingMultiChoice: string;
    governor: string;
    timelock: string;
    membershipToken: string;
    valuableActionRegistry: string;
    claims: string;
    verifierPool: string;
    workerSBT: string;
    requestHub: string;
    draftsManager: string;
    communityToken: string;
  };
  
  // Network information
  network: {
    name: string;
    chainId: string;
  };
  
  // Deployment tracking
  txHashes: string[];
  gasUsed: string;
  founderTokens: string;
  
  // Timestamps
  deployedAt: string;
  completedAt: string;
}
```

## 🛡️ Security Considerations

### Input Validation
- Validate Ethereum addresses using `ethers.isAddress()`
- Sanitize community names and descriptions
- Enforce reasonable governance parameter ranges
- Rate limit API calls to prevent spam

### Access Control
- Verify wallet signatures for founder authentication
- Implement API key authentication for mobile apps
- Log all deployment attempts for audit trail
- Monitor for suspicious deployment patterns

### Error Handling
- Graceful handling of network failures
- Transaction timeout and retry logic
- Partial deployment recovery procedures
- Clear error messages for users

## 🚀 Production Deployment Checklist

### Infrastructure Setup
- [ ] Base mainnet RPC endpoint configured
- [ ] Deployer wallet funded with sufficient ETH
- [ ] Database configured for deployment tracking
- [ ] Error monitoring and alerting setup

### Contract Verification
- [ ] All contracts verified on Basescan
- [ ] Contract addresses updated in frontend
- [ ] Gas price monitoring configured
- [ ] Backup deployment procedures documented

### API Security
- [ ] Rate limiting implemented
- [ ] Input validation comprehensive
- [ ] Authentication mechanisms active
- [ ] Monitoring and logging configured

### Mobile App Integration
- [ ] API endpoints tested with real mobile clients
- [ ] WebSocket progress tracking functional
- [ ] Error handling tested across network conditions
- [ ] UI/UX flows tested end-to-end

## 📚 Additional Resources

### Contract Interfaces
- [CommunityRegistry ABI](../contracts/CommunityRegistry.json)
- [ShiftGovernor ABI](../contracts/ShiftGovernor.json)
- [Claims ABI](../contracts/Claims.json)

### Network Information
- [Base Network Documentation](https://docs.base.org/)
- [Base Sepolia Testnet](https://sepolia.base.org/)
- [Base Mainnet](https://mainnet.base.org/)

### Development Tools
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js v6 Documentation](https://docs.ethers.org/v6/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

---

*This documentation provides a complete guide for integrating community creation into mobile applications via Next.js backend APIs. The process is production-ready, cost-effective, and scalable for thousands of communities.*