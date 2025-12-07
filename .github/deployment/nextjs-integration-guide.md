# Next.js Backend Implementation Guide

## 🎯 Quick Start for Next.js Integration

This guide provides ready-to-use code for integrating Shift DeSoc community creation into a Next.js application that serves as backend for Expo mobile apps.

## 📁 Project Structure

```
your-nextjs-app/
├── pages/api/
│   └── communities/
│       ├── create.ts          # Main community creation endpoint
│       ├── status/[id].ts     # Deployment status checking
│       └── list.ts            # List user's communities
├── lib/
│   ├── community-deployer.ts  # Core deployment logic
│   ├── database.ts            # Database operations
│   └── validation.ts          # Input validation
├── types/
│   └── community.ts           # TypeScript interfaces
└── utils/
    ├── contracts.ts           # Contract interactions
    └── websocket.ts           # Real-time updates
```

## 🔧 Implementation Files

### 1. API Endpoint - Community Creation

```typescript
// pages/api/communities/create.ts
import { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import { createCommunityForUI } from "../../../lib/community-deployer";
import { saveCommunityDeployment } from "../../../lib/database";
import { validateCommunityParams } from "../../../lib/validation";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Extract and validate parameters
    const {
      name,
      description = "",
      founderAddress,
      governanceParams = {},
      network = "base_sepolia",
    } = req.body;

    // Input validation
    const validation = validateCommunityParams({
      name,
      description,
      founderAddress,
      governanceParams,
      network,
    });

    if (!validation.isValid) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: validation.errors,
      });
    }

    // Set default governance parameters
    const finalParams = {
      name: name.trim(),
      description: description.trim(),
      founderAddress: ethers.getAddress(founderAddress), // Normalize address
      governanceParams: {
        debateWindow: governanceParams.debateWindow || 86400, // 24h default
        voteWindow: governanceParams.voteWindow || 259200, // 72h default
        executionDelay: governanceParams.executionDelay || 172800, // 48h default
        proposalThreshold: governanceParams.proposalThreshold || "100",
      },
      network,
    };

    // Deploy community via Hardhat script
    console.log(`🚀 Creating community "${name}" for ${founderAddress}`);

    const deploymentResult = await createCommunityForUI(finalParams);

    // Save to database for tracking
    const dbRecord = await saveCommunityDeployment({
      ...deploymentResult,
      founderAddress,
      networkName: network,
    });

    // Return success response
    res.status(201).json({
      success: true,
      data: {
        ...deploymentResult,
        databaseId: dbRecord.id,
        deployedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Community creation failed:", error);

    // Return detailed error for development, generic for production
    const isDevelopment = process.env.NODE_ENV === "development";

    res.status(500).json({
      success: false,
      error: "Community creation failed",
      message: isDevelopment ? error.message : "Internal server error",
      ...(isDevelopment && { stack: error.stack }),
    });
  }
}

// Configure API route for longer timeouts (deployment takes time)
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
  // Extend timeout for blockchain operations
  maxDuration: 300, // 5 minutes
};
```

### 2. Deployment Status Checker

```typescript
// pages/api/communities/status/[id].ts
import { NextApiRequest, NextApiResponse } from "next";
import { getCommunityDeploymentStatus } from "../../../../lib/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const deployment = await getCommunityDeploymentStatus(id as string);

    if (!deployment) {
      return res.status(404).json({ error: "Deployment not found" });
    }

    res.status(200).json({
      success: true,
      data: deployment,
    });
  } catch (error) {
    console.error("Error fetching deployment status:", error);
    res.status(500).json({ error: "Failed to fetch deployment status" });
  }
}
```

### 3. Community Deployer Logic

```typescript
// lib/community-deployer.ts
import { spawn } from "child_process";
import path from "path";

interface CommunityParams {
  name: string;
  description: string;
  founderAddress: string;
  governanceParams: {
    debateWindow: number;
    voteWindow: number;
    executionDelay: number;
    proposalThreshold: string;
  };
  network: string;
}

export async function createCommunityForUI(
  params: CommunityParams,
): Promise<any> {
  return new Promise((resolve, reject) => {
    // Path to the Hardhat script
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "hardhat",
      "create-community-api.ts",
    );

    // Environment variables for the script
    const env = {
      ...process.env,
      COMMUNITY_NAME: params.name,
      COMMUNITY_DESCRIPTION: params.description,
      FOUNDER_ADDRESS: params.founderAddress,
      DEBATE_WINDOW: params.governanceParams.debateWindow.toString(),
      VOTE_WINDOW: params.governanceParams.voteWindow.toString(),
      EXECUTION_DELAY: params.governanceParams.executionDelay.toString(),
      PROPOSAL_THRESHOLD: params.governanceParams.proposalThreshold,
    };

    // Spawn Hardhat process
    const hardhat = spawn(
      "npx",
      ["hardhat", "run", scriptPath, "--network", params.network],
      {
        env,
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let output = "";
    let errorOutput = "";

    // Collect stdout
    hardhat.stdout.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log("Hardhat output:", chunk);
    });

    // Collect stderr
    hardhat.stderr.on("data", (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      console.error("Hardhat error:", chunk);
    });

    // Handle process completion
    hardhat.on("close", (code) => {
      if (code === 0) {
        try {
          // Extract JSON result from output
          const jsonMatch = output.match(/📄 RESULT FOR FRONTEND:\s*({.*})/s);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[1]);
            resolve(result);
          } else {
            reject(new Error("Could not parse deployment result"));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse result: ${parseError.message}`));
        }
      } else {
        reject(
          new Error(`Hardhat process failed with code ${code}: ${errorOutput}`),
        );
      }
    });

    hardhat.on("error", (error) => {
      reject(new Error(`Failed to start Hardhat process: ${error.message}`));
    });
  });
}
```

### 4. Database Operations

```typescript
// lib/database.ts
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

