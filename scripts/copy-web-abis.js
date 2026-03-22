const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "out");
const destDir = path.join(root, "apps", "web", "abis");

const files = [
  // Shared infra
  { src: "CommunityRegistry.sol/CommunityRegistry.json", dest: "CommunityRegistry.json" },
  { src: "ParamController.sol/ParamController.json", dest: "ParamController.json" },
  { src: "AccessManager.sol/AccessManager.json", dest: "AccessManager.json" },

  // Governance / coordination / verification / economic modules used by web flows
  { src: "RequestHub.sol/RequestHub.json", dest: "RequestHub.json" },
  { src: "DraftsManager.sol/DraftsManager.json", dest: "DraftsManager.json" },
  { src: "ShiftGovernor.sol/ShiftGovernor.json", dest: "ShiftGovernor.json" },
  { src: "ShiftTimelockController.sol/ShiftTimelockController.json", dest: "ShiftTimelockController.json" },
  { src: "CountingMultiChoice.sol/CountingMultiChoice.json", dest: "CountingMultiChoice.json" },
  { src: "Engagements.sol/Engagements.json", dest: "Engagements.json" },
  { src: "PositionManager.sol/PositionManager.json", dest: "PositionManager.json" },
  { src: "VerifierManager.sol/VerifierManager.json", dest: "VerifierManager.json" },
  { src: "VerifierElection.sol/VerifierElection.json", dest: "VerifierElection.json" },
  { src: "VerifierPowerToken1155.sol/VerifierPowerToken1155.json", dest: "VerifierPowerToken1155.json" },
  { src: "ValuableActionRegistry.sol/ValuableActionRegistry.json", dest: "ValuableActionRegistry.json" },
  { src: "ValuableActionSBT.sol/ValuableActionSBT.json", dest: "ValuableActionSBT.json" },
  { src: "TreasuryAdapter.sol/TreasuryAdapter.json", dest: "TreasuryAdapter.json" },
  { src: "CommunityToken.sol/CommunityToken.json", dest: "CommunityToken.json" },
  { src: "Marketplace.sol/Marketplace.json", dest: "Marketplace.json" },
  { src: "RevenueRouter.sol/RevenueRouter.json", dest: "RevenueRouter.json" },
  { src: "BootstrapCoordinator.sol/BootstrapCoordinator.json", dest: "BootstrapCoordinator.json" },

  // Layer factories
  { src: "GovernanceLayerFactory.sol/GovernanceLayerFactory.json", dest: "GovernanceLayerFactory.json" },
  { src: "VerificationLayerFactory.sol/VerificationLayerFactory.json", dest: "VerificationLayerFactory.json" },
  { src: "EconomicLayerFactory.sol/EconomicLayerFactory.json", dest: "EconomicLayerFactory.json" },
  { src: "CommerceLayerFactory.sol/CommerceLayerFactory.json", dest: "CommerceLayerFactory.json" },
  { src: "CoordinationLayerFactory.sol/CoordinationLayerFactory.json", dest: "CoordinationLayerFactory.json" }
];

fs.mkdirSync(destDir, { recursive: true });

files.forEach(({ src, dest }) => {
  const from = path.join(outDir, src);
  const to = path.join(destDir, dest);

  if (!fs.existsSync(from)) {
    throw new Error(`ABI not found at ${from}`);
  }

  fs.copyFileSync(from, to);
});

console.log(`Copied ${files.length} ABI files to ${destDir}`);
