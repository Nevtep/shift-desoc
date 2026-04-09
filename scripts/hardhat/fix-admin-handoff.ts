import hre from "hardhat";
import { loadDeploymentFile } from "./community-deploy-lib";

const { ethers } = hre;

type HandoffState = {
  account: string;
  hasAdmin: boolean;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  let nextNonce = await ethers.provider.getTransactionCount(signerAddress, "pending");

  const txOpts = () => {
    const nonce = nextNonce;
    nextNonce += 1;
    return { nonce };
  };

  const deployment = loadDeploymentFile();
  if (!deployment?.addresses) {
    throw new Error("No deployment record found for current network.");
  }

  const accessManagerAddress = deployment.addresses.accessManager;
  const timelockAddress = deployment.addresses.timelock;
  const bootstrapCoordinatorAddress = deployment.addresses.bootstrapCoordinator;
  const deployerAddress = deployment.deployer;

  if (!accessManagerAddress) throw new Error("Missing accessManager in deployment record.");
  if (!timelockAddress) throw new Error("Missing timelock in deployment record.");

  const accessManager = await ethers.getContractAt("ShiftAccessManager", accessManagerAddress, signer);
  const adminRole = await accessManager.ADMIN_ROLE();

  const hasAdmin = async (account: string): Promise<boolean> => {
    const [isMember] = await accessManager.hasRole(adminRole, account);
    return isMember;
  };

  const readStates = async (): Promise<{
    signer: HandoffState;
    timelock: HandoffState;
    deployer: HandoffState | null;
    bootstrap: HandoffState | null;
  }> => {
    const signerState = { account: signerAddress, hasAdmin: await hasAdmin(signerAddress) };

    const deployerIsSigner = deployerAddress
      ? deployerAddress.toLowerCase() === signerAddress.toLowerCase()
      : false;

    const deployer = deployerAddress
      ? {
          account: deployerAddress,
          hasAdmin: deployerIsSigner ? signerState.hasAdmin : await hasAdmin(deployerAddress),
        }
      : null;
    const bootstrap = bootstrapCoordinatorAddress
      ? { account: bootstrapCoordinatorAddress, hasAdmin: await hasAdmin(bootstrapCoordinatorAddress) }
      : null;

    return {
      signer: signerState,
      timelock: { account: timelockAddress, hasAdmin: await hasAdmin(timelockAddress) },
      deployer,
      bootstrap,
    };
  };

  const before = await readStates();
  console.log("[fix-admin-handoff] before", JSON.stringify(before, null, 2));

  if (!before.signer.hasAdmin) {
    const alreadyFinalized =
      before.timelock.hasAdmin && !before.deployer?.hasAdmin && !before.bootstrap?.hasAdmin;
    if (alreadyFinalized) {
      console.log("[fix-admin-handoff] already finalized; no action required.");
      return;
    }
    throw new Error(
      `Connected signer ${signerAddress} does not have ADMIN_ROLE on ${accessManagerAddress}. Use a signer with current admin authority.`
    );
  }

  if (!before.timelock.hasAdmin) {
    const tx = await accessManager.grantRole(adminRole, timelockAddress, 0, txOpts());
    await tx.wait();
    console.log("[fix-admin-handoff] grantRole(adminRole, timelock) tx", tx.hash);
  }

  if (before.bootstrap?.hasAdmin) {
    const tx = await accessManager.revokeRole(adminRole, before.bootstrap.account, txOpts());
    await tx.wait();
    console.log("[fix-admin-handoff] revokeRole(adminRole, bootstrapCoordinator) tx", tx.hash);
  }

  if (before.deployer?.hasAdmin) {
    const tx = await accessManager.revokeRole(adminRole, before.deployer.account, txOpts());
    await tx.wait();
    console.log("[fix-admin-handoff] revokeRole(adminRole, deployer) tx", tx.hash);
  }

  let after = await readStates();
  for (let attempt = 0; attempt < 4; attempt++) {
    const deployerDone = !after.deployer?.hasAdmin;
    const timelockDone = after.timelock.hasAdmin;
    const bootstrapDone = !after.bootstrap?.hasAdmin;
    if (deployerDone && timelockDone && bootstrapDone) break;
    await sleep(1200);
    after = await readStates();
  }
  console.log("[fix-admin-handoff] after", JSON.stringify(after, null, 2));

  if (!after.timelock.hasAdmin) {
    throw new Error("Post-check failed: timelock is missing ADMIN_ROLE.");
  }
  if (after.deployer?.hasAdmin) {
    throw new Error("Post-check failed: deployer still has ADMIN_ROLE.");
  }
  if (after.bootstrap?.hasAdmin) {
    throw new Error("Post-check failed: bootstrap coordinator still has ADMIN_ROLE.");
  }

  console.log("[fix-admin-handoff] success: admin handoff is finalized.");
}

main().catch((error) => {
  console.error("[fix-admin-handoff] failed", error);
  process.exitCode = 1;
});
