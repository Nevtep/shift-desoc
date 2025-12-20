# Shift DeSoc Deployment Addresses

This directory contains the deployed contract addresses for each network.

## File Structure

Each deployment creates two files:
- `{network}.json` - Network-specific deployment addresses
- `latest.json` - Most recent deployment (any network)

## File Format

```json
{
  "network": "base_sepolia",
  "timestamp": "2025-12-08T00:00:00.000Z",
  "deployer": "0x...",
  "communityId": 1,
  "addresses": {
    "communityRegistry": "0x...",
    "paramController": "0x...",
    // ... all 22 contract addresses
  },
  "configuration": {
    "communityName": "...",
    "votingDelay": 7200,
    "votingPeriod": 86400,
    "executionDelay": 21600,
    "revenueSplit": [60, 30, 10]
  }
}
```

## Usage

### Automatic Loading in Scripts

Management scripts automatically load addresses from these files:

```bash
# Addresses are loaded from deployments/base_sepolia.json
pnpm manage --network base_sepolia status
```

### Manual Loading

```typescript
const fs = require('fs');
const path = require('path');

const deploymentPath = path.join(__dirname, 'deployments', 'base_sepolia.json');
const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

const governorAddress = deployment.addresses.governor;
```

## Networks

- `base_sepolia.json` - Base Sepolia testnet
- `base.json` - Base mainnet (production)
- `ethereum_sepolia.json` - Ethereum Sepolia testnet
- `ethereum.json` - Ethereum mainnet (production)

## Deployment Process

When you run the deployment script:

```bash
pnpm deploy:base-sepolia
```

The script automatically:
1. Deploys all 22 contracts
2. Configures system integration
3. Bootstraps initial community
4. **Saves addresses to `deployments/base_sepolia.json`**
5. **Saves addresses to `deployments/latest.json`**

## Contract List

Each deployment file contains addresses for:

### Core Infrastructure (2)
- CommunityRegistry
- ParamController

### Governance System (4)
- MembershipToken
- TimelockController
- ShiftGovernor
- CountingMultiChoice

### VPT System (3)
- VerifierPowerToken1155
- VerifierElection
- VerifierManager

### Work Verification (3)
- ValuableActionRegistry
- Claims
- ValuableActionSBT

### Economic Layer (4)
- CommunityToken
- CohortRegistry
- RevenueRouter
- TreasuryAdapter

### Community Modules (6)
- RequestHub
- DraftsManager
- CommerceDisputes
- Marketplace
- HousingManager
- ProjectFactory

**Total: 22 contracts**

## Security Notes

- These files are **public** and committed to git
- They contain contract addresses only (no private keys)
- Use `.env` for sensitive configuration
- Verify addresses on block explorer before use

## Verification

After deployment, verify addresses on block explorer:
- Base Sepolia: https://sepolia.basescan.org/address/{address}
- Base: https://basescan.org/address/{address}
- Ethereum: https://etherscan.io/address/{address}
