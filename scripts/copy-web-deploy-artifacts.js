// Bundles the Hardhat creation code + ABI the Manager deploy wizard needs into
// apps/web/lib/deploy/bundled-contracts so the web app builds from a clean clone
// (root artifacts/ is gitignored). Run after `pnpm hh:compile`.
//   node scripts/copy-web-deploy-artifacts.js          write the bundle
//   node scripts/copy-web-deploy-artifacts.js --check  fail if the bundle drifted
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const artifactsDir = path.join(root, "artifacts");
const destDir = path.join(root, "apps", "web", "lib", "deploy", "bundled-contracts");

const SOURCES = [
  "contracts/modules/factories/GovernanceLayerFactory.sol",
  "contracts/modules/factories/VerificationLayerFactory.sol",
  "contracts/modules/factories/EconomicLayerFactory.sol",
  "contracts/modules/factories/CommerceLayerFactory.sol",
  "contracts/modules/factories/CoordinationLayerFactory.sol",
  "contracts/tokens/MembershipTokenERC20Votes.sol",
  "contracts/core/ShiftTimelockController.sol",
  "contracts/core/ShiftGovernor.sol",
  "contracts/core/CountingMultiChoice.sol",
  "contracts/tokens/VerifierPowerToken1155.sol",
  "contracts/modules/VerifierElection.sol",
  "contracts/modules/VerifierManager.sol",
  "contracts/modules/ValuableActionRegistry.sol",
  "contracts/modules/ValuableActionSBT.sol",
  "contracts/modules/Engagements.sol",
  "contracts/modules/PositionManager.sol",
  "contracts/modules/CredentialManager.sol",
  "contracts/modules/CohortRegistry.sol",
  "contracts/modules/InvestmentCohortManager.sol",
  "contracts/modules/RevenueRouter.sol",
  "contracts/tokens/CommunityToken.sol",
  "contracts/modules/TreasuryAdapter.sol",
  "contracts/modules/CommerceDisputes.sol",
  "contracts/modules/Marketplace.sol",
  "contracts/modules/HousingManager.sol",
  "contracts/modules/ProjectFactory.sol",
  "contracts/modules/RequestHub.sol",
  "contracts/modules/DraftsManager.sol",
  "contracts/core/ShiftAccessManager.sol",
];

function render(sourceName) {
  const contractName = path.basename(sourceName, ".sol");
  const from = path.join(artifactsDir, sourceName, `${contractName}.json`);
  if (!fs.existsSync(from)) {
    throw new Error(`Missing Hardhat artifact ${path.relative(root, from)}. Run \`pnpm hh:compile\` first.`);
  }
  const artifact = JSON.parse(fs.readFileSync(from, "utf8"));
  if (!artifact.bytecode || artifact.bytecode === "0x") {
    throw new Error(`${contractName} has no creation bytecode`);
  }
  const bundled = { contractName, sourceName, abi: artifact.abi, bytecode: artifact.bytecode };
  return { contractName, content: `${JSON.stringify(bundled, null, 2)}\n` };
}

const check = process.argv.includes("--check");
const rendered = SOURCES.map(render);
const drifted = [];

if (!check) fs.mkdirSync(destDir, { recursive: true });

for (const { contractName, content } of rendered) {
  const to = path.join(destDir, `${contractName}.json`);
  if (check) {
    if (!fs.existsSync(to) || fs.readFileSync(to, "utf8") !== content) drifted.push(contractName);
    continue;
  }
  fs.writeFileSync(to, content);
}

if (check && drifted.length > 0) {
  console.error(
    `[copy-web-deploy-artifacts] Bundle is stale for: ${drifted.join(", ")}.\n` +
      "Run `pnpm hh:compile && node scripts/copy-web-deploy-artifacts.js` and commit the result."
  );
  process.exit(1);
}

console.log(`[copy-web-deploy-artifacts] ${check ? "Verified" : "Wrote"} ${rendered.length} artifacts in ${path.relative(root, destDir)}`);
