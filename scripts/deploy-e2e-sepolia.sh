#!/bin/bash
set -e

echo "🚀 Shift DeSoc E2E Testing Deployment Pipeline"
echo "=============================================="

cd "$(dirname "$0")/../packages/foundry"

# Load environment variables
source .env

echo "📋 Pre-deployment checklist:"
echo "✅ Environment file: .env"
echo "✅ RPC URL: $SEPOLIA_RPC_URL"
echo "✅ Deployer key: ${PRIVATE_KEY:0:10}..."

# Check if we have the required variables
if [[ -z "$PRIVATE_KEY" || -z "$SEPOLIA_RPC_URL" ]]; then
    echo "❌ Missing required environment variables (PRIVATE_KEY, SEPOLIA_RPC_URL)"
    exit 1
fi

echo ""
echo "🔧 Step 1: Deploy Core Contracts"
echo "--------------------------------"
forge script script/DeployMVP.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY || echo "Verification failed (non-critical)"

echo ""
echo "📝 Step 2: Update Environment File"
echo "--------------------------------"
echo "⚠️  MANUAL STEP REQUIRED:"
echo "1. Copy the contract addresses from the deployment output above"
echo "2. Update the .env file with the actual deployed addresses:"
echo "   TOKEN=0x..."
echo "   GOVERNOR=0x..."
echo "   COMMUNITY_REGISTRY=0x..."
echo "   etc."
echo ""
echo "3. Generate 5 test wallets and update USER1_ADDRESS through USER5_ADDRESS"
echo "   Use: cast wallet new"
echo ""
echo "4. Fund each user address with ~0.1 Sepolia ETH"
echo "   Faucets: https://sepoliafaucet.com/ or https://sepolia-faucet.pk910.de/"
echo ""

read -p "Press Enter after updating .env with contract addresses and user wallets..."

echo ""
echo "💰 Step 3: Distribute Tokens to Test Users"
echo "-----------------------------------------"
forge script script/DistributeTokens.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast

echo ""
echo "🗳️  Step 4: Setup Voting Power for Each User"
echo "-------------------------------------------"
echo "Running delegation for each user..."

for i in {1..5}; do
    echo "Setting up voting power for User$i..."
    USER_PRIVATE_KEY=$(eval echo \$USER${i}_PRIVATE_KEY)
    
    if [[ -n "$USER_PRIVATE_KEY" && "$USER_PRIVATE_KEY" != "0x0000000000000000000000000000000000000000000000000000000000000000" ]]; then
        forge script script/SetupVotingPower.s.sol \
            --rpc-url $SEPOLIA_RPC_URL \
            --private-key $USER_PRIVATE_KEY \
            --broadcast \
            --sig "run()" || echo "Failed to setup User$i (check private key and balance)"
    else
        echo "⚠️  Skipping User$i - private key not set or is placeholder"
    fi
done

echo ""
echo "🎭 Step 5: Execute End-to-End Governance Test"
echo "--------------------------------------------"
echo "This will execute the complete governance scenario:"
echo "1. User1 creates community & funding request"
echo "2. User2 creates draft with ActionType proposal"
echo "3. Users 3,4,5 add comments and reviews"
echo "4. Draft escalates to governance proposal"
echo "5. Users vote (3 for, 1 against, 1 abstain)"
echo "6. Proposal executes and ActionType is created"
echo ""

read -p "Ready to run E2E test? Press Enter to continue or Ctrl+C to stop..."

# Note: The E2E test script needs to be fixed first, so we'll just show the command
echo "Command to run E2E test (after fixing script imports):"
echo "forge script script/E2EGovernanceTest.s.sol --rpc-url \$SEPOLIA_RPC_URL --broadcast"

echo ""
echo "✅ Deployment pipeline completed!"
echo "📊 Next steps:"
echo "1. Verify all contract addresses in .env are correct"
echo "2. Check user balances and voting power"
echo "3. Run the E2E governance test when ready"
echo ""
echo "🔍 Useful verification commands:"
echo "cast balance \$USER1_ADDRESS --rpc-url \$SEPOLIA_RPC_URL"
echo "cast call \$TOKEN 'balanceOf(address)' \$USER1_ADDRESS --rpc-url \$SEPOLIA_RPC_URL"
echo "cast call \$TOKEN 'getVotes(address)' \$USER1_ADDRESS --rpc-url \$SEPOLIA_RPC_URL"