#!/usr/bin/env node
/**
 * Verify Deployment Addresses
 * 
 * Quick script to verify deployment files are correctly formatted
 * and contain all required contract addresses.
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_ADDRESSES = [
  // Core Infrastructure (2)
  'communityRegistry',
  'paramController',
  
  // Governance System (4)
  'membershipToken',
  'timelock',
  'governor',
  'countingMultiChoice',
  
  // VPT System (3)
  'verifierPowerToken',
  'verifierElection',
  'verifierManager',
  
  // Work Verification (3)
  'valuableActionRegistry',
  'claims',
  'valuableActionSBT',
  
  // Economic Layer (4)
  'communityToken',
  'cohortRegistry',
  'revenueRouter',
  'treasuryAdapter',
  
  // Community Modules (6)
  'requestHub',
  'draftsManager',
  'commerceDisputes',
  'marketplace',
  'housingManager',
  'projectFactory',
];

function verifyDeploymentFile(filePath) {
  console.log(`\n🔍 Verifying: ${path.basename(filePath)}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Check required top-level fields
    const requiredFields = ['network', 'timestamp', 'deployer', 'addresses', 'configuration'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      console.error(`❌ Missing required fields: ${missingFields.join(', ')}`);
      return false;
    }
    
    console.log(`✅ Network: ${data.network}`);
    console.log(`✅ Deployer: ${data.deployer}`);
    console.log(`✅ Timestamp: ${data.timestamp}`);
    
    // Check all required contract addresses
    const missingAddresses = REQUIRED_ADDRESSES.filter(addr => !data.addresses[addr]);
    
    if (missingAddresses.length > 0) {
      console.error(`❌ Missing contract addresses: ${missingAddresses.join(', ')}`);
      return false;
    }
    
    // Verify all addresses are valid Ethereum addresses
    const invalidAddresses = Object.entries(data.addresses)
      .filter(([_, address]) => !/^0x[a-fA-F0-9]{40}$/.test(address))
      .map(([name, _]) => name);
    
    if (invalidAddresses.length > 0) {
      console.error(`❌ Invalid address format: ${invalidAddresses.join(', ')}`);
      return false;
    }
    
    console.log(`✅ All ${REQUIRED_ADDRESSES.length} contract addresses present and valid`);
    
    // Check configuration
    const requiredConfig = ['communityName', 'votingDelay', 'votingPeriod', 'revenueSplit'];
    const missingConfig = requiredConfig.filter(field => data.configuration[field] === undefined);
    
    if (missingConfig.length > 0) {
      console.warn(`⚠️  Missing configuration fields: ${missingConfig.join(', ')}`);
    } else {
      console.log(`✅ Configuration complete`);
    }
    
    console.log(`\n🎉 Deployment file is valid!`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error parsing file: ${error.message}`);
    return false;
  }
}

// Main execution
const deploymentsDir = path.join(__dirname, '..', 'deployments');
const networkArg = process.argv[2];

if (networkArg) {
  // Verify specific network
  const filePath = path.join(deploymentsDir, `${networkArg}.json`);
  const valid = verifyDeploymentFile(filePath);
  process.exit(valid ? 0 : 1);
} else {
  // Verify all deployment files
  console.log('🔍 Verifying all deployment files...\n');
  
  if (!fs.existsSync(deploymentsDir)) {
    console.error(`❌ Deployments directory not found: ${deploymentsDir}`);
    process.exit(1);
  }
  
  const files = fs.readdirSync(deploymentsDir)
    .filter(f => f.endsWith('.json') && f !== 'package.json');
  
  if (files.length === 0) {
    console.warn('⚠️  No deployment files found');
    process.exit(0);
  }
  
  let allValid = true;
  for (const file of files) {
    const valid = verifyDeploymentFile(path.join(deploymentsDir, file));
    allValid = allValid && valid;
  }
  
  console.log(`\n${'='.repeat(70)}`);
  if (allValid) {
    console.log('✅ All deployment files are valid!');
    process.exit(0);
  } else {
    console.log('❌ Some deployment files have errors');
    process.exit(1);
  }
}
