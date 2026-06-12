import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getPublicClient } from "../client";
import { REGISTRY_ABI, REGISTRY_ADDRESS } from "../contracts";

export const getLeaderboardTool = new DynamicStructuredTool({
    name: "get_leaderboard",
    description:
        "Returns the top .leash agents ranked by reputation score, highest first. " +
        "Use this to discover trusted agents, find agents eligible for high-threshold payments, " +
        "or check your own rank.",
    schema: z.object({
        limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(10)
            .describe("Number of top agents to return (max 50, default 10)"),
    }),
    func: async ({ limit }) => {
        try {
            const client = getPublicClient();

            const [agents, total] = await Promise.all([
                client.readContract({
                    address: REGISTRY_ADDRESS,
                    abi: REGISTRY_ABI,
                    functionName: "getTopAgents",
                    args: [BigInt(limit)],
                }) as Promise<any[]>,
                client.readContract({
                    address: REGISTRY_ADDRESS,
                    abi: REGISTRY_ABI,
                    functionName: "totalAgents",
                }),
            ]);

            const ranked = agents.map((agent: any, index: number) => ({
                rank: index + 1,
                username: agent.username,
                wallet: agent.wallet,
                reputationScore: Number(agent.reputationScore),
                successfulPayments: Number(agent.successfulPayments),
                successfulTasks: Number(agent.successfulTasks),
                failedTasks: Number(agent.failedTasks),
            }));

            return JSON.stringify({
                success: true,
                showing: ranked.length,
                totalRegistered: Number(total),
                leaderboard: ranked,
            });
        } catch (err: any) {
            return JSON.stringify({ success: false, error: err.shortMessage ?? err.message });
        }
    },
});
