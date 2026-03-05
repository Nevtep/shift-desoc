import {
  CommunityStackAddresses,
  loadDeploymentFile,
  verifyCommunityDeployment,
} from "./community-deploy-lib";

async function main() {
  const deployment = loadDeploymentFile();
  if (!deployment?.communityId || !deployment.addresses) {
    throw new Error("No deployment found in deployments/*.json");
  }

  await verifyCommunityDeployment(
    deployment.communityId,
    deployment.addresses as CommunityStackAddresses,
  );

  console.log(`✅ Verification checks passed for communityId=${deployment.communityId}`);
}

main().catch((error) => {
  console.error("❌ verify-community-deployment failed", error);
  process.exitCode = 1;
});
