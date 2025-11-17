#!/bin/bash

# E2E Test Runner for Base Sepolia Deployed Contracts
# This script runs comprehensive end-to-end tests against real deployed contracts

set -e  # Exit on any error

echo "🚀 Shift DeSoc E2E Test Runner"
echo "================================"
echo "Testing deployed contracts on Base Sepolia testnet"
echo ""

# Check if BASE_SEPOLIA_RPC_URL is set
if [ -z "$BASE_SEPOLIA_RPC_URL" ]; then
    echo "❌ Error: BASE_SEPOLIA_RPC_URL environment variable not set"
    echo "Please set your Base Sepolia RPC endpoint:"
    echo "export BASE_SEPOLIA_RPC_URL=\"https://sepolia.base.org\""
    echo "or add it to your .env file"
    exit 1
fi

echo "🔗 Using RPC: $BASE_SEPOLIA_RPC_URL"
echo ""

# Function to run Foundry tests
run_foundry_tests() {
    echo "🏗️ Running Foundry E2E Tests..."
    echo "================================"
    
    echo "📋 Test 1: Contract Connections"
    forge test --match-test testContractConnections --fork-url $BASE_SEPOLIA_RPC_URL -v
    
    echo ""
    echo "💰 Test 2: Token Balances"
    forge test --match-test testTokenBalances --fork-url $BASE_SEPOLIA_RPC_URL -v
    
    echo ""
    echo "🏛️ Test 3: Governance Workflow (Request → Draft → Proposal → Vote → Execute)"
    forge test --match-test testGovernanceWorkflow_RequestToDraftToProposalToExecution --fork-url $BASE_SEPOLIA_RPC_URL -vv
    
    echo ""
    echo "⚡ Test 4: Work Verification Workflow (Define → Claim → Verify → Reward)"
    forge test --match-test testWorkVerificationWorkflow_DefineActionToClaimToRewards --fork-url $BASE_SEPOLIA_RPC_URL -vv
    
    echo ""
    echo "🔄 Test 5: Integration Test (Governance → Work Verification)"
    forge test --match-test testIntegration_GovernanceCreatesActionThenWorkVerification --fork-url $BASE_SEPOLIA_RPC_URL -vv
}

# Function to run Hardhat tests  
run_hardhat_tests() {
    echo "📦 Running Hardhat E2E Tests..."
    echo "==============================="
    
    # Check if hardhat is available
    if ! command -v npx &> /dev/null; then
        echo "❌ Error: npx not found. Please install Node.js and npm/yarn"
        return 1
    fi
    
    echo "🔧 Running TypeScript E2E tests..."
    npx hardhat test test/E2EBaseSepolia.test.ts --network base_sepolia
}

# Parse command line arguments
FOUNDRY_ONLY=false
HARDHAT_ONLY=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --foundry-only)
            FOUNDRY_ONLY=true
            shift
            ;;
        --hardhat-only)
            HARDHAT_ONLY=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --foundry-only    Run only Foundry (Solidity) tests"
            echo "  --hardhat-only    Run only Hardhat (TypeScript) tests" 
            echo "  -v, --verbose     Verbose output"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  BASE_SEPOLIA_RPC_URL    Base Sepolia RPC endpoint (required)"
            echo ""
            echo "Examples:"
            echo "  $0                      # Run both Foundry and Hardhat tests"
            echo "  $0 --foundry-only       # Run only Foundry tests"
            echo "  $0 --hardhat-only       # Run only Hardhat tests"
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Main execution
echo "📊 Contract Addresses Being Tested:"
echo "===================================="
echo "CommunityRegistry:     0x67eC4cAcC44D80B43Ce7CCA63cEF6D1Ae3E57f8B"
echo "ShiftGovernor:         0x42362f0f2Cdd96902848e21d878927234C5C9425"
echo "MembershipToken:       0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb"
echo "ValuableActionRegistry: 0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2"
echo "Claims:                0xcd3fEfEE2dd2F3114742893f86D269740DF68B35"
echo "RequestHub:            0xc7d1d9db153e45f14ef3EbD86f02e986F1a18eCA"
echo "DraftsManager:         0xdd90c64f78D82cc6FD60DF756d96EFd6F4395c07"
echo ""

# Run tests based on options
if [ "$HARDHAT_ONLY" = true ]; then
    run_hardhat_tests
elif [ "$FOUNDRY_ONLY" = true ]; then
    run_foundry_tests
else
    echo "🔄 Running both Foundry and Hardhat E2E tests..."
    echo ""
    
    # Run Foundry tests first (faster)
    run_foundry_tests
    
    echo ""
    echo "================================================="
    echo ""
    
    # Then run Hardhat tests 
    run_hardhat_tests
fi

echo ""
echo "✅ E2E Test Suite Completed!"
echo "============================="
echo "🎯 Tested Workflows:"
echo "  ├── Request → Draft → Proposal → Vote → Execute"
echo "  ├── Define Action → Claim → Verify → Reward"
echo "  └── Governance ↔ Work Verification Integration"
echo ""
echo "📋 Validated Components:"
echo "  ├── Community coordination (RequestHub, DraftsManager)"
echo "  ├── Governance execution (ShiftGovernor, TimelockController)"
echo "  ├── Work verification (ValuableActionRegistry, Claims, VerifierPool)"
echo "  └── Token economics (MembershipToken, WorkerSBT, CommunityToken)"
echo ""
echo "🚀 Shift DeSoc Production-Ready MVP Verified on Base Sepolia!"