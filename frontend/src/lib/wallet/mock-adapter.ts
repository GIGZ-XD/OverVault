/**
 * MockWalletAdapter — used in development (NEXT_PUBLIC_WALLET_MODE=mock)
 * and all automated E2E/unit tests.
 *
 * Behavior:
 *  - isInstalled always true
 *  - connect returns a fixed address and network (matching specs/fixtures/users.json u1)
 *  - signMessage returns a deterministic mock signature
 *  - sendTransaction returns a mock tx hash
 *  - No real cryptography; never call real chain
 *
 * Owner: Pannaga
 */
import type { WalletAdapter } from "./adapter";

/** Fixed test address — matches fixture user u1 (Asha Rao) */
export const MOCK_ADDRESS = "0xaaa1";

/** Fixed mock network name */
export const MOCK_NETWORK = "MST Testnet";

/** Deterministic mock signature (not cryptographically valid) */
export const MOCK_SIGNATURE = "0xmocksig_pannaga_overvault_test";

/** Deterministic mock tx hash */
export const MOCK_TX_HASH = "0xmocktx_pannaga_overvault_test";

export const mockAdapter: WalletAdapter = {
  isInstalled: () => true,

  connect: async () => ({
    address: MOCK_ADDRESS,
    network: MOCK_NETWORK,
  }),

  disconnect: async () => {
    // no-op in mock
  },

  signMessage: async (_message: string) => MOCK_SIGNATURE,

  sendTransaction: async (_payload: unknown) => ({ txHash: MOCK_TX_HASH }),
};
