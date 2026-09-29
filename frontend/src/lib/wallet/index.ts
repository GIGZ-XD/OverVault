import { config } from "@/lib/config";
import { mockAdapter } from "@/lib/wallet/mock-adapter";
import { bridgekeyAdapter } from "@/lib/wallet/bridgekey-adapter";

export const wallet = config.walletMode === "bridgekey" ? bridgekeyAdapter : mockAdapter;
