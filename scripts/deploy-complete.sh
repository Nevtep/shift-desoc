#!/bin/bash

# Shift DeSoc Deployment Script
# This script handles the complete deployment process for Base Sepolia

set -e

echo "🚀 Shift DeSoc Complete Deployment Pipeline"
echo "==========================================="

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create it from .env.example"
    exit 1
fi

# Load environment variables
source .env

# Check required environment variables
if [ -z "$PRIVATE_KEY" ] || [ -z "$RPC_BASE_SEPOLIA" ] || [ -z "$BASESCAN_API_KEY" ]; then
    echo "❌ Missing required environment variables. Check .env file:"
    echo "   - PRIVATE_KEY"
    echo "   - RPC_BASE_SEPOLIA" 
    echo "   - BASESCAN_API_KEY"
    exit 1
fi

echo "✅ Environment variables loaded"
echo "Network: Base Sepolia"
echo "RPC: $RPC_BASE_SEPOLIA"

# Step 1: Deploy Master Infrastructure
echo ""
echo "📋 STEP 1: Deploying Master Infrastructure..."
echo "============================================="
echo "This includes:"
echo "- CommunityRegistry (central registry)"
echo "- CountingMultiChoice (shared voting module)" 
echo "- CommunityFactory (factory for new communities)"
echo "- Template contracts for cloning"
echo ""
read -p "Deploy master infrastructure? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying master infrastructure..."
    npx hardhat run scripts/hardhat/deploy-master-infrastructure.ts --network base_sepolia
    
    echo ""
    echo "📋 Master infrastructure deployed!"
    echo "⚠️  IMPORTANT: Save the contract addresses from the output above."
    echo "⚠️  You'll need them for the next step."
    echo ""
else
    echo "Skipping master infrastructure deployment..."
fi

# Step 2: Create First Community
echo ""
echo "🏠 STEP 2: Creating First Community..."
echo "====================================="
echo "This will create a new community with the deployer as founder."
echo ""
read -p "Create first community? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "⚠️  Before proceeding:"
    echo "1. Update COMMUNITY_FACTORY_ADDRESS in scripts/hardhat/create-community.ts"
    echo "2. Update COMMUNITY_REGISTRY_ADDRESS in scripts/hardhat/create-community.ts"
    echo ""
    read -p "Have you updated the addresses in create-community.ts? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🏠 Creating first community..."
        npx hardhat run scripts/hardhat/create-community.ts --network base_sepolia
    else
        echo "❌ Please update the addresses first, then run:"
        echo "   npx hardhat run scripts/hardhat/create-community.ts --network base_sepolia"
    fi
else
    echo "Skipping community creation..."
fi

# Step 3: Verify Contracts
echo ""
echo "🔍 STEP 3: Contract Verification"
echo "================================"
echo "Verify deployed contracts on Basescan for transparency."
echo ""
read -p "Verify contracts on Basescan? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📝 To verify contracts, run these commands manually:"
    echo ""
    echo "# Verify CommunityRegistry"
    echo "npx hardhat verify --network base_sepolia <COMMUNITY_REGISTRY_ADDRESS> <CONSTRUCTOR_ARGS>"
    echo ""
    echo "# Verify CommunityFactory" 
    echo "npx hardhat verify --network base_sepolia <COMMUNITY_FACTORY_ADDRESS> <CONSTRUCTOR_ARGS>"
    echo ""
    echo "# Verify CountingMultiChoice"
    echo "npx hardhat verify --network base_sepolia <COUNTING_MULTICHOICE_ADDRESS>"
    echo ""
    echo "Replace <ADDRESS> and <CONSTRUCTOR_ARGS> with actual values from deployment output."
else
    echo "Skipping contract verification..."
fi

# Step 4: Post-Deployment Setup
echo ""
echo "⚙️ STEP 4: Post-Deployment Setup"
echo "================================"
echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. 💾 Save all contract addresses in a secure location"
echo "2. 🌐 Update frontend configuration with deployed addresses"
echo "3. 👥 Invite initial community members"
echo "4. 📝 Create first ValuableActions via governance"
echo "5. 💬 Post first request in RequestHub"
echo "6. 📄 Create and vote on first proposal"
echo ""
echo "🔗 Useful Resources:"
echo "- Base Sepolia Explorer: https://sepolia.basescan.org"
echo "- Network Info: https://docs.base.org/docs/network-information" 
echo "- Faucet: https://faucet.quicknode.com/base/sepolia"
echo ""
echo "✅ Deployment pipeline completed successfully!"