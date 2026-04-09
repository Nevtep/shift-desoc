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

  it("accepts nested action bundle payload shape", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/11", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draftMissingActions,
            actions: {
              targets: ["0x0000000000000000000000000000000000000001"],
              values: ["0"],
              calldatas: ["0x"],
              actionsHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            },
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    renderWithProviders(
      <DraftDetail
        draftId="11"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    const escalate = await screen.findByRole("button", { name: /^Escalate$/i });
    expect(escalate).toBeEnabled();
    expect(screen.queryByText(/Action bundle required before escalation/i)).not.toBeInTheDocument();
  });

  it("uses on-chain getDraft action bundle fallback when indexer payload is incomplete", async () => {
    vi.spyOn(wagmi, "useReadContract").mockImplementation((config: any) => {
      if (config?.functionName === "getDraft") {
        return {
          data: {
            requestId: 1n,
            actions: {
              targets: ["0x0000000000000000000000000000000000000001"],
              values: [0n],
              calldatas: ["0x1234"],
              actionsHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
            }
          },
          isLoading: false,
          isError: false
        } as any;
      }

      return { data: undefined, isLoading: false, isError: false } as any;
    });

    renderWithProviders(
      <DraftDetail
        draftId="11"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    expect(await screen.findByText(/displaying on-chain bundle from DraftsManager/i)).toBeInTheDocument();
    expect(screen.queryByText(/No complete action bundle is indexed for this draft yet/i)).not.toBeInTheDocument();

    const escalate = await screen.findByRole("button", { name: /^Escalate$/i });
    expect(escalate).toBeEnabled();
  });

  it("shows queued actions and submit-for-review flow for DRAFTING drafts", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/1:2", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            id: "1:2",
            status: "DRAFTING",
            escalatedProposalId: null,
            actions: {
              targets: ["0x0000000000000000000000000000000000000001"],
              values: ["0"],
              calldatas: ["0x1234"],
              actionsHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    renderWithProviders(
      <DraftDetail
        draftId="1:2"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    expect(await screen.findByText(/Queued Actions/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Submit for review/i })).toBeEnabled();

    const escalate = await screen.findByRole("button", { name: /^Escalate$/i });
    expect(escalate).toBeDisabled();
    expect(screen.getByText(/Draft must be FINALIZED before escalation/i)).toBeInTheDocument();
  });

  it("caps workflow gas when estimator returns a value above network limits", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/1:2", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            id: "1:2",
            status: "DRAFTING",
            escalatedProposalId: null,
            actions: {
              targets: ["0x0000000000000000000000000000000000000001"],
              values: ["0"],
              calldatas: ["0x1234"],
              actionsHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    const writeContractAsync = vi.fn().mockResolvedValue("0xabc");
    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync,
      isPending: false,
      error: null
    } as any);

    vi.spyOn(wagmi, "usePublicClient").mockReturnValue({
      estimateContractGas: vi.fn().mockResolvedValue(5_000_000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] })
    } as any);

    renderWithProviders(
      <DraftDetail
        draftId="1:2"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: /Submit for review/i }));

    await waitFor(() => {
      expect(writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "submitForReview",
          args: [2n],
          gas: 1_500_000n,
        })
      );
    });
  });

  it("does not show finalize success when receipt is reverted", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/1:2", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            id: "1:2",
            status: "REVIEW",
            escalatedProposalId: null,
            actions: {
              targets: ["0x0000000000000000000000000000000000000001"],
              values: ["0"],
              calldatas: ["0x1234"],
              actionsHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    const writeContractAsync = vi.fn().mockResolvedValue("0xdef");
    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync,
      isPending: false,
      error: null
    } as any);

    vi.spyOn(wagmi, "usePublicClient").mockReturnValue({
      estimateContractGas: vi.fn().mockResolvedValue(300_000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "reverted", logs: [] })
    } as any);

    renderWithProviders(
      <DraftDetail
        draftId="1:2"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: /Finalize for proposal/i }));

    expect(await screen.findByText(/execution reverted on-chain/i)).toBeInTheDocument();
    expect(screen.queryByText(/Draft finalized for proposal escalation\./i)).not.toBeInTheDocument();
  });

  it("shows review-period requirement and blocks finalize while period is still open", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/1:2", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            id: "1:2",
            status: "REVIEW",
            escalatedProposalId: null,
            actions: {
              targets: ["0x0000000000000000000000000000000000000001"],
              values: ["0"],
              calldatas: ["0x1234"],
              actionsHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    vi.spyOn(wagmi, "useReadContract").mockImplementation((config: any) => {
      if (config?.functionName === "getDraft") {
        return {
          data: { reviewStartedAt: BigInt(Math.floor(Date.now() / 1000)) },
          isLoading: false,
          isError: false,
        } as any;
      }
      if (config?.functionName === "reviewPeriod") {
        return { data: 3n * 24n * 60n * 60n, isLoading: false, isError: false } as any;
      }
      if (config?.functionName === "minReviewsForEscalation") {
        return { data: 3n, isLoading: false, isError: false } as any;
      }
      if (config?.functionName === "supportThresholdBps") {
        return { data: 6000n, isLoading: false, isError: false } as any;
      }
      if (config?.functionName === "getReviewSummary") {
        return {
          data: { supportCount: 2n, totalReviews: 3n },
          isLoading: false,
          isError: false,
        } as any;
      }

      return { data: undefined, isLoading: false, isError: false } as any;
    });

    renderWithProviders(
      <DraftDetail
        draftId="1:2"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    expect(await screen.findByText(/Finalize requirements/i)).toBeInTheDocument();
    expect(await screen.findByText(/Review period: 3d 0h \(remaining/i)).toBeInTheDocument();

    const finalize = await screen.findByRole("button", { name: /Finalize for proposal/i });
    expect(finalize).toBeDisabled();
    expect(await screen.findByText(/Finalize is blocked until all review requirements are met/i)).toBeInTheDocument();
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

  it("normalizes composite draft ids before escalateToProposal", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/1:1", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            id: "1:1",
            escalatedProposalId: null,
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    const writeContractAsync = vi.fn().mockResolvedValue("0xabc");
    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync,
      isPending: false,
      error: null
    } as any);

    vi.spyOn(wagmi, "usePublicClient").mockReturnValue({
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [] })
    } as any);

    renderWithProviders(
      <DraftDetail
        draftId="1:1"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    await userEvent.type(await screen.findByLabelText(/Description markdown/i), "# Description");
    await userEvent.click(screen.getByRole("button", { name: /^Escalate$/i }));

    await waitFor(() => {
      expect(writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "escalateToProposal",
          args: [1n, true, 2, expect.any(String)]
        })
      );
    });
  });

  it("creates a revised draft with edited queue while DRAFTING", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/1:2", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            id: "1:2",
            status: "DRAFTING",
            escalatedProposalId: null,
            actions: {
              targets: ["0x0000000000000000000000000000000000000001"],
              values: ["0"],
              calldatas: ["0x1234"],
              actionsHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            },
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    const writeContractAsync = vi.fn().mockResolvedValue("0xabc");
    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync,
      isPending: false,
      error: null
    } as any);

    renderWithProviders(
      <DraftDetail
        draftId="1:2"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    await userEvent.type(await screen.findByLabelText(/Revision CID/i), "bafy-revision-cid");
    await userEvent.click(screen.getByRole("button", { name: /Create revised draft/i }));

    await waitFor(() => {
      expect(writeContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "createDraft"
        })
      );
    });
  });

  it("merges sibling drafts from the same request into version history", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/10", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            requestId: "1",
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      }),
      http.post("http://localhost:4000/graphql", async ({ request }) => {
        const body = (await request.json()) as { operationName?: string; variables?: Record<string, unknown> };
        if (body.operationName === "Drafts") {
          return HttpResponse.json({
            data: {
              drafts: {
                nodes: [
                  {
                    id: "10",
                    requestId: "1",
                    status: "DRAFTING",
                    latestVersionCid: "draft-cid-10",
                    escalatedProposalId: null,
                    updatedAt: new Date("2024-02-10T00:00:00Z").toISOString()
                  },
                  {
                    id: "11",
                    requestId: "1",
                    status: "REVIEW",
                    latestVersionCid: "draft-cid-11",
                    escalatedProposalId: null,
                    updatedAt: new Date("2024-02-11T00:00:00Z").toISOString()
                  }
                ],
                pageInfo: { endCursor: null, hasNextPage: false }
              }
            }
          });
        }
        return HttpResponse.json({ data: {} });
      }),
      http.get("/api/ipfs/draft-cid-11", () => {
        return HttpResponse.json({
          cid: "draft-cid-11",
          type: "draftVersion",
          version: "1.0",
          data: { type: "draftVersion" },
          html: { body: "<p>Sibling draft content</p>" },
          retrievedAt: new Date().toISOString()
        });
      })
    );

    renderWithProviders(
      <DraftDetail
        draftId="10"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    expect(await screen.findByText(/Draft 11 \(REVIEW\)/i)).toBeInTheDocument();
  });

  it("does not merge sibling drafts for requestId=0", async () => {
    server.use(
      http.get("http://localhost:4000/drafts/10", () => {
        return HttpResponse.json({
          draft: {
            ...fixtures.draft,
            requestId: "0",
            versions: fixtures.draftVersions,
            reviews: fixtures.draftReviews
          }
        });
      })
    );

    renderWithProviders(
      <DraftDetail
        draftId="10"
        expectedCommunityId={1}
        useCommunityScopedRequestLinks
      />
    );

    expect(await screen.findByText(/Version History/i)).toBeInTheDocument();
    expect(screen.queryByText(/Draft 11 \(REVIEW\)/i)).not.toBeInTheDocument();
  });
});
