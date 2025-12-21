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

export function formatDate(value?: string | number | Date | null) {
  if (value === null || value === undefined) return "Unknown";

  if (value instanceof Date) {
    if (!Number.isNaN(value.valueOf())) return value.toLocaleString();
  }

  if (typeof value === "string") {
    if (!value.trim()) return "Unknown";
    const iso = new Date(value);
    if (!Number.isNaN(iso.valueOf())) return iso.toLocaleString();
  }

  const numeric = typeof value === "string" ? Number(value) : value;
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

export function normalizeDateString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "string" && value.length) {
    const d = new Date(value);
    if (!Number.isNaN(d.valueOf())) return d.toISOString();
  }

  if (typeof value === "number") {
    const millis = value < 1e12 ? value * 1000 : value;
    const d = new Date(millis);
    if (!Number.isNaN(d.valueOf())) return d.toISOString();
  }

  return undefined;
}

export function buildCommentTree<T extends { id: string | number; parentId?: string | number | null; createdAt?: string | number | Date | null }>(
  items: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();

  items.forEach((item) => {
    const key = item.parentId ? String(item.parentId) : "root";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  });

  map.forEach((list, key) => {
    const sorted = [...list].sort((a, b) => {
      const aDate = new Date(a.createdAt ?? "").valueOf();
      const bDate = new Date(b.createdAt ?? "").valueOf();
      return bDate - aDate;
    });
    map.set(key, sorted);
  });

  return map;
}
