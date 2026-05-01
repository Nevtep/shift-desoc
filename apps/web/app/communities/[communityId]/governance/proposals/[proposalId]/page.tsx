import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ProposalDetail } from "../../../../../../components/governance/proposal-detail";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../../../../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;
  return {
    title: t.metaProposalDetailTitle,
    description: t.proposalDetailSubtitle
  };
}

type PageProps = {
  params: Promise<{
    communityId: string;
    proposalId: string;
  }>;
};

export default async function CommunityProposalDetailPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;

  const { communityId, proposalId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.proposalDetailKicker}</p>
        <h1 className="text-3xl font-semibold">{t.proposalDetailTitle.replace("{id}", proposalId)}</h1>
        <Link className="text-sm underline" href={`/communities/${safeCommunityId}/governance/proposals`}>
          {t.backToProposals}
        </Link>
      </header>

      <ProposalDetail proposalId={proposalId} expectedCommunityId={safeCommunityId} />
    </main>
  );
}
