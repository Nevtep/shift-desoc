import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  GRAPHQL_URL: z.string().url().optional(),
  NEXT_PUBLIC_GRAPHQL_URL: z.string().url().optional(),
  INDEXER_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_INDEXER_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_CHAIN_IDS: z.string().optional(),
  RPC_BASE: z.string().url().optional(),
  RPC_BASE_SEPOLIA: z.string().url().optional(),
  PINATA_JWT: z.string().optional(),
  NEXT_PUBLIC_IPFS_GATEWAY: z.string().url().optional(),
  WALLETCONNECT_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional()
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (!cachedEnv) {
    const parsed = envSchema.parse({
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      GRAPHQL_URL: process.env.GRAPHQL_URL,
      NEXT_PUBLIC_GRAPHQL_URL: process.env.NEXT_PUBLIC_GRAPHQL_URL,
      INDEXER_API_URL: process.env.INDEXER_API_URL,
      NEXT_PUBLIC_INDEXER_API_URL: process.env.NEXT_PUBLIC_INDEXER_API_URL,
      NEXT_PUBLIC_CHAIN_IDS: process.env.NEXT_PUBLIC_CHAIN_IDS,
      RPC_BASE: process.env.RPC_BASE,
      RPC_BASE_SEPOLIA: process.env.RPC_BASE_SEPOLIA,
      PINATA_JWT: process.env.PINATA_JWT,
      NEXT_PUBLIC_IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY,
      WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
        process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    });
    cachedEnv = parsed;
  }

  return cachedEnv;
}

export type ShiftEnv = ReturnType<typeof getEnv>;
