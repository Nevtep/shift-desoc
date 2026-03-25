import type { ParameterSummaryItem } from "../../../lib/community-overview/types";

export function ParameterSummary({ items }: { items: ParameterSummaryItem[] }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">Parameters summary</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{item.label}</span>
              <span>{item.value}</span>
            </div>
            <p className="text-xs text-muted-foreground">{item.source} · last checked {new Date(item.lastCheckedAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
