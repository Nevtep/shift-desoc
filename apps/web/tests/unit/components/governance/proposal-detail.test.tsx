import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wagmi from "wagmi";

import { ProposalDetail } from "../../../../components/governance/proposal-detail";
import { server } from "../../server";
import { fixtures } from "../../mocks/fixtures";
import { mockWagmiHooks, renderWithProviders } from "../../utils";

vi.mock("../../../../hooks/useCommunityModules", async () => {
  const actual = await vi.importActual<typeof import("../../../../hooks/useCommunityModules")>(
    "../../../../hooks/useCommunityModules"
  );
  return {
    ...actual,
    useCommunityModules: () => ({
      modules: {
        governor: "0x0000000000000000000000000000000000000200",
        draftsManager: "0x0000000000000000000000000000000000000201"
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null
    })
  };
});

describe("ProposalDetail", () => {
  beforeEach(() => {
    mockWagmiHooks({ connected: true });
  });

  it("shows mismatch guard with correction link", async () => {
    renderWithProviders(<ProposalDetail proposalId="102" expectedCommunityId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/belongs to Community #2/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /open the correct route/i })).toHaveAttribute(
      "href",
      "/communities/2/governance/proposals/102"
    );
  });

  it("enforces exact 10,000 bps and keeps two-decimal rendering", async () => {
    renderWithProviders(<ProposalDetail proposalId="100" expectedCommunityId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/Total: 100.00%/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/Technical vote details/i));
    expect(screen.getByText(/10000/)).toBeInTheDocument();

    const firstInput = screen.getByLabelText(/Allocation Option A/i);
    await userEvent.clear(firstInput);
    await userEvent.type(firstInput, "50");

    expect(screen.getByText(/Total: 50.00%/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Technical vote details/i));
    expect(screen.getByText(/5000/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit vote/i })).toBeDisabled();
    expect(screen.getAllByText(/exactly 100.00%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/10,000 basis points/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders on-chain action payload details", async () => {
    renderWithProviders(<ProposalDetail proposalId="100" expectedCommunityId={1} />);

    expect(await screen.findByText(/Effects this proposal may execute on-chain/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Effects this proposal may execute on-chain/i));
    expect(screen.getByText("0x0000000000000000000000000000000000000000")).toBeInTheDocument();
    expect(screen.getByText("0x")).toBeInTheDocument();
  });

  it("shows pending then confirmed state on vote success", async () => {
    const writeContractAsync = vi.fn().mockResolvedValue("0xfeed");
    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync,
      isPending: false,
      error: null
    } as any);

    renderWithProviders(<ProposalDetail proposalId="100" expectedCommunityId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: /submit vote/i }));

    expect(await screen.findByText(/Vote confirmed: 0xfeed/i)).toBeInTheDocument();
    expect(writeContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "castVoteMultiChoice",
        args: [100n, [1_000_000_000_000_000_000n, 0n, 0n], ""]
      })
    );
  });

  it("uses binary castVoteWithReason when on-chain multi-choice is disabled", async () => {
    const writeContractAsync = vi.fn().mockResolvedValue("0xfeed");
    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync,
      isPending: false,
      error: null
    } as any);

    vi.spyOn(wagmi, "usePublicClient").mockReturnValue({
      readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "isMultiChoice") {
          return Promise.resolve(false);
        }
        return Promise.resolve(1n);
      }),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] }),
      estimateContractGas: vi.fn().mockResolvedValue(300000n)
    } as any);

    renderWithProviders(<ProposalDetail proposalId="100" expectedCommunityId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: /submit vote/i }));

    expect(writeContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "castVoteWithReason",
        args: [100n, 1, ""]
      })
    );
  });

  it("disables submit when proposal is not active on-chain", async () => {
    vi.spyOn(wagmi, "usePublicClient").mockReturnValue({
      readContract: vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === "state") {
          return Promise.resolve(0n);
        }
        if (functionName === "isMultiChoice") {
          return Promise.resolve(true);
        }
        return Promise.resolve(1n);
      }),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] }),
      estimateContractGas: vi.fn().mockResolvedValue(300000n)
    } as any);

    renderWithProviders(<ProposalDetail proposalId="100" expectedCommunityId={1} />);

    expect(await screen.findByText(/Voting is not open yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit vote/i })).toBeDisabled();
  });

  it("surfaces rejected signature and wrong-network failures", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error("User rejected request"))
      .mockRejectedValueOnce(new Error("Wrong network for chain"));

    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync: write,
      isPending: false,
      error: null
    } as any);

    renderWithProviders(<ProposalDetail proposalId="100" expectedCommunityId={1} />);

    const submit = await screen.findByRole("button", { name: /submit vote/i });
    await userEvent.click(submit);
    expect(await screen.findByText(/Signature rejected/i)).toBeInTheDocument();

    await userEvent.click(submit);
    expect(await screen.findByText(/Wrong network selected/i)).toBeInTheDocument();
  });

  it("falls back when readiness fields are missing for queued state", async () => {
    server.use(
      graphql.query("Proposal", ({ variables }) => {
        if ((variables as { id?: string }).id !== "101") {
          return HttpResponse.json({ data: { proposal: fixtures.proposals[0] } });
        }
        return HttpResponse.json({
          data: {
            proposal: {
              ...fixtures.proposals[1],
              queuedAt: null,
              state: "Queued"
            }
          }
        });
      })
    );

    renderWithProviders(<ProposalDetail proposalId="101" expectedCommunityId={1} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Technical diagnostics/i).length).toBeGreaterThanOrEqual(1);
    });
    await userEvent.click(screen.getAllByText(/Technical diagnostics/i)[0]);
    expect(screen.getByText(/Fallback reason: missing-readiness-fields/i)).toBeInTheDocument();
  });

  it("renders safe fallbacks for invalid proposal and vote timestamps", async () => {
    server.use(
      graphql.query("Proposal", ({ variables }) => {
        if ((variables as { id?: string }).id !== "100") {
          return HttpResponse.json({ data: { proposal: fixtures.proposals[0] } });
        }

        return HttpResponse.json({
          data: {
            proposal: {
              ...fixtures.proposals[0],
              createdAt: "invalid-created-at",
              votes: [
                {
                  ...fixtures.proposals[0].votes[0],
                  castAt: "invalid-cast-at"
                }
              ]
            }
          }
        });
      })
    );

    renderWithProviders(<ProposalDetail proposalId="100" expectedCommunityId={1} />);

    await waitFor(() => {
      expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("logs query failures when proposal cannot be loaded", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    server.use(
      graphql.query("Proposal", () => {
        return HttpResponse.json(
          {
            errors: [{ message: "Indexer unavailable" }]
          },
          { status: 500 }
        );
      })
    );

    renderWithProviders(<ProposalDetail proposalId="100" expectedCommunityId={1} />);

    expect(await screen.findByText(/Failed to load proposal/i)).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith(
      "[ProposalDetail] Failed to load proposal query",
      expect.objectContaining({ proposalId: "100" })
    );

    errorSpy.mockRestore();
  });
});
