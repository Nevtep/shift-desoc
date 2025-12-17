import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const addresses = JSON.parse(readFileSync(join(__dirname, "hardhat", "deployed-addresses.json"), "utf8"));
  const [deployer] = await ethers.getSigners();
  const registry = await ethers.getContractAt("CommunityRegistry", addresses.communityRegistry);
  
  const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await registry.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  const isCommunityAdmin = await registry.communityAdmins(1, deployer.address);
  
  console.log("Deployer:", deployer.address);
  console.log("Has DEFAULT_ADMIN_ROLE:", hasAdminRole);
  console.log("Is community admin for ID 1:", isCommunityAdmin);
  console.log("Total communities:", (await registry.getTotalCommunities()).toString());
}

main().catch(console.error);