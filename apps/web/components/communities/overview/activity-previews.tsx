import { ActivityPanel } from "./activity-panel";
import type { ActivityPanelState } from "../../../lib/community-overview/types";

export function ActivityPreviews({
  panels
}: {
  panels: {
    requests: ActivityPanelState;
    drafts: ActivityPanelState;
    proposals: ActivityPanelState;
  };
}) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">Recent activity previews</h2>
      <div className="grid gap-3 lg:grid-cols-3">
        <ActivityPanel panel={panels.requests} />
        <ActivityPanel panel={panels.drafts} />
        <ActivityPanel panel={panels.proposals} />
      </div>
    </section>
  );
}
