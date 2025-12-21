const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "out");
const destDir = path.join(root, "apps", "web", "abis");

const files = [
  { src: "CommunityRegistry.sol/CommunityRegistry.json", dest: "CommunityRegistry.json" },
  { src: "RequestHub.sol/RequestHub.json", dest: "RequestHub.json" },
  { src: "DraftsManager.sol/DraftsManager.json", dest: "DraftsManager.json" },
  { src: "ShiftGovernor.sol/ShiftGovernor.json", dest: "ShiftGovernor.json" },
  { src: "CountingMultiChoice.sol/CountingMultiChoice.json", dest: "CountingMultiChoice.json" },
  { src: "Claims.sol/Claims.json", dest: "Claims.json" },
  { src: "VerifierManager.sol/VerifierManager.json", dest: "VerifierManager.json" },
  { src: "ValuableActionRegistry.sol/ValuableActionRegistry.json", dest: "ValuableActionRegistry.json" }
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
