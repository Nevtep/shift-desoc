"use client";

import Link from "next/link";

import { ModuleSummary } from "./module-summary";
import { OverviewHeader } from "./overview-header";
import { OverviewState } from "./overview-state";
import { ParameterSummary } from "./parameter-summary";
import { useCommunityOverview } from "../../../hooks/useCommunityOverview";
import { useCommunityOverviewActivity } from "../../../hooks/useCommunityOverviewActivity";
import { ActivityPreviews } from "./activity-previews";
import { SectionTabs } from "./section-tabs";
import { buildSectionTabs } from "../../../lib/community-overview/availability";

export function CommunityOverviewPage({ communityId }: { communityId: number }) {
  const overview = useCommunityOverview(communityId);
  const activity = useCommunityOverviewActivity(communityId, {
    state: overview.indexer.state,
    refetch: overview.indexer.refetch
  });
  const tabs = buildSectionTabs(communityId);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <OverviewHeader header={overview.header} />
      <SectionTabs tabs={tabs} />

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Deployment recovery</h2>
        <p className="text-sm text-muted-foreground">
          If this community was created from the wizard but bootstrap did not fully finish, resume the deployment
          session to complete access/runtime wiring and verification.
        </p>
        <div>
          <Link
            className="btn-outline"
            href={`/?resume=1&resumeCommunityId=${communityId}`}
          >
            Finish deployment
          </Link>
        </div>
      </section>

      {!overview.hasData && !overview.modulesLoading ? <OverviewState type="not-found" /> : null}
      {overview.paramsError ? <OverviewState type="partial-failure" onRetry={() => void overview.indexer.refetch()} /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ModuleSummary items={overview.moduleItems} />
        <ParameterSummary items={overview.parameterItems} />
      </div>

      <ActivityPreviews panels={activity.panels} />
    </main>
  );
}
