import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeployVerificationResults } from "../../../components/home/deploy-verification-results";
import { renderWithProviders } from "../utils";

describe("DeployVerificationResults", () => {
  it("renders pass/fail checks and reason text", async () => {
    renderWithProviders(
      <DeployVerificationResults
        results={[
          {
            key: "VPT_COMMUNITY_INITIALIZED",
            label: "VerifierPowerToken community initialized",
            passed: true
          },
          {
            key: "REVENUE_ROUTER_TREASURY_SET",
            label: "RevenueRouter treasury is configured",
            passed: false,
            failureReason: "RevenueRouter treasury is not set"
          }
        ]}
      />
    );

    expect(await screen.findByText(/VerifierPowerToken community initialized/i)).toBeInTheDocument();
    expect(screen.getByText(/PASS/i)).toBeInTheDocument();
    expect(screen.getByText(/FAIL/i)).toBeInTheDocument();
    expect(screen.getByText(/RevenueRouter treasury is not set/i)).toBeInTheDocument();
  });
});
