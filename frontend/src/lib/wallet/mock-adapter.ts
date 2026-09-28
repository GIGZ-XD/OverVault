import type { WalletAdapter } from "./adapter";

export const mockAdapter: WalletAdapter = {
  isInstalled: () => true,
  connect: async () => ({ address: "0xaaa1", network: "MST Testnet" }),
  disconnect: async () => {},
  signMessage: async () => "0xmocksignature",
  sendTransaction: async () => ({ txHash: "0xmocktx" }),
};
