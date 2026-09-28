import { config } from "@/lib/config";
import { mockAdapter } from "./mock-adapter";
import { bridgekeyAdapter } from "./bridgekey-adapter";

export const wallet = config.walletMode === "bridgekey" ? bridgekeyAdapter : mockAdapter;
