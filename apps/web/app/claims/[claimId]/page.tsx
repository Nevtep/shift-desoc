import { EngagementDetailPageContent } from "../../engagements/[engagementId]/page";

export const metadata = {
  title: "Engagement Detail | Shift"
};

type PageProps = {
  params: Promise<{
    claimId: string;
  }>;
};

export default async function ClaimDetailPage({ params }: PageProps) {
  const { claimId } = await params;
  return <EngagementDetailPageContent engagementId={claimId} />;
}
