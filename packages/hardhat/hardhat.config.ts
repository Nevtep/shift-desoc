import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: { 
    version: "0.8.24", 
    settings: { 
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun"
    } 
  },
  networks: {
    base_sepolia: {
      url: process.env.RPC_BASE_SEPOLIA || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    hardhat: {
      allowUnlimitedContractSize: true
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test", 
    artifacts: "./artifacts", 
    cache: "./cache"
  }
};
export default config;
