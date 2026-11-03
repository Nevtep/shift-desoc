import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, graphql } from "msw";
import { usePublicClient } from "wagmi";
import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";
import { describe, expect, it, vi } from "vitest";

import { EngagementSubmitForm } from "../../../components/engagements/engagement-submit-form";
import { renderWithProviders, mockWagmiHooks } from "../utils";
import { server } from "../server";
import { fixtures } from "../mocks/fixtures";
import abiJson from "../../../abis/Engagements.json";

vi.mock("../../../lib/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/contracts")>();
  return {
    ...actual,
    getContractConfig: () => ({ address: "0x0000000000000000000000000000000000000001", abi: [] })
  };
});

vi.mock("../../../hooks/useCommunityModules", async () => {
  const json = await import("../../../abis/Engagements.json");
  return {
    useCommunityModules: () => ({
      modules: {
        engagementsManager: "0x0000000000000000000000000000000000000008"
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null
    }),
    COMMUNITY_MODULE_ABIS: {
      engagements: json.default.abi
    }
  };
});

describe("EngagementSubmitForm", () => {
  it("disables submit and shows wallet hint when disconnected", () => {
    mockWagmiHooks({ connected: false });

    renderWithProviders(<EngagementSubmitForm />);

    expect(screen.getByRole("button", { name: /Submit engagement/i })).toBeDisabled();
    expect(screen.getByText(/Connect a wallet to submit/i)).toBeInTheDocument();
  });

  it("shows inline validation errors instead of alert()", async () => {
    mockWagmiHooks({ connected: true });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);

    renderWithProviders(<EngagementSubmitForm />);

    await userEvent.clear(screen.getByLabelText(/Valuable Action ID/i));
    await userEvent.type(screen.getByLabelText(/Valuable Action ID/i), "abc");
    await userEvent.type(screen.getByLabelText(/Title/i), "Example title");
    await userEvent.type(screen.getByLabelText(/Description/i), "Example description");
    await userEvent.click(screen.getByRole("button", { name: /Submit engagement/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid valuable action id/i);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("validates the community id and required text inline", async () => {
    mockWagmiHooks({ connected: true });
    renderWithProviders(<EngagementSubmitForm />);

    await userEvent.clear(screen.getByLabelText(/Community ID/i));
    await userEvent.type(screen.getByLabelText(/Community ID/i), "0");
    await userEvent.type(screen.getByLabelText(/Title/i), "t");
    await userEvent.type(screen.getByLabelText(/Description/i), "d");
    await userEvent.click(screen.getByRole("button", { name: /Submit engagement/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid community id/i);
  });

  it("uploads evidence and shows success on submit", async () => {
    mockWagmiHooks({ connected: true, address: "0x1230000000000000000000000000000000000123" });

    const fetchSpy = vi.spyOn(global, "fetch");

    renderWithProviders(<EngagementSubmitForm />);

    await userEvent.type(screen.getByLabelText(/Valuable Action ID/i), "2");
    await userEvent.type(screen.getByLabelText(/Title/i), "Ship feature");
    await userEvent.type(screen.getByLabelText(/Description/i), "Did the thing");
    await userEvent.type(screen.getByLabelText(/Evidence CIDs/i), "ipfs://cid1,cid2");

    await userEvent.click(screen.getByRole("button", { name: /Submit engagement/i }));

    expect(await screen.findByText(/Transaction: 0x1234/i)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/ipfs/upload",
      expect.objectContaining({ method: "POST" })
    );

    fetchSpy.mockRestore();
  });

  describe("after the transaction", () => {
    const module = "0x0000000000000000000000000000000000000008";

    function mockReceipt(engagementId: bigint) {
      const abi = abiJson.abi as never;
      const topics = encodeEventTopics({
        abi,
        eventName: "EngagementSubmitted",
        args: {
          engagementId,
          typeId: 2n,
          participant: "0x1230000000000000000000000000000000000123"
        }
      } as never);
      const data = encodeAbiParameters([{ type: "string" }], ["cid"]) as Hex;
      const client = usePublicClient() as unknown as { waitForTransactionReceipt: () => Promise<unknown> };
      vi.spyOn(client, "waitForTransactionReceipt").mockResolvedValue({
        status: "success",
        logs: [{ address: module, topics, data, blockNumber: 1n, logIndex: 0, transactionIndex: 0 }]
      });
    }

    async function fillAndSubmit() {
      mockWagmiHooks({ connected: true, address: "0x1230000000000000000000000000000000000123" });
      renderWithProviders(<EngagementSubmitForm indexerPollIntervalMs={20} indexerTimeoutMs={300} />);
      await userEvent.clear(screen.getByLabelText(/Community ID/i));
      await userEvent.type(screen.getByLabelText(/Community ID/i), "84532");
      await userEvent.type(screen.getByLabelText(/Valuable Action ID/i), "2");
      await userEvent.type(screen.getByLabelText(/Title/i), "Ship feature");
      await userEvent.type(screen.getByLabelText(/Description/i), "Did the thing");
      await userEvent.click(screen.getByRole("button", { name: /Submit engagement/i }));
    }

    it("shows the tx hash and waits for the indexer, then resolves when the row appears", async () => {
      mockReceipt(50n);
      let calls = 0;
      server.use(
        graphql.query("Engagement", () => {
          calls += 1;
          return HttpResponse.json({
            data: {
              engagement: calls >= 8 ? fixtures.engagement : null,
              jurors: { items: [] }
            }
          });
        })
      );

      await fillAndSubmit();

      expect(await screen.findByText(/Transaction: 0x1234/i)).toBeInTheDocument();
      expect(await screen.findByText(/Confirmed on-chain, waiting for indexer/i)).toBeInTheDocument();
      expect(await screen.findByText(/^Indexed\./)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Open engagement 50/i })).toHaveAttribute(
        "href",
        "/engagements/84532%3A50"
      );
    });

    it("falls back to a chain-read link when the indexer never catches up", async () => {
      mockReceipt(50n);
      server.use(
        graphql.query("Engagement", () =>
          HttpResponse.json({ data: { engagement: null, jurors: { items: [] } } })
        )
      );

      await fillAndSubmit();

      expect(await screen.findByText(/Still not indexed; the chain read is available/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /View engagement 50 from the chain/i })).toHaveAttribute(
        "href",
        "/engagements/84532%3A50"
      );
    });
  });
});
