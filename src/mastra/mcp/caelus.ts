import { MCPClient } from '@mastra/mcp';
import type { Tool } from '@mastra/core/tools';

export const mcpClient = new MCPClient({
  id: 'caelus-mcp-client',
  servers: {
    caelus: {
      command: 'npx',
      args: ['caelus-mcp'],
    },
  },
});

export const AGENT_TOOLS = {
  transit: [
    'transits',
    'find_aspect_dates',
    'current_sky',
    'cosmic_weather',
    'void_of_course',
    'planetary_hours',
    'sky_events',
  ],
  synastry: ['synastry', 'composite'],
  timelord: ['progressions', 'profections'],
  returns: ['returns', 'current_sky'],
  rectification: ['rectification_grid', 'find_aspect_dates'],
  consultation: [],
} as const;

// Module-level cache: caelus-mcp tools are static across the app lifetime.
// Avoids reconnecting to the MCP server on every agent/tool resolution.
let _toolsCache: Record<string, Tool> | null = null;

async function fetchAllTools(): Promise<Record<string, Tool>> {
  if (_toolsCache) return _toolsCache;
  const { tools, errors } = await mcpClient.listToolsWithErrors();
  if (errors?.caelus) {
    console.error('[caelus-mcp] Connection failed:', errors.caelus);
  }
  _toolsCache = tools;
  return tools;
}

export async function getToolsFor(
  agentId: keyof typeof AGENT_TOOLS,
): Promise<Record<string, Tool>> {
  const allTools = await fetchAllTools();

  const allowedSuffixes: readonly string[] = AGENT_TOOLS[agentId];

  const filteredTools: Record<string, Tool> = {};
  for (const [key, tool] of Object.entries(allTools)) {
    const suffix = key.replace(/^caelus_/, '');
    if (allowedSuffixes.includes(suffix)) {
      filteredTools[key] = tool;
    }
  }
  return filteredTools;
}
