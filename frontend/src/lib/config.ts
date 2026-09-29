function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:8000`;
    }
  }
  const rawApi = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined;
  return (rawApi && rawApi.trim() !== "" ? rawApi.trim() : "http://localhost:8000").replace(/\/api\/?$/, "");
}

export const config = {
  get apiUrl() {
    return getApiUrl();
  },
  apiMode: (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_MODE) || "real",
  walletMode: (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WALLET_MODE) || "bridgekey",
  mstscanBaseUrl: (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MSTSCAN_BASE_URL) || "https://mstscan.io",
};

