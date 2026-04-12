"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";

import { ValuableActionAdminPanel } from "../../../../components/valuable-actions/valuable-action-admin-panel";
import { ValuableActionDetail } from "../../../../components/valuable-actions/valuable-action-detail";
import { ValuableActionList } from "../../../../components/valuable-actions/valuable-action-list";
import { ValuableActionReadinessBanner } from "../../../../components/valuable-actions/valuable-action-readiness-banner";
import { useValuableActionBoundary } from "../../../../hooks/useValuableActionBoundary";
import { useValuableActionCatalog } from "../../../../hooks/useValuableActionCatalog";
import { useValuableActionReadiness } from "../../../../hooks/useValuableActionReadiness";

export default function CommunityValuableActionsPage() {
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const params = useParams<{ id: string }>();
  const account = useAccount();
  const communityId = useMemo(() => {
    const parsed = Number(params?.id ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [params?.id]);

  const catalog = useValuableActionCatalog(communityId);
  const readiness = useValuableActionReadiness(communityId);

  const selectedAction = useMemo(
    () => catalog.items.find((item) => item.actionId === selectedActionId) ?? null,
    [catalog.items, selectedActionId]
  );

  const boundary = useValuableActionBoundary({
    activeCommunityId: communityId,
    payloadCommunityId: selectedAction?.communityId ?? communityId,
    actionId: selectedAction?.actionId ?? 0,
    resolvedActionCommunityId: selectedAction?.communityId,
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Valuable Actions</h1>
        <p className="text-xs text-muted-foreground">Community #{communityId} · Base Sepolia · staging</p>
      </header>
      <ValuableActionReadinessBanner readiness={readiness.readiness} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ValuableActionList
          communityId={communityId}
          actions={catalog.items}
          readinessStatus={readiness.readiness.status}
          onSelect={setSelectedActionId}
        />
        <ValuableActionDetail communityId={communityId} action={selectedAction} />
      </div>
      <ValuableActionAdminPanel
        communityId={communityId}
        action={selectedAction}
        boundaryValid={boundary.boundaryValid}
        isConnected={account.status === "connected"}
        canCreate={catalog.items.length === 0}
        readinessStatus={readiness.readiness.status}
      />
    </main>
  );
}
