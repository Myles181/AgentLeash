export const REGISTRY_ADDRESS = (process.env.REGISTRY_ADDRESS ?? "0x0") as `0x${string}`;
export const TRANSFER_ADDRESS  = (process.env.TRANSFER_ADDRESS  ?? "0x0") as `0x${string}`;

// AgentView tuple — returned by getProfile, getProfileByAddress, getTopAgents
const AGENT_VIEW_TUPLE = {
    name: "",
    type: "tuple",
    components: [
        { name: "wallet",             type: "address" },
        { name: "username",           type: "string"  },
        { name: "reputationScore",    type: "uint64"  },
        { name: "successfulPayments", type: "uint64"  },
        { name: "successfulTasks",    type: "uint64"  },
        { name: "failedTasks",        type: "uint64"  },
        { name: "registeredAt",       type: "uint64"  },
    ],
} as const;

export const REGISTRY_ABI = [
    // Registration
    {
        name: "register",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "prefix", type: "string" }],
        outputs: [],
    },
    // Resolution
    {
        name: "resolve",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "input", type: "string" }],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "reverseResolve",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "wallet", type: "address" }],
        outputs: [{ name: "", type: "string" }],
    },
    // Profiles — now return AgentView (uint64 fields, includes wallet + username)
    {
        name: "getProfile",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "input", type: "string" }],
        outputs: [AGENT_VIEW_TUPLE],
    },
    {
        name: "getProfileByAddress",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "wallet", type: "address" }],
        outputs: [AGENT_VIEW_TUPLE],
    },
    {
        name: "isRegistered",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "wallet", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
    // Leaderboard
    {
        name: "getTopAgents",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "limit", type: "uint256" }],
        outputs: [{ ...AGENT_VIEW_TUPLE, type: "tuple[]" }],
    },
    {
        name: "totalAgents",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    // Reputation writes
    {
        name: "recordPaymentSuccess",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "agent", type: "address" }],
        outputs: [],
    },
    {
        name: "recordTaskSuccess",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "agent", type: "address" }],
        outputs: [],
    },
    {
        name: "recordFailure",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "agent", type: "address" }],
        outputs: [],
    },
    // Admin
    {
        name: "setAuthorized",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "caller", type: "address" },
            { name: "status", type: "bool"    },
        ],
        outputs: [],
    },
    {
        name: "transferOwnership",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "newOwner", type: "address" }],
        outputs: [],
    },
    {
        name: "owner",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "authorized",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "caller", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
    // Fix 11: resetRegistration added for dev/testing — removes a wallet's registration so it can be re-registered later
    {
        name: "resetRegistration",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "wallet", type: "address" }],
        outputs: [],
    },
] as const;

export const TRANSFER_ABI = [
    {
        name: "leashedTransfer",
        type: "function",
        stateMutability: "payable",
        inputs: [
            { name: "recipientUsername", type: "string"  },
            { name: "minRepScore",       type: "uint256" },
        ],
        outputs: [],
    },
    {
        name: "recordTask",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "agentUsername", type: "string" },
            { name: "success",       type: "bool"   },
        ],
        outputs: [],
    },
    {
        name: "setAuthorized",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "caller", type: "address" },
            { name: "status", type: "bool"    },
        ],
        outputs: [],
    },
    {
        name: "transferOwnership",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "newOwner", type: "address" }],
        outputs: [],
    },
    {
        name: "owner",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
    {
        name: "authorized",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "caller", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
] as const;
