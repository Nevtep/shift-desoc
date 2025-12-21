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
