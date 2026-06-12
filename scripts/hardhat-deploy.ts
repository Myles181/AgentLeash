import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying from:", deployer.address);

    // 1. Deploy AgentRegistry
    const Registry = await ethers.getContractFactory("AgentRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();
    console.log("AgentRegistry deployed:", registryAddress);

    // 2. Deploy LeashGatedTransfer
    const Transfer = await ethers.getContractFactory("LeashGatedTransfer");
    const transfer = await Transfer.deploy(registryAddress);
    await transfer.waitForDeployment();
    const transferAddress = await transfer.getAddress();
    console.log("LeashGatedTransfer deployed:", transferAddress);

    // 3. Authorize LeashGatedTransfer to write reputation
    await registry.setAuthorized(transferAddress, true);
    console.log("LeashGatedTransfer authorized");

    console.log("\n--- Add these to your .env ---");
    console.log(`REGISTRY_ADDRESS=${registryAddress}`);
    console.log(`TRANSFER_ADDRESS=${transferAddress}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
