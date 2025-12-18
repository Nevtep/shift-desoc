import { defineConfig } from "@ponder/core";

export default defineConfig({
  networks: {
    base: {
      chainId: 8453,
      rpcUrl: process.env.RPC_BASE ?? "https://mainnet.base.org"
    },
    base_sepolia: {
      chainId: 84532,
      rpcUrl: process.env.RPC_BASE_SEPOLIA ?? "https://sepolia.base.org"
    }
  },
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/shift"
  }
});
