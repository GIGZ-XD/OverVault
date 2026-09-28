// hardhat.config.js
// OverVault Smart Contracts — Hardhat 3 Configuration
//
// Uses the mocha + ethers toolbox for testing.
// MST EVM network can be added under `networks` when credentials are available.
//
// Notes on paths:
//   sources: "." — contracts live directly in contracts/ (alongside this config)
//   tests.mocha: "test" — test files live in contracts/test/

import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],

  solidity: {
    profiles: {
      default: {
        version: "0.8.20",
      },
      production: {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },

  paths: {
    // Solidity sources live in the src/ directory
    sources: "src",
  },

  networks: {
    // Built-in simulated Hardhat network (used for `npx hardhat test`)
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },

    // MST EVM testnet — fill in env vars before deploying
    // mst_testnet: {
    //   type: "http",
    //   chainType: "l1",
    //   url: process.env.MST_EVM_RPC_URL ?? "",
    //   accounts: process.env.MST_DEPLOYER_PRIVATE_KEY
    //     ? [process.env.MST_DEPLOYER_PRIVATE_KEY]
    //     : [],
    // },
  },
});
