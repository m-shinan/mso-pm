import { handleMcp } from "@/features/mcp/server";

// /api/mcp is the MCP endpoint; /api/mcp/oauth-protected-resource tells clients where to sign in.
const handle = (req: Request) => handleMcp(req);

export { handle as GET, handle as POST, handle as DELETE, handle as OPTIONS };
