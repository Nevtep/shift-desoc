export function statusBadge(status: string) {
  switch (status) {
    case "OPEN_DEBATE":
      return { label: "Open for debate", className: "bg-emerald-100 text-emerald-800" };
    case "FROZEN":
      return { label: "Frozen", className: "bg-amber-100 text-amber-800" };
    case "ARCHIVED":
      return { label: "Archived", className: "bg-slate-200 text-slate-700" };
    default:
      return { label: status, className: "bg-slate-100 text-slate-700" };
  }
}

export function formatDate(value?: string | number | null) {
  if (!value) return "Unknown";
  const numeric = typeof value === "string" ? Number(value) : value;

  // Handle ISO strings
  if (typeof value === "string") {
    const iso = new Date(value);
    if (!Number.isNaN(iso.valueOf())) return iso.toLocaleString();
  }

  // Handle numeric strings or numbers representing seconds/millis
  if (Number.isFinite(numeric)) {
    const d = new Date((numeric as number) < 1e12 ? (numeric as number) * 1000 : (numeric as number));
    if (!Number.isNaN(d.valueOf())) return d.toLocaleString();
  }

  return "Unknown";
}

export function shortAddress(addr?: string) {
  if (!addr || addr.length < 10) return addr ?? "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function isIpfsDocumentResponse(value: unknown): value is {
  cid: string;
  html: { body: string } | null;
  data: unknown;
  type: string;
  version: string;
  retrievedAt: string;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { cid?: unknown; html?: unknown; data?: unknown; type?: unknown; version?: unknown; retrievedAt?: unknown };
  return Boolean(
    candidate.cid &&
    "html" in candidate &&
    "data" in candidate &&
    candidate.type &&
    candidate.version &&
    candidate.retrievedAt
  );
}