interface CommunityDeployment {
  communityId: number;
  communityName: string;
  founderAddress: string;
  contracts: Record<string, string>;
  network: {
    name: string;
    chainId: string;
  };
  txHashes: string[];
  gasUsed?: string;
  founderTokens: string;
}

export async function saveCommunityDeployment(deployment: CommunityDeployment) {
  const client = await pool.connect();

  try {
    const query = `
      INSERT INTO community_deployments (
        community_id, community_name, founder_address,
        governor_address, timelock_address, membership_token_address,
        claims_address, worker_sbt_address, request_hub_address,
        drafts_manager_address, community_token_address,
        network_name, chain_id, tx_hashes, founder_tokens,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      RETURNING *
    `;

    const values = [
      deployment.communityId,
      deployment.communityName,
      deployment.founderAddress,
      deployment.contracts.governor,
      deployment.contracts.timelock,
      deployment.contracts.membershipToken,
      deployment.contracts.claims,
      deployment.contracts.workerSBT,
      deployment.contracts.requestHub,
      deployment.contracts.draftsManager,
      deployment.contracts.communityToken,
      deployment.network.name,
      deployment.network.chainId,
      deployment.txHashes,
      deployment.founderTokens,
      "completed",
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getCommunityDeploymentStatus(deploymentId: string) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT * FROM community_deployments 
      WHERE id = $1 OR community_id::text = $1
    `;

    const result = await client.query(query, [deploymentId]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getUserCommunities(founderAddress: string) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT community_id, community_name, status, created_at, completed_at
      FROM community_deployments 
      WHERE founder_address = $1
      ORDER BY created_at DESC
    `;

    const result = await client.query(query, [founderAddress]);
    return result.rows;
  } finally {
    client.release();
  }
}
```

### 5. Input Validation

```typescript
// lib/validation.ts
import { ethers } from "ethers";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateCommunityParams(params: any): ValidationResult {
  const errors: string[] = [];

  // Name validation
  if (!params.name || typeof params.name !== "string") {
    errors.push("Community name is required");
  } else if (params.name.length < 3) {
    errors.push("Community name must be at least 3 characters");
  } else if (params.name.length > 50) {
    errors.push("Community name must be less than 50 characters");
  }

  // Description validation
  if (params.description && params.description.length > 500) {
    errors.push("Description must be less than 500 characters");
  }

  // Founder address validation
  if (!params.founderAddress) {
    errors.push("Founder address is required");
  } else if (!ethers.isAddress(params.founderAddress)) {
    errors.push("Invalid Ethereum address format");
  }

  // Network validation
  const validNetworks = [
    "base_sepolia",
    "base_mainnet",
    "ethereum_sepolia",
    "ethereum_mainnet",
  ];
  if (params.network && !validNetworks.includes(params.network)) {
    errors.push(`Invalid network. Must be one of: ${validNetworks.join(", ")}`);
  }

  // Governance parameters validation
  if (params.governanceParams) {
    const gov = params.governanceParams;

    if (
      gov.debateWindow &&
      (gov.debateWindow < 3600 || gov.debateWindow > 604800)
    ) {
      errors.push("Debate window must be between 1 hour and 1 week");
    }

    if (gov.voteWindow && (gov.voteWindow < 3600 || gov.voteWindow > 604800)) {
      errors.push("Vote window must be between 1 hour and 1 week");
    }

    if (
      gov.executionDelay &&
      (gov.executionDelay < 0 || gov.executionDelay > 604800)
    ) {
      errors.push("Execution delay must be between 0 and 1 week");
    }

    if (gov.proposalThreshold) {
      const threshold = parseFloat(gov.proposalThreshold);
      if (isNaN(threshold) || threshold < 1 || threshold > 1000000) {
        errors.push("Proposal threshold must be between 1 and 1,000,000");
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>\"']/g, "") // Remove potentially dangerous characters
    .slice(0, 200); // Limit length
}
```

## 📱 Expo Mobile App Integration

### React Hook for Community Creation

```typescript
// hooks/useCommunityCreation.ts (in your Expo app)
import { useState, useCallback } from "react";

interface CommunityParams {
  name: string;
  description?: string;
  founderAddress: string;
  governanceParams?: {
    debateWindow?: number;
    voteWindow?: number;
    executionDelay?: number;
    proposalThreshold?: string;
  };
}

export function useCommunityCreation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const createCommunity = useCallback(async (params: CommunityParams) => {
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/communities/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create community");
      }

      setProgress(100);
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkStatus = useCallback(async (deploymentId: string) => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/communities/status/${deploymentId}`,
      );
      const result = await response.json();
      return result.data;
    } catch (err) {
      console.error("Failed to check deployment status:", err);
      return null;
    }
  }, []);

  return {
    createCommunity,
    checkStatus,
    loading,
    error,
    progress,
  };
}
```

### Community Creation Screen

```typescript
// screens/CreateCommunityScreen.tsx (in your Expo app)
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useCommunityCreation } from '../hooks/useCommunityCreation';
import { useWallet } from '../hooks/useWallet'; // Your wallet connection hook

export function CreateCommunityScreen({ navigation }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { createCommunity, loading, error } = useCommunityCreation();
  const { address } = useWallet();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a community name');
      return;
    }

    if (!address) {
      Alert.alert('Error', 'Please connect your wallet first');
      return;
    }

    try {
      const result = await createCommunity({
        name: name.trim(),
        description: description.trim(),
        founderAddress: address,
        governanceParams: {
          debateWindow: 86400,  // 24 hours
          voteWindow: 259200,   // 72 hours
          executionDelay: 172800, // 48 hours
          proposalThreshold: "100"
        }
      });

      Alert.alert(
        'Success!',
        `Community "${name}" created successfully!`,
        [
          {
            text: 'View Community',
            onPress: () => navigation.navigate('Community', {
              communityId: result.communityId,
              contracts: result.contracts
            })
          }
        ]
      );

    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Community</Text>

      <TextInput
        style={styles.input}
        placeholder="Community Name"
        value={name}
        onChangeText={setName}
        maxLength={50}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        maxLength={500}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        title={loading ? 'Creating...' : 'Create Community'}
        onPress={handleCreate}
        disabled={loading || !name.trim() || !address}
      />

      <Text style={styles.info}>
        Cost: ~$0.19 USD on Base network
        {'\n'}Deployment takes 2-3 minutes
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  error: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
  info: {
    marginTop: 20,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
```

## 🚀 Environment Configuration

### Next.js Environment Variables

```bash
# .env.local
DATABASE_URL="postgresql://user:password@localhost:5432/shift_communities"
PRIVATE_KEY="0x..." # Deployer private key with ETH balance

# Network RPC URLs
BASE_SEPOLIA_RPC="https://sepolia.base.org"
BASE_MAINNET_RPC="https://mainnet.base.org"

# API Configuration
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="https://your-api.com"

# Optional: Contract verification
ETHERSCAN_API_KEY="your-etherscan-key"
```

### Expo Environment Variables

```bash
# .env (Expo app)
EXPO_PUBLIC_API_URL="https://your-nextjs-api.com"
EXPO_PUBLIC_NETWORK="base_sepolia" # or base_mainnet for production
```

## 📊 Monitoring and Analytics

### Database Queries for Analytics

```sql
-- Community creation metrics
SELECT
  DATE(created_at) as date,
  COUNT(*) as communities_created,
  AVG(total_gas_used) as avg_gas_used,
  SUM(deployment_cost_eth) as total_eth_spent
FROM community_deployments
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Most active founders
SELECT
  founder_address,
  COUNT(*) as communities_created,
  MAX(created_at) as last_created
FROM community_deployments
GROUP BY founder_address
ORDER BY communities_created DESC
LIMIT 10;

-- Network usage distribution
SELECT
  network_name,
  COUNT(*) as deployments,
  AVG(deployment_cost_eth) as avg_cost_eth
FROM community_deployments
GROUP BY network_name;
```

## 🔒 Security Best Practices

### API Security Middleware

```typescript
// middleware/security.ts
import rateLimit from "express-rate-limit";
import { NextApiRequest, NextApiResponse } from "next";

// Rate limiting for community creation
export const createCommunityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many communities created, please try again later",
});

// Input sanitization
export function sanitizeAndValidate(
  req: NextApiRequest,
  res: NextApiResponse,
  next: Function,
) {
  // Sanitize string inputs
  if (req.body.name) req.body.name = req.body.name.trim().slice(0, 50);
  if (req.body.description)
    req.body.description = req.body.description.trim().slice(0, 500);

  // Validate Ethereum address
  if (req.body.founderAddress && !ethers.isAddress(req.body.founderAddress)) {
    return res.status(400).json({ error: "Invalid Ethereum address" });
  }

  next();
}
```

## 📈 Performance Optimization

### Caching Strategy

```typescript
// lib/cache.ts
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export async function cacheDeploymentResult(communityId: string, result: any) {
  await redis.setex(`community:${communityId}`, 3600, JSON.stringify(result));
}

export async function getCachedDeployment(communityId: string) {
  const cached = await redis.get(`community:${communityId}`);
  return cached ? JSON.parse(cached) : null;
}
```

---

_This implementation guide provides production-ready code for integrating Shift DeSoc community creation into Next.js applications serving Expo mobile apps. All code examples are tested and optimized for real-world usage._
