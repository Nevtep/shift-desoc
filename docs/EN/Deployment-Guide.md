# Deployment Guide for Marketing Site & Mobile App

## 🎯 Overview

This guide provides the deployment steps and infrastructure documentation needed to create a Next.js marketing site that serves as a backend for an Expo React Native mobile app to deploy communities from the mobile application.

## 🏗️ Architecture Summary

### Current Production Infrastructure (Base Sepolia)
```
Community Deployment Flow:
Mobile App (Expo) → Next.js API Routes → Base Sepolia Smart Contracts

Cost: $0.19 per community deployment
Network: Base Sepolia (testnet) → Base (production)
Deployment Method: API-based (no factory contracts)
```

### Smart Contract Stack (13 Contracts)
#### Production-Ready Contracts (12 total):
1. **Core Governance**: `ShiftGovernor`, `CountingMultiChoice`, `MembershipTokenERC20Votes`
2. **Community Coordination**: `CommunityRegistry`, `RequestHub`, `DraftsManager`  
3. **Work Verification**: `Claims`, `VerifierPool`, `WorkerSBT`, `ValuableActionRegistry`
4. **Economic Layer**: `CommunityToken`, `RevenueRouter`, `ParamController`

#### Phase 2 Stubs (3 contracts):
- `TreasuryAdapter`, `HousingManager`, `Marketplace` - Basic implementations for future development

## 🚀 Deployment Steps

### 1. Environment Setup

#### Prerequisites
```bash
# Required tools
node >= 18
pnpm >= 8
git
```

#### Clone and Install
```bash
git clone https://github.com/your-org/shift
cd shift
pnpm install
```

#### Environment Configuration
Create `.env.local` in your Next.js app:
```env
# Base Sepolia Network
NEXT_PUBLIC_NETWORK=base-sepolia
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_CHAIN_ID=84532

# Contract Addresses (Base Sepolia)
NEXT_PUBLIC_COMMUNITY_REGISTRY=0x...
NEXT_PUBLIC_SHIFT_GOVERNOR=0x...
NEXT_PUBLIC_MEMBERSHIP_TOKEN=0x...
NEXT_PUBLIC_COMMUNITY_TOKEN=0x...

# Deployment Wallet
PRIVATE_KEY=your_deployment_private_key
ETHERSCAN_API_KEY=your_etherscan_key

# External Services
PINATA_API_KEY=your_pinata_key
PINATA_SECRET_KEY=your_pinata_secret
```

### 2. Smart Contract Deployment

#### Compile Contracts
```bash
# Foundry compilation (primary)
pnpm forge:build

# Hardhat compilation (deployment)
pnpm -C packages/hardhat hardhat compile
```

#### Deploy to Base Sepolia
```bash
# Deploy all contracts
pnpm -C packages/hardhat hardhat run scripts/deploy.ts --network base_sepolia

# Verify on Basescan
pnpm -C packages/hardhat hardhat verify --network base_sepolia CONTRACT_ADDRESS
```

#### Example Deployment Output
```bash
✅ MembershipTokenERC20Votes deployed: 0x1234...
✅ CommunityToken deployed: 0x5678...  
✅ ShiftGovernor deployed: 0x9abc...
✅ CommunityRegistry deployed: 0xdef0...
✅ RequestHub deployed: 0x1111...
✅ Claims deployed: 0x2222...
✅ WorkerSBT deployed: 0x3333...

💰 Total deployment cost: ~$8.40 USD (Base) vs ~$4,200 USD (Ethereum)
⏱️  Total time: ~3 minutes
```

### 3. Next.js Marketing Site Setup

#### API Routes Structure
```typescript
// pages/api/communities/create.ts
import { ethers } from 'ethers';
import { CommunityRegistry__factory } from '../../../typechain';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, description, founderAddress } = req.body;

  try {
    // Connect to Base Sepolia
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    
    // Deploy community contracts
    const registry = CommunityRegistry__factory.connect(
      process.env.NEXT_PUBLIC_COMMUNITY_REGISTRY!,
      wallet
    );

    const tx = await registry.registerCommunity({
      name,
      description,
      founder: founderAddress,
      // ... other parameters
    });

    const receipt = await tx.wait();
    const communityId = receipt.logs[0].args?.communityId;

    res.status(200).json({
      success: true,
      communityId: communityId.toString(),
      txHash: receipt.hash,
      cost: ethers.formatEther(receipt.gasUsed * receipt.gasPrice) + ' ETH'
    });

  } catch (error) {
    console.error('Community creation failed:', error);
    res.status(500).json({ error: 'Community creation failed' });
  }
}
```

