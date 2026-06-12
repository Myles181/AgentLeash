import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getPublicClient } from "../client";
import { REGISTRY_ABI, REGISTRY_ADDRESS } from "../contracts";

export const resolveAgentTool = new DynamicStructuredTool({
    name: "resolve_agent",
    description:
        "Look up an agent's wallet address by their .leash username. " +
        "Accepts 'alvin' or 'alvin.leash' — both work.",
    schema: z.object({
        username: z.string().min(1).describe("Agent's .leash username (e.g. 'alvin' or 'alvin.leash')"),
    }),
    func: async ({ username }) => {
        try {
            const client = getPublicClient();
            const address = await client.readContract({
                address: REGISTRY_ADDRESS,
                abi: REGISTRY_ABI,
                functionName: "resolve",
                args: [username],
            });
            return JSON.stringify({ success: true, username, address });
        } catch (err: any) {
            return JSON.stringify({ success: false, error: err.shortMessage ?? err.message });
        }
    },
});
