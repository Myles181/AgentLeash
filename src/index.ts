export { registerAgentTool }   from "./tools/registerAgent";
export { resolveAgentTool }    from "./tools/resolveAgent";
export { checkReputationTool } from "./tools/checkReputation";
export { leashedTransferTool } from "./tools/leashedTransfer";
export { recordTaskTool }      from "./tools/recordTask";
export { getLeaderboardTool }  from "./tools/getLeaderboard";

import { registerAgentTool }   from "./tools/registerAgent";
import { resolveAgentTool }    from "./tools/resolveAgent";
import { checkReputationTool } from "./tools/checkReputation";
import { leashedTransferTool } from "./tools/leashedTransfer";
import { recordTaskTool }      from "./tools/recordTask";
import { getLeaderboardTool }  from "./tools/getLeaderboard";

// Drop-in array for LangChain agent tool initialization
export const agentLeashTools = [
    registerAgentTool,
    resolveAgentTool,
    checkReputationTool,
    leashedTransferTool,
    recordTaskTool,
    getLeaderboardTool,
];
