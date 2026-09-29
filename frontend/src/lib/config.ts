const rawApi = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
const sanitizedApiUrl = (rawApi && rawApi.trim() !== "" ? rawApi.trim() : "http://localhost:8000").replace(/\/api\/?$/, "");

export const config = {
  apiUrl: sanitizedApiUrl,
  apiMode: (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_MODE) || "real",
  walletMode: (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WALLET_MODE) || "bridgekey",
  mstscanBaseUrl: (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MSTSCAN_BASE_URL) || "https://mstscan.io",
};

