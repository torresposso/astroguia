import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';
import { db, CHART_DATA_TOOLS } from '../storage/persons';

export const loadChartData = createTool({
  id: 'load_chart_data',
  description: 'Loads pre-computed astrological chart data for a person by tool name. Returns the raw JSON result for the specified tool, or null if not yet computed.',
  inputSchema: z.object({
    personId: z.string().describe('ID of the person'),
    toolName: z.enum(CHART_DATA_TOOLS).describe('The specific chart data tool to load'),
  }),
  execute: async ({ personId, toolName }) => {
    const chartData = await db.loadChartData(personId);
    if (!chartData) {
      return { success: true, data: null };
    }
    const result = chartData[toolName] ?? null;
    return { success: true, data: result };
  },
});
