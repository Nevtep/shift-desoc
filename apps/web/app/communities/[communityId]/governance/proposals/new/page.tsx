import Link from "next/link";
import type { Route } from "next";

import { DirectProposalCreateContainer } from "../../../../../../components/governance/direct-proposal-create.container";

export const metadata = {
  title: "Create Governance Proposal | Shift"
};

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommunityDirectProposalCreatePage({ params, searchParams }: PageProps) {
  const { communityId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  const template = typeof resolvedSearchParams?.template === "string" ? resolvedSearchParams.template : undefined;
  const operation = typeof resolvedSearchParams?.operation === "string" ? resolvedSearchParams.operation : undefined;
  const actionIdRaw = typeof resolvedSearchParams?.actionId === "string" ? resolvedSearchParams.actionId : undefined;
  const nextActiveRaw = typeof resolvedSearchParams?.nextActive === "string" ? resolvedSearchParams.nextActive : undefined;
  const actionId = actionIdRaw && /^\d+$/.test(actionIdRaw) ? Number(actionIdRaw) : undefined;
  const nextActive = nextActiveRaw === "true" ? true : nextActiveRaw === "false" ? false : undefined;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Create proposal</h1>
        <Link className="text-sm underline" href={`/communities/${safeCommunityId}/governance/proposals` as Route}>
          Back to proposals
        </Link>
      </header>

      <DirectProposalCreateContainer
        communityId={safeCommunityId}
        valuableActionTemplate={
          template === "valuable_action"
            ? {
                operation: operation === "create" || operation === "activate" || operation === "deactivate" ? operation : "create",
                actionId,
                nextActive,
              }
            : undefined
        }
      />
    </main>
  );
}
