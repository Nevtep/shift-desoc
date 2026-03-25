import Link from "next/link";

import type { SectionTabState } from "../../../lib/community-overview/types";

export function SectionTabs({ tabs }: { tabs: SectionTabState[] }) {
  return (
    <nav className="card" aria-label="Community sections">
      <ul className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <li key={tab.key}>
            {tab.enabled ? (
              <Link className="btn-ghost" href={tab.href}>{tab.label}</Link>
            ) : (
              <button className="btn-ghost" disabled>
                {tab.label}
                {tab.comingSoon ? " · Coming soon" : ""}
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