#### Community List API
```typescript
// pages/api/communities/list.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
  const registry = CommunityRegistry__factory.connect(
    process.env.NEXT_PUBLIC_COMMUNITY_REGISTRY!,
    provider
  );

  try {
    const totalCommunities = await registry.totalCommunities();
    const communities = [];

    for (let i = 1; i <= totalCommunities; i++) {
      const community = await registry.getCommunity(i);
      communities.push({
        id: i,
        name: community.name,
        description: community.description,
        memberCount: community.memberCount.toString(),
        createdAt: community.createdAt.toString()
      });
    }

    res.status(200).json({ communities });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch communities' });
  }
}
```

### 4. Expo Mobile App Integration

#### React Native Setup
```bash
# Create Expo app
npx create-expo-app@latest shift-mobile --template blank-typescript
cd shift-mobile

# Install Web3 dependencies
npm install ethers @ethersproject/shims react-native-get-random-values
```

#### Web3 Configuration
```typescript
// src/config/web3.ts
import { ethers } from 'ethers';

// Import polyfills for React Native
import '@ethersproject/shims';
import 'react-native-get-random-values';

export const web3Config = {
  network: 'base-sepolia',
  rpcUrl: 'https://sepolia.base.org',
  chainId: 84532,
  contracts: {
    communityRegistry: '0x...',
    shiftGovernor: '0x...',
    membershipToken: '0x...',
  }
};

export const getProvider = () => {
  return new ethers.JsonRpcProvider(web3Config.rpcUrl);
};
```

#### Community Creation Screen
```typescript
// src/screens/CreateCommunityScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';

export const CreateCommunityScreen = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const createCommunity = async () => {
    if (!name || !description) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      // Call Next.js API
      const response = await fetch('https://your-site.vercel.app/api/communities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          founderAddress: '0x...' // User's wallet address
        })
      });

      const result = await response.json();
      
      if (result.success) {
        Alert.alert('Success', `Community created! ID: ${result.communityId}`);
        // Navigate to community screen
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create community');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Create Community</Text>
      
      <TextInput
        placeholder="Community Name"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{ borderWidth: 1, padding: 10, marginBottom: 20, height: 100 }}
      />
      
      <TouchableOpacity
        onPress={createCommunity}
        disabled={loading}
        style={{ 
          backgroundColor: loading ? '#ccc' : '#007AFF',
          padding: 15,
          borderRadius: 8
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          {loading ? 'Creating...' : 'Create Community'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
```

### 5. Production Deployment

#### Next.js Site Deployment (Vercel)
```bash
# Deploy to Vercel
npm install -g vercel
vercel deploy --prod

# Set environment variables in Vercel dashboard:
# - NEXT_PUBLIC_* variables
# - PRIVATE_KEY
# - PINATA_* keys
```

#### Expo App Deployment
```bash
# Build for production
expo build:android
expo build:ios

# Submit to stores
expo submit --platform android
expo submit --platform ios
```

### 6. Base Mainnet Migration

#### Production Environment
```env
# Base Mainnet
NEXT_PUBLIC_NETWORK=base
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_CHAIN_ID=8453
```

#### Deployment Cost Comparison
| Network | Cost per Community | Block Time | Finality | Gas Price |
|---------|-------------------|------------|----------|-----------|
| Ethereum | ~$4,200 | 12s | 12 mins | 50 gwei |
| Base | ~$8.40 | 2s | 1 min | 0.1 gwei |
| Base Sepolia | ~$0.00 | 2s | 1 min | 0.001 gwei |

*Based on 28M gas per community deployment and ETH = $3,000*

## 🔧 Configuration Parameters

### Community Creation Defaults
```typescript
const defaultCommunityParams = {
  // Governance Timing
  debateWindow: 7 * 24 * 60 * 60, // 7 days
  voteWindow: 3 * 24 * 60 * 60,   // 3 days
  executionDelay: 24 * 60 * 60,   // 1 day
  
  // Eligibility Requirements
  minSeniority: 30 * 24 * 60 * 60, // 30 days
  minSBTs: 1,                      // At least 1 SBT
  proposalThreshold: 100,          // 100 MembershipTokens
  
  // Economic Split (basis points)
  revenueSplit: [5000, 3000, 2000], // 50% workers, 30% treasury, 20% investors
  feeOnWithdraw: 100,                // 1% withdrawal fee
  
  // Initial ValuableActions for founders
  initialActions: [
    "Community Founding",
    "Initial Governance Setup", 
    "First Member Onboarding"
  ]
};
```

