import { expect } from "chai";
import hre from "hardhat";
import {
  defaultCommunityDeployConfig,
  deployCommunityStack,
  verifyCommunityDeployment,
  wireCommunityRoles,
} from "../../scripts/hardhat/community-deploy-lib";

describe("Community deploy dry-run", function () {
  it("deploys stack, wires roles, and verifies invariants", async function () {
    this.timeout(600_000);

    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();

    const config = defaultCommunityDeployConfig(deployer.address);
    config.communityName = "DryRun Community";
    config.treasuryVault = deployer.address;
    config.treasuryStableToken = deployer.address;
    config.supportedTokens = [deployer.address];

    const { communityId, addresses } = await deployCommunityStack(config);
    expect(communityId).to.be.greaterThan(0);

    await wireCommunityRoles(communityId, addresses, config);
    await verifyCommunityDeployment(communityId, addresses);
  });
});
