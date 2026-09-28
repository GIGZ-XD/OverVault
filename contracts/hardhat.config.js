// hardhat.config.js
// OverVault Smart Contracts — Hardhat 3 Configuration
//
// Uses the mocha + ethers toolbox for testing.
//
// Networks:
//   hardhat     — built-in simulated EVM (used for `npx hardhat test`)
//   mst_testnet — MST EVM testnet (used for `npx hardhat run scripts/deploy.js --network mst_testnet`)
//
// MST network is driven entirely by environment variables — no secrets in code:
//   MST_RPC_URL    : JSON-RPC endpoint  (e.g. https://rpc.testnet.mstblockchain.com)
//   MST_CHAIN_ID   : Numeric chain ID   (verify in MST documentation — never guess)
//   MST_PRIVATE_KEY: Deployer/signer hex private key (use a funded testnet-only key)
//
// Load from .env automatically via dotenv (development convenience only).
// In CI/CD, inject env vars directly — never commit a funded key.
//
// Notes on paths:
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── MST network environment variables ──────────────────────────────────────
const MST_RPC_URL = process.env.MST_RPC_URL ?? "";
const MST_CHAIN_ID = process.env.MST_CHAIN_ID ? parseInt(process.env.MST_CHAIN_ID, 10) : undefined;
const MST_PRIVATE_KEY = process.env.MST_PRIVATE_KEY ?? "";

// Guard: if any required MST var is set, all must be set.
// This prevents silent misconfiguration (e.g. wrong network but no error).
if (MST_RPC_URL || MST_PRIVATE_KEY) {
  if (!MST_RPC_URL) {
    throw new Error(
      "hardhat.config: MST_PRIVATE_KEY is set but MST_RPC_URL is missing. " +
      "Both must be configured together."
    );
  }
  if (!MST_PRIVATE_KEY) {
    throw new Error(
      "hardhat.config: MST_RPC_URL is set but MST_PRIVATE_KEY is missing. " +
      "Both must be configured together."
    );
  }
}

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
    // ── Built-in simulated Hardhat network (used for `npx hardhat test`) ──
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },

    // ── MST EVM Testnet ────────────────────────────────────────────────────
    // Activated when MST_RPC_URL + MST_PRIVATE_KEY are set in the environment.
    // Usage:
    //   npx hardhat run scripts/deploy.js --network mst_testnet
    //
    // Required env vars (see .env.example):
    //   MST_RPC_URL     — JSON-RPC endpoint
    //   MST_CHAIN_ID    — Chain ID integer (optional but recommended)
    //   MST_PRIVATE_KEY — Deployer private key (NEVER commit a funded key)
    mst_testnet: {
      type: "http",
      chainType: "l1",
      url: MST_RPC_URL || "http://127.0.0.1:8545", // fallback prevents Hardhat startup error
      accounts: MST_PRIVATE_KEY ? [MST_PRIVATE_KEY] : [],
      ...(MST_CHAIN_ID ? { chainId: MST_CHAIN_ID } : {}),
    },
  },
});
