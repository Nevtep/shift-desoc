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

    expect(await screen.findByText(/RevenueRouter treasury is not set/i)).toBeInTheDocument();
    expect(await screen.findByText(/Pass/i)).toBeInTheDocument();
    expect(await screen.findByText(/Fail/i)).toBeInTheDocument();
  });

  it("shows the verified authority mode and labels positive/negative checks", async () => {
    renderWithProviders(
      <DeployVerificationResults
        authorityMode="admin_managed"
        results={[
          { key: "AUTHORITY_DEPLOYER_ADMIN", label: "Deployer holds ADMIN", passed: true, polarity: "positive" },
          { key: "AUTHORITY_TIMELOCK_ADMIN", label: "Timelock does not hold ADMIN", passed: true, polarity: "negative" }
        ]}
      />
    );
    expect(await screen.findByText(/Verified authority mode: Admin-managed/i)).toBeInTheDocument();
    expect(await screen.findByText("Positive check")).toBeInTheDocument();
    expect(await screen.findByText("Negative check")).toBeInTheDocument();
  });

  it("renders the initial voting power rows", async () => {
    renderWithProviders(
      <DeployVerificationResults
        results={[
          { key: "INITIAL_VOTES_DEPLOYER", label: "Deployer has >= 1 token of votes, self-delegated", passed: false, failureReason: "Deployer votes below 1 token" },
          { key: "ROLE_MEMBERSHIP_MINTER_DEPLOYER_REVOKED", label: "Deployer does not hold MEMBERSHIP_TOKEN_MINTER_ROLE", passed: true }
        ]}
      />
    );
    expect(await screen.findByText(/Deployer votes below 1 token/i)).toBeInTheDocument();
    expect(screen.getByText(/Poder de voto inicial del deployer|Deployer has >= 1 token/i)).toBeInTheDocument();
  });
});
