const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.join(__dirname, "../../../.env") });

const START_BLOCK_META_KEY = "shift_start_block";

async function tableExists(client, name) {
  const result = await client.query("select to_regclass($1) as reg", [name]);
  return Boolean(result.rows[0] && result.rows[0].reg);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const startBlockRaw = process.env.PONDER_START_BLOCK;

  if (!databaseUrl || !startBlockRaw) {
    return;
  }

  const startBlock = Number.parseInt(startBlockRaw, 10);
  if (!Number.isFinite(startBlock)) {
    console.warn(`[indexer] Ignoring invalid PONDER_START_BLOCK='${startBlockRaw}'.`);
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
