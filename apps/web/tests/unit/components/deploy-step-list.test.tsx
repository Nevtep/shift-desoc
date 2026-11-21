import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeployStepList } from "../../../components/home/deploy-step-list";
import type { AuthorityMode } from "../../../lib/deploy/types";
import { applyAuthorityModeToSteps, createInitialSteps, transitionStep } from "../../../lib/deploy/wizard-machine";
import { renderWithProviders } from "../utils";

function finalizeRunning(mode: AuthorityMode) {
  let steps = createInitialSteps(mode);
  steps = applyAuthorityModeToSteps(steps, mode);
  for (const key of ["PRECHECKS", "DEPLOY_STACK", "CONFIGURE_ACCESS_PERMISSIONS"] as const) {
    steps = transitionStep(steps, key, "succeeded");
  }
  return transitionStep(steps, "FINALIZE_AUTHORITY_MODE", "running");
}

describe("DeployStepList finalize rows", () => {
  it("admin-managed shows only the bootstrap coordinator revoke row", async () => {
    renderWithProviders(<DeployStepList steps={finalizeRunning("admin_managed")} authorityMode="admin_managed" />);

    expect(await screen.findByText(/Revoke bootstrap coordinator admin role 1 of 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Grant timelock admin role/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Revoke deployer admin role/i)).not.toBeInTheDocument();
  });

  it("governance-managed keeps grant timelock then revoke deployer rows", async () => {
    renderWithProviders(<DeployStepList steps={finalizeRunning("governance_managed")} authorityMode="governance_managed" />);

    expect(await screen.findByText(/Grant timelock admin role 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Revoke deployer admin role 2 of 2/i)).toBeInTheDocument();
  });
});
