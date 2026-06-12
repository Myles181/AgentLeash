import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
    solidity: "0.8.20",
    networks: {
        pharos: {
            url: process.env.PHAROS_RPC_URL ?? "https://atlantic.dplabs-internal.com",
            accounts: [process.env.PRIVATE_KEY!],
            chainId: 688689,
        },
    },
};

export default config;
