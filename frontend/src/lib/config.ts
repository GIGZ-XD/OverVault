export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  apiMode: process.env.NEXT_PUBLIC_API_MODE ?? "mock",
  walletMode: process.env.NEXT_PUBLIC_WALLET_MODE ?? "mock",
  mstscanBaseUrl: process.env.NEXT_PUBLIC_MSTSCAN_BASE_URL ?? "",
};
