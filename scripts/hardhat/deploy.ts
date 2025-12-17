/**
 * Hardhat Deploy Script - Delegates to Complete Deployment System
 *
 * This script serves as the entry point for Hardhat-based deployments
 * and delegates to the comprehensive deployment system.
 */

const {
  ShiftDeSocDeployer,
  DEFAULT_CONFIG,
  NETWORK_CONFIGS,
} = require("../deploy-complete");

async function main() {
  const networkName = process.env.HARDHAT_NETWORK || "hardhat";
  console.log(`\n🌐 Hardhat deployment to network: ${networkName}`);

  // Build configuration using the same system as deploy-complete.ts
  let config = { ...DEFAULT_CONFIG };
  config.network = networkName;

  // Apply network-specific overrides
  const networkOverrides = NETWORK_CONFIGS[networkName];
  if (networkOverrides) {
    Object.assign(config, networkOverrides);
  }

  // Apply environment overrides
  if (process.env.COMMUNITY_NAME) {
    config.communityName = process.env.COMMUNITY_NAME;
  }
  if (process.env.FOUNDER_ADDRESS) {
    config.founderAddress = process.env.FOUNDER_ADDRESS;
  }

  console.log(`Deploying: ${config.communityName} on ${config.network}`);

  // Deploy using the complete system
  const deployer = new ShiftDeSocDeployer(config);
  await deployer.deploy();

  console.log(
    `\n🎉 Hardhat deployment to ${networkName} completed successfully!`,
  );
  console.log("Use 'npm run status' to check system status");
  console.log("Use 'npm run manage --help' for management commands");
}

// Run deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
