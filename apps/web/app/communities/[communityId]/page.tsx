import { CommunityOverviewPage } from "../../../components/communities/overview/overview-page";

export const metadata = {
  title: "Community Overview | Shift"
};

type PageParams = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityDetailPage({ params }: PageParams) {
  const { communityId } = await params;
  const numericId = Number(communityId);
  return <CommunityOverviewPage communityId={Number.isFinite(numericId) ? numericId : 0} />;
}
