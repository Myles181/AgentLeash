import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { agentLeashTools } from "../src/index";

const server = new McpServer({
    name: "agentleash",
    version: "1.0.0",
});

// Register each LangChain tool as an MCP tool by bridging schemas
for (const tool of agentLeashTools) {
    server.tool(
        tool.name,
        tool.description,
        // Extract Zod schema shape for MCP registration
        (tool.schema as z.ZodObject<any>).shape,
        async (args: any) => {
            const result = await tool.invoke(args);
            return {
                content: [{ type: "text" as const, text: result }],
            };
        }
    );
}

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("AgentLeash MCP server running on stdio");
}

main().catch(console.error);