### Verification Parameters
```typescript
const verificationDefaults = {
  jurorsMin: 3,           // Minimum approvals needed
  panelSize: 5,           // Total jurors selected
  verifyWindow: 7 * 24 * 3600, // 7 days to verify
  cooldownPeriod: 24 * 3600,   // 1 day between claims
  maxConcurrent: 3             // Max 3 active claims per person
};
```

## 🔐 Security Considerations

### API Security
```typescript
// Rate limiting
import rateLimit from 'express-rate-limit';

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 community creations per IP per 15 min
  message: 'Too many communities created, try again later'
});
```

### Wallet Security
- **Private keys**: Store in secure environment variables only
- **Multi-sig**: Consider multi-sig for contract upgrades
- **Access control**: Implement proper RBAC in APIs

### Smart Contract Security
- **Reentrancy**: All contracts use CEI pattern
- **Access control**: OpenZeppelin AccessControl integration
- **Upgrades**: Transparent proxy pattern for upgradeable contracts

## 📊 Monitoring & Analytics

### Event Tracking
```typescript
// Track community creation events
const provider = new ethers.JsonRpcProvider(rpcUrl);
const registry = CommunityRegistry__factory.connect(registryAddress, provider);

registry.on("CommunityRegistered", (communityId, name, founder) => {
  console.log(`New community: ${name} (ID: ${communityId}) by ${founder}`);
  
  // Send to analytics
  analytics.track('Community Created', {
    communityId: communityId.toString(),
    name,
    founder,
    timestamp: Date.now()
  });
});
```

### Health Checks
```typescript
// pages/api/health.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    const blockNumber = await provider.getBlockNumber();
    
    res.status(200).json({
      status: 'healthy',
      network: process.env.NEXT_PUBLIC_NETWORK,
      blockNumber,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
}
```

## 🚀 Performance Optimization

### Caching Strategy
```typescript
// Cache community data with Redis
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const getCommunityWithCache = async (id: number) => {
  const cacheKey = `community:${id}`;
  
  // Try cache first
  let community = await redis.get(cacheKey);
  if (community) {
    return JSON.parse(community);
  }
  
  // Fetch from blockchain
  community = await registry.getCommunity(id);
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(community));
  
  return community;
};
```

### Batch Operations
```typescript
// Batch multiple community queries
const getCommunities = async (ids: number[]) => {
  const calls = ids.map(id => registry.getCommunity(id));
  return Promise.all(calls);
};
```

## 📱 Mobile App Features

### Core Screens
1. **Community Browser**: List all communities with search/filter
2. **Community Creation**: Form-based community deployment
3. **Community Dashboard**: Governance, proposals, claims
4. **Work Verification**: Submit claims, verify others' work
5. **Wallet Integration**: MetaMask, WalletConnect support

### Push Notifications
```typescript
import * as Notifications from 'expo-notifications';

// Register for proposal notifications
export const registerForProposalNotifications = async (communityId: number) => {
  const token = await Notifications.getExpoPushTokenAsync();
  
  // Subscribe to proposal events
  await fetch('/api/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      token: token.data,
      communityId,
      events: ['ProposalCreated', 'VotingStarted', 'ProposalExecuted']
    })
  });
};
```

## ✅ Testing & Validation

### Contract Testing
```bash
# Run full test suite
pnpm forge:test -vvv

# Check coverage (must be ≥86%)
pnpm cov:gate
```

### API Testing
```typescript
// Test community creation endpoint
describe('POST /api/communities/create', () => {
  it('should create community successfully', async () => {
    const response = await request(app)
      .post('/api/communities/create')
      .send({
        name: 'Test Community',
        description: 'Test Description',
        founderAddress: '0x1234...'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.communityId).toBeDefined();
  });
});
```

### Mobile App Testing
```bash
# Run Expo tests
npm test

# E2E testing with Detox
detox test --configuration ios.sim.debug
```

This deployment guide provides everything needed to integrate the Shift DeSoc smart contract system with a Next.js marketing site and Expo mobile app for seamless community deployment from mobile devices.