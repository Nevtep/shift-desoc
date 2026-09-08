import { parseEventLogs, type Log } from "viem";

import { CONTRACTS } from "../contracts";

type ReceiptLike = {
  logs?: unknown;
} | null | undefined;

/**
 * Resolves the created Valuable Action id from a transaction receipt by
 * decoding the `ValuableActionCreated` event emitted by the registry.
 * Fails closed: if the event is missing, malformed, or undecodable, the
 * result is `null` and callers keep their existing failure handling.
 */
export function extractCreatedActionIdFromReceipt(receipt: ReceiptLike): number | null {
  const logs = receipt?.logs;
  if (!Array.isArray(logs)) return null;

  try {
    const events = parseEventLogs({
      abi: CONTRACTS.valuableActionRegistry.abi,
      eventName: "ValuableActionCreated",
      logs: logs as Log[],
      strict: false,
    });

    for (const event of events) {
      const id = (event.args as { id?: unknown } | undefined)?.id;
      if (typeof id === "bigint" && id > 0n && id <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(id);
      }
    }

    return null;
  } catch {
    return null;
  }
}
