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
      expect(screen.getByText(/Total: 100.00% \(10000 bps\)/i)).toBeInTheDocument();
    });

    const firstInput = screen.getByLabelText(/Allocation Option A/i);
    await userEvent.clear(firstInput);
    await userEvent.type(firstInput, "50");

    expect(screen.getByText(/Total: 50.00% \(5000 bps\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit vote/i })).toBeDisabled();
    expect(screen.getByText(/exactly 10,000 bps/i)).toBeInTheDocument();
  });

  it("shows pending then submitted state on vote success", async () => {
    vi.spyOn(wagmi, "useWriteContract").mockReturnValue({
      writeContractAsync: vi.fn().mockResolvedValue("0xfeed"),
      isPending: false,
      error: null
    } as any);

    renderWithProviders(<ProposalDetail proposalId="100" expectedCommunityId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: /submit vote/i }));

    expect(await screen.findByText(/Vote submitted: 0xfeed/i)).toBeInTheDocument();
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

    expect(await screen.findByText(/Fallback reason: missing-readiness-fields/i)).toBeInTheDocument();
  });
});
