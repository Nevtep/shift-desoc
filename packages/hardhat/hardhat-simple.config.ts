import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: { 
    version: "0.8.24", 
    settings: { 
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      viaIR: true
    } 
  },
  networks: {
    sepolia: {
      url: process.env.RPC_SEPOLIA || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    base_sepolia: {
      url: process.env.RPC_BASE_SEPOLIA || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    hardhat: {
      allowUnlimitedContractSize: true
    }
  },
  paths: {
    sources: "../../contracts", // Point to root contracts directory
    tests: "./test",
    artifacts: "./artifacts",
    cache: "./cache"
  }
};

export default config;