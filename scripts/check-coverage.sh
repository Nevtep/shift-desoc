#!/bin/bash

# scripts/check-coverage.sh
# Coverage enforcement script for Shift DeSoc smart contracts
# Requires ≥86% test coverage on core contracts

set -e

# Colors for output  
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

COVERAGE_THRESHOLD=86

echo -e "${YELLOW}🔍 Running coverage analysis for Shift DeSoc contracts...${NC}"
echo ""

# Change to foundry directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FOUNDRY_DIR="$PROJECT_ROOT/packages/foundry"
cd "$FOUNDRY_DIR"

# Generate coverage report
echo "📊 Generating coverage report..."
forge coverage --report summary > coverage_output.txt 2>&1

echo "📈 Core Contract Coverage Results:"
echo ""

# Core contracts that must meet coverage requirement
CORE_CONTRACTS=("CountingMultiChoice" "ShiftGovernor")
CORE_FAILURES=0
ALL_PASSED=true

for CONTRACT in "${CORE_CONTRACTS[@]}"; do
    # Look for the actual contract coverage (the ../../contracts/ version)
    CONTRACT_LINE=$(grep "../../contracts.*$CONTRACT\.sol" coverage_output.txt || echo "")
    
    if [ -n "$CONTRACT_LINE" ]; then
        # Extract line coverage percentage - the format is: | path | XX.XX% (n/m) | ...
        # Parse the third column which contains the line coverage percentage
        LINE_PCT=$(echo "$CONTRACT_LINE" | awk -F'|' '{gsub(/^ *| *$/,"",$3); print $3}' | grep -o '[0-9]\+\.[0-9]\+' | head -1)
        
        if [ -n "$LINE_PCT" ]; then
            # Convert to integer for comparison
            LINE_INT=$(echo "$LINE_PCT" | cut -d'.' -f1)
            
            if [ "$LINE_INT" -ge "$COVERAGE_THRESHOLD" ]; then
                echo -e "   ✅ $CONTRACT: ${LINE_PCT}% line coverage"
            else
                echo -e "   ❌ $CONTRACT: ${LINE_PCT}% line coverage (< ${COVERAGE_THRESHOLD}%)"
                CORE_FAILURES=$((CORE_FAILURES + 1))
                ALL_PASSED=false
            fi
        else
            echo -e "   ⚠️  $CONTRACT: Could not parse coverage percentage"
            CORE_FAILURES=$((CORE_FAILURES + 1))
            ALL_PASSED=false
        fi
    else
        echo -e "   ⚠️  $CONTRACT: Not found in coverage report"
        CORE_FAILURES=$((CORE_FAILURES + 1))
        ALL_PASSED=false
    fi
done

echo ""

# Extract overall coverage for reporting
TOTAL_LINE_PCT=$(grep "^| Total " coverage_output.txt | sed -n 's/.*| \+\([0-9]\+\.[0-9]\+\)% .*/\1/p')

if [ -n "$TOTAL_LINE_PCT" ]; then
    echo "📊 Overall Project Coverage: ${TOTAL_LINE_PCT}% lines"
else
    echo "📊 Overall Project Coverage: Unable to parse"
fi

echo ""

# Overall result
if [ "$ALL_PASSED" = true ] && [ "$CORE_FAILURES" -eq 0 ]; then
    echo -e "${GREEN}✅ Coverage check PASSED!${NC}"
    echo -e "${GREEN}   All core contracts meet the ${COVERAGE_THRESHOLD}% threshold${NC}"
    echo ""
    echo "🚀 Ready for deployment to Base Sepolia testnet!"
    EXIT_CODE=0
else
    echo -e "${RED}❌ Coverage check FAILED!${NC}"
    
    if [ "$CORE_FAILURES" -gt 0 ]; then
        echo -e "${RED}   $CORE_FAILURES core contract(s) below ${COVERAGE_THRESHOLD}% threshold${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}📝 To improve coverage:${NC}"
    echo "   1. Add more test cases for uncovered lines"
    echo "   2. Test edge cases and error conditions" 
    echo "   3. Ensure all functions have comprehensive tests"
    echo "   4. Run: forge test -vvv to see detailed output"
    echo ""
    EXIT_CODE=1
fi

# Show key contracts from detailed report for context
echo "📋 Core Contract Details:"
grep -E "(CountingMultiChoice|ShiftGovernor)" coverage_output.txt | grep "../../contracts" || echo "   No detailed coverage found"
echo ""

# Cleanup
rm -f coverage_output.txt

exit $EXIT_CODE
