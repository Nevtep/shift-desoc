import type { ModuleSummaryItem } from "../../../lib/community-overview/types";

export function ModuleSummary({ items }: { items: ModuleSummaryItem[] }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">Modules summary</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.moduleKey} className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="font-medium">{item.label}</span>
            <span className="text-muted-foreground">{item.shortAddress}</span>
            <span className={item.status === "present" ? "text-emerald-700" : "text-amber-700"}>{item.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
