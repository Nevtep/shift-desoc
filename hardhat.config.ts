import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      url: process.env.RPC_SEPOLIA || "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    base_sepolia: {
      url: process.env.RPC_BASE_SEPOLIA || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
      // Use EIP-1559 gas settings for Base Sepolia
      // Higher values to avoid "replacement transaction underpriced" errors
    },
    base: {
      url: process.env.RPC_BASE || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453, // Base mainnet chain ID
    },
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test/hardhat",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};

export default config;
