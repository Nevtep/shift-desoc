export const TOTAL_BPS = 10_000;

export function sumBps(weights: number[]): number {
  return weights.reduce((acc, value) => acc + value, 0);
}

export function isValidBpsValue(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= TOTAL_BPS;
}

export function isExactTotalBps(weights: number[]): boolean {
  if (!weights.length) return false;
  if (!weights.every(isValidBpsValue)) return false;
  return sumBps(weights) === TOTAL_BPS;
}

export function bpsToPercentLabel(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function percentToBps(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const bps = Math.round(parsed * 100);
  if (bps < 0) return 0;
  if (bps > TOTAL_BPS) return TOTAL_BPS;
  return bps;
}

export function toContractWeightsBps(weights: number[]): bigint[] {
  return weights.map((weight) => BigInt(weight));
}
