import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getPublicClient } from "../client";
import { REGISTRY_ABI, REGISTRY_ADDRESS } from "../contracts";

export const checkReputationTool = new DynamicStructuredTool({
    name: "check_reputation",
    description:
        "Check the reputation score and full stats of a .leash agent. " +
        "Returns score, payment count, task count, failure count, and rank eligibility.",
    schema: z.object({
        username: z.string().min(1).describe("Agent's .leash username (e.g. 'alvin' or 'alvin.leash')"),
    }),
    func: async ({ username }) => {
        try {
            const client = getPublicClient();
            const agent = await client.readContract({
                address: REGISTRY_ADDRESS,
                abi: REGISTRY_ABI,
                functionName: "getProfile",
                args: [username],
            }) as any;

            const score = Number(agent.reputationScore);

            const tier =
                score === 0   ? "Unproven"    :
                score < 10    ? "Novice"      :
                score < 30    ? "Established" :
                score < 75    ? "Trusted"     :
                score < 150   ? "Verified"    :
                                "Elite";

            return JSON.stringify({
                success: true,
                username: agent.username,
                wallet: agent.wallet,
                reputationScore: score,
                tier,
                stats: {
                    successfulPayments: Number(agent.successfulPayments),
                    successfulTasks:    Number(agent.successfulTasks),
                    failedTasks:        Number(agent.failedTasks),
                },
                registeredAt: new Date(Number(agent.registeredAt) * 1000).toISOString(),
            });
        } catch (err: any) {
            return JSON.stringify({ success: false, error: err.shortMessage ?? err.message });
        }
    },
});
