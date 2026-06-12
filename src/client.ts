import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Pharos testnet chain definition
export const pharosTestnet = {
    id: 688689,
    name: "Pharos Atlantic Testnet",
    nativeCurrency: { name: "PHRS", symbol: "PHRS", decimals: 18 },
    rpcUrls: {
        default: { http: [process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com"] },
    },
} as const;

function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
}

export function getPublicClient() {
    return createPublicClient({
        chain: pharosTestnet,
        transport: http(),
    });
}

export function getWalletClient() {
    const account = privateKeyToAccount(requireEnv("PRIVATE_KEY") as `0x${string}`);
    return createWalletClient({
        account,
        chain: pharosTestnet,
        transport: http(),
    });
}

export function getAccount() {
    return privateKeyToAccount(requireEnv("PRIVATE_KEY") as `0x${string}`);
}
