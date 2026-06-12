import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getWalletClient, getPublicClient } from "../client";
import { TRANSFER_ABI, TRANSFER_ADDRESS } from "../contracts";

export const recordTaskTool = new DynamicStructuredTool({
    name: "record_task",
    description:
        "Record the outcome of a completed task for a .leash agent. " +
        "Success adds +3 reputation. Failure deducts 2 (floor is 0). " +
        "Use this after any agent completes or fails an assigned job.",
    schema: z.object({
        agentUsername: z
            .string()
            .min(1)
            .describe("Agent's .leash username (e.g. 'alvin' or 'alvin.leash')"),
        success: z
            .boolean()
            .describe("True if the task was completed successfully, false if it failed"),
    }),
    func: async ({ agentUsername, success }) => {
        try {
            const wallet = getWalletClient();
            const client = getPublicClient();

            const hash = await wallet.writeContract({
                address: TRANSFER_ADDRESS,
                abi: TRANSFER_ABI,
                functionName: "recordTask",
                args: [agentUsername, success],
            });

            await client.waitForTransactionReceipt({ hash });

            const delta = success ? "+3" : "-2";
            return JSON.stringify({
                success: true,
                agent: agentUsername,
                outcome: success ? "completed" : "failed",
                scoreDelta: delta,
                txHash: hash,
                message: `Task ${success ? "success" : "failure"} recorded for ${agentUsername}. Score changed by ${delta}.`,
            });
        } catch (err: any) {
            return JSON.stringify({ success: false, error: err.shortMessage ?? err.message });
        }
    },
});
