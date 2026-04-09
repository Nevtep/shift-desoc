import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import * as wagmi from "wagmi";

const pushSpy = vi.fn();

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: pushSpy,
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn()
    })
  };
});

vi.mock("../../../../hooks/useCommunityModules", async () => {
  const actual = await vi.importActual<typeof import("../../../../hooks/useCommunityModules")>(
    "../../../../hooks/useCommunityModules"
  );
  return {
    ...actual,
    useCommunityModules: () => ({
      modules: {
        draftsManager: "0x0000000000000000000000000000000000000201",
        governor: "0x0000000000000000000000000000000000000200"
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null
    })
  };
});

import { DraftDetail } from "../../../../components/drafts/draft-detail";
import { server } from "../../server";
import { fixtures } from "../../mocks/fixtures";
import { mockWagmiHooks, renderWithProviders } from "../../utils";

describe("DraftDetail escalation", () => {
  beforeEach(() => {
    pushSpy.mockReset();
    mockWagmiHooks({ connected: true });
  });

  it("blocks escalation when action bundle is incomplete", async () => {
    renderWithProviders(
      <DraftDetail
        draftId="11"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    const escalate = await screen.findByRole("button", { name: /escalate/i });
    expect(escalate).toBeDisabled();
    expect(await screen.findByText(/Action bundle required before escalation/i)).toBeInTheDocument();
  });

  it("redirects to proposal detail when ProposalEscalated proposalId is parsed", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/10", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            escalatedProposalId: null,
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync: vi.fn().mockResolvedValue("0xabc"),
      isPending: false,
      error: null
    } as any);

    vi.spyOn(wagmi, "usePublicClient").mockReturnValue({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [{ proposalId: 999n }]
      })
    } as any);

    renderWithProviders(
      <DraftDetail
        draftId="10"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    await userEvent.type(await screen.findByLabelText(/Description markdown/i), "# Description");
    await userEvent.click(screen.getByRole("button", { name: /^Escalate$/i }));

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith("/communities/1/governance/proposals/999");
    });
  });

  it("falls back to proposals list with lag notice when proposalId is not derivable", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/10", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            escalatedProposalId: null,
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync: vi.fn().mockResolvedValue("0xabc"),
      isPending: false,
      error: null
    } as any);

    vi.spyOn(wagmi, "usePublicClient").mockReturnValue({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        logs: []
      })
    } as any);

    renderWithProviders(
      <DraftDetail
        draftId="10"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    await userEvent.type(await screen.findByLabelText(/Description markdown/i), "# Description");
    await userEvent.click(screen.getByRole("button", { name: /^Escalate$/i }));

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith("/communities/1/governance/proposals?indexLag=1");
    });

    expect(await screen.findByText(/indexing may lag/i)).toBeInTheDocument();
  });
});
