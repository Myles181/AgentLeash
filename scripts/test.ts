import * as dotenv from "dotenv";
dotenv.config();

import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { REGISTRY_ABI, REGISTRY_ADDRESS, TRANSFER_ABI, TRANSFER_ADDRESS } from "../src/contracts";
import { pharosTestnet } from "../src/client";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: pharosTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: pharosTestnet, transport: http() });

// Unique prefix per run so re-running the test never hits "Already registered"
const prefix = `demo${Date.now()}`;

async function main() {
    console.log("\n=== AgentLeash End-to-End Test ===\n");
    console.log(`Using prefix: ${prefix}.leash\n`);

    console.log("0. Resetting registration for clean run...");
    try {
        const resetHash = await walletClient.writeContract({
            address: REGISTRY_ADDRESS,
            abi: REGISTRY_ABI,
            functionName: "resetRegistration",
            args: [account.address],
        });
        await publicClient.waitForTransactionReceipt({ hash: resetHash });
        console.log("   Reset done\n");
    } catch (err: any) {
        console.log("   Not registered yet, skipping reset\n");
    }

    // 1. Verify access control is set up correctly before anything else
    console.log("1. Verifying access control...");
    const transferOwner = await publicClient.readContract({
        address: TRANSFER_ADDRESS,
        abi: TRANSFER_ABI,
        functionName: "owner",
    }) as `0x${string}`;
    const registryOwner = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "owner",
    }) as `0x${string}`;
    const transferAuthorizedInRegistry = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "authorized",
        args: [TRANSFER_ADDRESS],
    }) as boolean;

    console.log("   LeashGatedTransfer owner:", transferOwner);
    console.log("   AgentRegistry owner:     ", registryOwner);
    console.log("   Transfer authorized in Registry:", transferAuthorizedInRegistry);

    if (transferOwner.toLowerCase() !== account.address.toLowerCase()) {
        throw new Error("Deployer is not owner of LeashGatedTransfer — recordTask will fail");
    }
    if (!transferAuthorizedInRegistry) {
        throw new Error("LeashGatedTransfer is not authorized in AgentRegistry — reputation writes will fail");
    }
    console.log("   Access control OK\n");

    // 2. Register agent
    console.log(`2. Registering agent as '${prefix}.leash'...`);
    const registerHash = await walletClient.writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "register",
        args: [prefix],
    });
    await publicClient.waitForTransactionReceipt({ hash: registerHash });
    console.log("   Registered! tx:", registerHash);

    // 3. Check profile — score starts at 0, wallet and username populated
    console.log("\n3. Fetching profile...");
    const profile = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getProfile",
        args: [prefix],
    }) as any;
    console.log("   Username:  ", profile.username);
    console.log("   Wallet:    ", profile.wallet);
    console.log("   Score:     ", profile.reputationScore.toString(), "(expected 0)");
    console.log("   Payments:  ", profile.successfulPayments.toString());
    console.log("   Tasks:     ", profile.successfulTasks.toString());

    if (profile.reputationScore.toString() !== "0") throw new Error("Score should start at 0");

    // 4. Record task success — caller is owner of LeashGatedTransfer so onlyAuthorized passes
    console.log("\n4. Recording task success (+3 score)...");
    const taskHash = await walletClient.writeContract({
        address: TRANSFER_ADDRESS,
        abi: TRANSFER_ABI,
        functionName: "recordTask",
        args: [`${prefix}.leash`, true],
    });
    await publicClient.waitForTransactionReceipt({ hash: taskHash });
    console.log("   Recorded! tx:", taskHash);

    const afterTask = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getProfile",
        args: [prefix],
    }) as any;
    console.log("   New score:", afterTask.reputationScore.toString(), "(expected 3)");
    if (afterTask.reputationScore.toString() !== "3") throw new Error("Score should be 3 after task success");

    // 5. Record task failure — score should drop by 2
    console.log("\n5. Recording task failure (-2 score)...");
    const failHash = await walletClient.writeContract({
        address: TRANSFER_ADDRESS,
        abi: TRANSFER_ABI,
        functionName: "recordTask",
        args: [`${prefix}.leash`, false],
    });
    await publicClient.waitForTransactionReceipt({ hash: failHash });

    const afterFail = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getProfile",
        args: [prefix],
    }) as any;
    console.log("   Score after failure:", afterFail.reputationScore.toString(), "(expected 1)");
    if (afterFail.reputationScore.toString() !== "1") throw new Error("Score should be 1 after failure");

    // 6. Reputation gate — blocked (minScore=10, agent has 1)
    console.log("\n6. Testing reputation gate (minScore=10, agent has 1)...");
    try {
        await walletClient.writeContract({
            address: TRANSFER_ADDRESS,
            abi: TRANSFER_ABI,
            functionName: "leashedTransfer",
            args: [`${prefix}.leash`, BigInt(10)],
            value: parseEther("0.001"),
        });
        throw new Error("Should have been blocked!");
    } catch (err: any) {
        const msg: string = err.shortMessage ?? err.message ?? "";
        if (msg.includes("minimum required")) {
            console.log("   Blocked correctly: reputation gate fired");
        } else if (msg.includes("Should have been blocked")) {
            throw err;
        } else {
            throw new Error(`Unexpected error: ${msg}`);
        }
    }

    // 7. Build score up then do allowed transfer
    console.log("\n7. Building score then testing allowed transfer...");
    // Record 3 more task successes → score becomes 1 + 9 = 10
    for (let i = 0; i < 3; i++) {
        const h = await walletClient.writeContract({
            address: TRANSFER_ADDRESS,
            abi: TRANSFER_ABI,
            functionName: "recordTask",
            args: [`${prefix}.leash`, true],
        });
        await publicClient.waitForTransactionReceipt({ hash: h });
    }

    const beforeTransfer = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getProfile",
        args: [prefix],
    }) as any;
    console.log("   Score before transfer:", beforeTransfer.reputationScore.toString(), "(expected 10)");

    // Now transfer with minScore=10 — should pass (CEI: score updates before ETH moves)
    const transferHash = await walletClient.writeContract({
        address: TRANSFER_ADDRESS,
        abi: TRANSFER_ABI,
        functionName: "leashedTransfer",
        args: [`${prefix}.leash`, BigInt(10)],
        value: parseEther("0.001"),
    });
    await publicClient.waitForTransactionReceipt({ hash: transferHash });
    console.log("   Transfer sent! tx:", transferHash);

    // Score should be 11 now (CEI: +1 from payment recorded before ETH left)
    const afterTransfer = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getProfile",
        args: [prefix],
    }) as any;
    console.log("   Score after transfer:", afterTransfer.reputationScore.toString(), "(expected 11 — CEI +1 recorded before ETH moved)");

    // 8. Leaderboard
    console.log("\n8. Leaderboard (top 5)...");
    const top = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "getTopAgents",
        args: [BigInt(5)],
    }) as any[];
    top.forEach((a: any, i: number) => {
        console.log(`   #${i + 1} ${a.username} — score: ${a.reputationScore.toString()}`);
    });

    console.log("\n=== All tests passed ===\n");
}

main().catch((err) => {
    console.error("\n FAILED:", err.message);
    process.exit(1);
});
