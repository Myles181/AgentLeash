import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getWalletClient, getPublicClient } from "../client";
import { REGISTRY_ABI, REGISTRY_ADDRESS } from "../contracts";

export const registerAgentTool = new DynamicStructuredTool({
    name: "register_agent",
    description:
        "Register an AI agent with a .leash username on Pharos. " +
        "The username will be stored as 'prefix.leash' (e.g. 'alvin.leash'). " +
        "Prefix must be lowercase letters, numbers, or underscores. Each wallet can only register once.",
    schema: z.object({
        prefix: z
            .string()
            .min(1)
            .max(32)
            .regex(/^[a-z0-9_]+$/, "Prefix must be lowercase letters, numbers, or underscores")
            .describe("Username prefix — becomes prefix.leash on-chain"),
    }),
    func: async ({ prefix }) => {
        try {
            const wallet = getWalletClient();
            const client = getPublicClient();

            const hash = await wallet.writeContract({
                address: REGISTRY_ADDRESS,
                abi: REGISTRY_ABI,
                functionName: "register",
                args: [prefix],
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            return JSON.stringify({
                success: true,
                username: `${prefix}.leash`,
                txHash: hash,
                blockNumber: receipt.blockNumber.toString(),
                message: `Agent registered as ${prefix}.leash. Reputation starts at 0 — earn score through payments and tasks.`,
            });
        } catch (err: any) {
            return JSON.stringify({ success: false, error: err.shortMessage ?? err.message });
        }
    },
});
