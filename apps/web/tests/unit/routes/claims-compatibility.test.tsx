import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const engagementsContentSpy = vi.fn(({ communityId }: { communityId?: string }) => (
  <div data-testid="engagements-content">{communityId ?? "none"}</div>
));

const engagementDetailContentSpy = vi.fn(({ engagementId }: { engagementId: string }) => (
  <div data-testid="engagement-detail-content">{engagementId}</div>
));

vi.mock("../../../app/engagements/page", () => ({
  EngagementsPageContent: engagementsContentSpy
}));

vi.mock("../../../app/engagements/[engagementId]/page", () => ({
  EngagementDetailPageContent: engagementDetailContentSpy
}));

describe("legacy /claims compatibility routes", () => {
  it("maps /claims to EngagementsPageContent", async () => {
    const { default: ClaimsPage } = await import("../../../app/claims/page");

    const element = await ClaimsPage({ searchParams: Promise.resolve({ communityId: "7" }) });
    render(element);

    expect(engagementsContentSpy).toHaveBeenCalledWith({ communityId: "7" }, undefined);
    expect(screen.getByTestId("engagements-content")).toHaveTextContent("7");
  });

  it("maps /claims/[claimId] to EngagementDetailPageContent", async () => {
    const { default: ClaimDetailPage } = await import("../../../app/claims/[claimId]/page");

    const element = await ClaimDetailPage({ params: Promise.resolve({ claimId: "42" }) });
    render(element);

    expect(engagementDetailContentSpy).toHaveBeenCalledWith({ engagementId: "42" }, undefined);
    expect(screen.getByTestId("engagement-detail-content")).toHaveTextContent("42");
  });
});
