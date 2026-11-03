import { parseEventLogs, type Abi, type Log } from "viem";

/** Finds the engagement id emitted by `Engagements.EngagementSubmitted` in a submit receipt. */
export function extractSubmittedEngagementId(
  logs: readonly Log[],
  abi: Abi,
  emitter: string
): number | null {
  const wanted = emitter.toLowerCase();
  const parsed = parseEventLogs({ abi, eventName: "EngagementSubmitted", logs: [...logs], strict: false });
  for (const log of parsed) {
    if (log.address.toLowerCase() !== wanted) continue;
    const id = (log.args as { engagementId?: bigint }).engagementId;
    if (typeof id === "bigint") return Number(id);
  }
  return null;
}
