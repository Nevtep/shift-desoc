import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { GovernanceTechnicalFooter } from "../../../../components/layout/governance-technical-footer";
import { GovernanceTopBar } from "../../../../components/communities/governance-top-bar";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;
  return {
    title: t.metaCommunityGovernanceTitle,
    description: t.metaHubDescription
  };
}

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityGovernanceHubPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;

  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:py-12">
      <GovernanceTopBar communityId={safeCommunityId} />

      <section className="grid gap-4 md:grid-cols-1">
        <article className="card-tight flex min-h-[180px] flex-col justify-between border-primary/20">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-primary">{t.hubSectionProposalsTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.hubSectionProposalsBody}</p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link className="btn-primary" href={`/communities/${safeCommunityId}/governance/proposals`}>
              {t.viewAllProposals}
            </Link>
            <Link className="btn-ghost text-sm" href={`/communities/${safeCommunityId}`}>
              {t.backToOverview}
            </Link>
          </div>
        </article>
      </section>

      <GovernanceTechnicalFooter />
    </main>
  );
}
