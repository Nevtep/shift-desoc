import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "src", "index.ts");
const abiDir = path.join(root, "abis");

const source = fs.readFileSync(indexPath, "utf8");
const matches = Array.from(source.matchAll(/ponder\.on\("([A-Za-z0-9_]+):([A-Za-z0-9_]+)"/g));

const byContract = new Map<string, Set<string>>();
for (const match of matches) {
  const contract = match[1]!;
  const eventName = match[2]!;
  if (!byContract.has(contract)) byContract.set(contract, new Set());
  byContract.get(contract)!.add(eventName);
}

const failures: string[] = [];
for (const [contract, events] of byContract.entries()) {
  const abiFile = path.join(abiDir, `${contract}.json`);
  if (!fs.existsSync(abiFile)) {
    failures.push(`Missing ABI file for contract ${contract}`);
    continue;
  }

  const parsed = JSON.parse(fs.readFileSync(abiFile, "utf8"));
  const abi = parsed.abi as Array<{ type?: string; name?: string }>;
  const eventNames = new Set(abi.filter((x) => x.type === "event").map((x) => x.name));

  for (const eventName of events) {
    if (!eventNames.has(eventName)) {
      failures.push(`Missing event ${contract}:${eventName} in ${contract}.json`);
    }
  }
}

if (failures.length > 0) {
  console.error("ABI/event compatibility check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`ABI/event compatibility check passed for ${byContract.size} contracts.`);
