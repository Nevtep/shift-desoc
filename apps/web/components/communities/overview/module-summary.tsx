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
            <div className="flex items-center gap-2">
              {item.moduleKey === "treasuryVault" && item.status === "present" ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {item.source === "EOA treasury vault" ? "EOA" : "Contract"}
                </span>
              ) : null}
              <span className={item.status === "present" ? "text-emerald-700" : "text-amber-700"}>{item.status}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
