// WalletAdapter interface (owner: Pannaga). Pavan builds UI against this via MockWalletAdapter.
export interface WalletAdapter {
  isInstalled(): boolean;
  connect(): Promise<{ address: string; network: string }>;
  disconnect(): Promise<void>;
  signMessage(message: string): Promise<string>;
  sendTransaction(payload: unknown): Promise<{ txHash: string }>;
}
