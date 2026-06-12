import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { parseEther } from "viem";
import { getWalletClient, getPublicClient } from "../client";
import { TRANSFER_ABI, TRANSFER_ADDRESS } from "../contracts";

export const leashedTransferTool = new DynamicStructuredTool({
    name: "leashed_transfer",
    description:
        "Send PROS tokens to a .leash agent, but only if their reputation meets the minimum threshold. " +
        "If the agent's score is too low, the transfer is blocked and the reason is returned. " +
        "Use minRepScore=0 to send to any registered agent regardless of history.",
    schema: z.object({
        recipientUsername: z
            .string()
            .min(1)
            .describe("Recipient's .leash username (e.g. 'alvin' or 'alvin.leash')"),
        amountPros: z
            .string()
            .describe("Amount in PROS to send (e.g. '0.5' for 0.5 PROS)"),
        minRepScore: z
            .number()
            .int()
            .min(0)
            .describe("Minimum reputation score the recipient must have. Use 0 for no restriction."),
    }),
    func: async ({ recipientUsername, amountPros, minRepScore }) => {
        try {
            const wallet = getWalletClient();
            const client = getPublicClient();

            const hash = await wallet.writeContract({
                address: TRANSFER_ADDRESS,
                abi: TRANSFER_ABI,
                functionName: "leashedTransfer",
                args: [recipientUsername, BigInt(minRepScore)],
                value: parseEther(amountPros),
            });

            const receipt = await client.waitForTransactionReceipt({ hash });

            return JSON.stringify({
                success: true,
                recipient: recipientUsername,
                amount: `${amountPros} PROS`,
                minRepScore,
                txHash: hash,
                blockNumber: receipt.blockNumber.toString(),
                message: `${amountPros} PROS sent to ${recipientUsername}. Their reputation score has been updated.`,
            });
        } catch (err: any) {
            const msg: string = err.shortMessage ?? err.message ?? "";
            // Surface the human-readable contract revert reason
            const gateMatch = msg.match(/has reputation score (\d+) — minimum required is (\d+)/);
            if (gateMatch) {
                return JSON.stringify({
                    success: false,
                    blocked: true,
                    recipient: recipientUsername,
                    recipientScore: Number(gateMatch[1]),
                    requiredScore: Number(gateMatch[2]),
                    message: `Transfer blocked: ${recipientUsername} has score ${gateMatch[1]} but you require at least ${gateMatch[2]}.`,
                });
            }
            return JSON.stringify({ success: false, error: msg });
        }
    },
});
