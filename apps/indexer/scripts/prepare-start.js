const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.join(__dirname, "../../../.env") });

const START_BLOCK_META_KEY = "shift_start_block";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RPC_CHECK_MAX_ATTEMPTS = 3;
const RPC_CHECK_BASE_DELAY_MS = 500;

async function tableExists(client, name) {
  const result = await client.query("select to_regclass($1) as reg", [name]);
  return Boolean(result.rows[0] && result.rows[0].reg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readRegistryCode(rpcUrl, registryAddress) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [registryAddress, "latest"],
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: `RPC status ${response.status}`,
    };
  }

  const result = await response.json();
  return {
    ok: true,
    status: response.status,
    code: result?.result,
    message: result?.error?.message,
  };
}

async function assertRegistryUsable(params) {
  const { rpcUrls, registryAddress, strict } = params;
  const usableUrls = rpcUrls.filter(Boolean);
  if (usableUrls.length === 0) {
    throw new Error("No RPC URL configured for registry usability check");
  }

  let lastRateLimit = null;
  let lastFailure = null;

  for (const rpcUrl of usableUrls) {
    for (let attempt = 1; attempt <= RPC_CHECK_MAX_ATTEMPTS; attempt += 1) {
      let result;
      try {
        result = await readRegistryCode(rpcUrl, registryAddress);
      } catch (error) {
        lastFailure = `RPC request failed for ${rpcUrl}: ${String(error)}`;
        break;
      }

      if (result.ok) {
        if (!result.code || result.code === "0x") {
          throw new Error("COMMUNITY_REGISTRY_ADDRESS has no deployed bytecode on selected network");
        }
        return;
      }

      if (result.status === 429) {
        lastRateLimit = `RPC rate limited (${result.status}) on ${rpcUrl}`;
        if (attempt < RPC_CHECK_MAX_ATTEMPTS) {
          await sleep(RPC_CHECK_BASE_DELAY_MS * attempt);
          continue;
        }
        break;
      }

      lastFailure = `Failed registry usability check at ${rpcUrl} with RPC status ${result.status}`;
      break;
    }
  }

  if (lastRateLimit && !strict) {
    console.warn(
      `[indexer] Skipping strict registry usability check due RPC rate limits. Last issue: ${lastRateLimit}`
    );
    return;
  }

  throw new Error(lastFailure ?? lastRateLimit ?? "Failed registry usability check");
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
  const fallbackRpcUrl =
    network === "base"
      ? process.env.RPC_BASE_FALLBACK
      : process.env.RPC_BASE_SEPOLIA_FALLBACK;
  const strictRpcCheck = process.env.INDEXER_STRICT_RPC_CHECK === "1";

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

  await assertRegistryUsable({
    rpcUrls: [rpcUrl, fallbackRpcUrl],
    registryAddress: registryAddressRaw,
    strict: strictRpcCheck,
  });

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
