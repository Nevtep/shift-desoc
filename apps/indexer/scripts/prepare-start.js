const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.join(__dirname, "../../../.env") });

const START_BLOCK_META_KEY = "shift_start_block";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function tableExists(client, name) {
  const result = await client.query("select to_regclass($1) as reg", [name]);
  return Boolean(result.rows[0] && result.rows[0].reg);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const startBlockRaw = process.env.COMMUNITY_REGISTRY_START_BLOCK;
  const registryAddressRaw = process.env.COMMUNITY_REGISTRY_ADDRESS;
  const network = process.env.PONDER_NETWORK ?? "base_sepolia";
  const rpcUrl =
    network === "base"
      ? process.env.RPC_BASE ?? "https://mainnet.base.org"
      : process.env.RPC_BASE_SEPOLIA ?? "https://sepolia.base.org";

  if (!registryAddressRaw) {
    throw new Error("Missing required env COMMUNITY_REGISTRY_ADDRESS");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(registryAddressRaw) || registryAddressRaw.toLowerCase() === ZERO_ADDRESS) {
    throw new Error("Invalid COMMUNITY_REGISTRY_ADDRESS");
  }

  if (!startBlockRaw) {
    throw new Error("Missing required env COMMUNITY_REGISTRY_START_BLOCK");
  }

  const startBlock = Number.parseInt(startBlockRaw, 10);
  if (!Number.isFinite(startBlock) || startBlock < 0) {
    throw new Error("Invalid COMMUNITY_REGISTRY_START_BLOCK");
  }

  const codeResponse = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [registryAddressRaw, "latest"],
    }),
  });

  if (!codeResponse.ok) {
    throw new Error(`Failed registry usability check with RPC status ${codeResponse.status}`);
  }

  const codeResult = await codeResponse.json();
  if (!codeResult?.result || codeResult.result === "0x") {
    throw new Error("COMMUNITY_REGISTRY_ADDRESS has no deployed bytecode on selected network");
  }

  if (!databaseUrl || !startBlockRaw) {
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const hasMetaTable = await tableExists(client, "_ponder_meta");
    if (!hasMetaTable) {
      return;
    }

    const existing = await client.query(
      'select value from "_ponder_meta" where key = $1 limit 1',
      [START_BLOCK_META_KEY]
    );

    const previousStartBlock = Number(existing.rows[0]?.value?.startBlock);
    const startBlockChanged =
      existing.rowCount === 0 || !Number.isFinite(previousStartBlock) || previousStartBlock !== startBlock;

    if (!startBlockChanged) {
      return;
    }

    await client.query("begin");

    // Reset app/status metadata so Ponder re-initializes from the configured start block.
    await client.query('delete from "_ponder_meta" where key like $1 or key like $2', ["app_%", "status_%"]);

    await client.query(
      'insert into "_ponder_meta" (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value',
      [START_BLOCK_META_KEY, JSON.stringify({ startBlock })]
    );

    await client.query("commit");

    console.log(
      `[indexer] PONDER_START_BLOCK changed (${Number.isFinite(previousStartBlock) ? previousStartBlock : "unset"} -> ${startBlock}). Cleared Ponder app/status metadata so indexing restarts from the configured block.`
    );
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[indexer] Failed to prepare Ponder startup:", error);
  process.exit(1);
});
