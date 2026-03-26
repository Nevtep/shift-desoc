const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "out");
const destDir = path.join(root, "apps", "web", "abis");
const contractsDir = path.join(root, "contracts");

function walkSolidityFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSolidityFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".sol")) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectProtocolContractNames() {
  const solidityFiles = walkSolidityFiles(contractsDir);
  const names = solidityFiles.map((filePath) => path.basename(filePath, ".sol"));
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) {
    const uniqueDuplicates = [...new Set(duplicates)].sort();
    throw new Error(
      `Duplicate contract base names found in contracts/: ${uniqueDuplicates.join(", ")}. ` +
        "ABI copier requires unique .sol base names to map out/<Name>.sol/<Name>.json."
    );
  }
  return names.sort();
}

function clearJsonFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const fileName of fs.readdirSync(dir)) {
    if (fileName.endsWith(".json")) {
      fs.unlinkSync(path.join(dir, fileName));
    }
  }
}

fs.mkdirSync(destDir, { recursive: true });
clearJsonFiles(destDir);

const contractNames = collectProtocolContractNames();
const copied = [];
const missing = [];

for (const name of contractNames) {
  const from = path.join(outDir, `${name}.sol`, `${name}.json`);
  const to = path.join(destDir, `${name}.json`);

  if (!fs.existsSync(from)) {
    missing.push(`${name}.sol/${name}.json`);
    continue;
  }

  fs.copyFileSync(from, to);
  copied.push(name);
}

if (copied.length === 0) {
  throw new Error("No ABI files copied to apps/web/abis. Run `forge build` first.");
}

if (missing.length > 0) {
  console.warn(
    `[copy-web-abis] Missing ${missing.length} compiled ABI files in out/:\n` +
      missing.map((item) => `  - ${item}`).join("\n")
  );
}

console.log(`Copied ${copied.length} ABI files to ${destDir}`);
