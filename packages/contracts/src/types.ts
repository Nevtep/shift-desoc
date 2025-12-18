import { z } from "zod";

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, "Expected EVM address");

export const deploymentSchema = z.object({
  network: z.string(),
  timestamp: z.string().optional(),
  deployer: addressSchema.optional(),
  communityId: z.number().int().positive().optional(),
  addresses: z.record(addressSchema),
  configuration: z.record(z.unknown()).optional()
});

export type Deployment = z.infer<typeof deploymentSchema>;

export type AddressBook = Deployment["addresses"];

export type DeploymentLoadOptions = {
  /** Network key, e.g. "base" or "base_sepolia" */
  network?: string;
  /** Chain ID override (8453 → base, 84532 → base_sepolia) */
  chainId?: number;
  /**
   * Absolute path to deployments directory. Defaults to
   * process.env.SHIFT_DEPLOYMENTS_PATH or `<repo>/deployments`.
   */
  deploymentsDir?: string;
  /** Optional fallback network if primary lookup fails. */
  fallbackNetwork?: string;
};
