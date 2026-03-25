export function formatSeconds(value: bigint | number | null | undefined): { display: string; raw: string | null } {
  if (value === null || value === undefined) return { display: "unavailable", raw: null };
  const seconds = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(seconds) || seconds < 0) return { display: "unavailable", raw: null };

  if (seconds < 60) return { display: `${seconds}s (${seconds} sec)`, raw: String(seconds) };
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) {
    const human = remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
    return { display: `${human} (${seconds} sec)`, raw: String(seconds) };
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  const human = remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
  return { display: `${human} (${seconds} sec)`, raw: String(seconds) };
}

export function formatBps(value: bigint | number | null | undefined): { display: string; raw: string | null } {
  if (value === null || value === undefined) return { display: "unavailable", raw: null };
  const bps = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(bps) || bps < 0) return { display: "unavailable", raw: null };
  const percentage = (bps / 100).toFixed(2).replace(/\.00$/, "");
  return { display: `${percentage}% (${bps} bps)`, raw: String(bps) };
}

export function formatIntegerThreshold(value: bigint | number | null | undefined): { display: string; raw: string | null } {
  if (value === null || value === undefined) return { display: "unavailable", raw: null };
  const numeric = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(numeric) || numeric < 0) return { display: "unavailable", raw: null };
  const whole = Math.trunc(numeric);
  return { display: String(whole), raw: String(whole) };
}

export function formatModuleAddress(address: string | null | undefined): string {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return "unavailable";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
