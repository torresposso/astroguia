import { describe, it, expect, vi } from 'vitest';
import { getToolsFor, mcpClient } from '../mcp/caelus';

describe('mcp tools filtering', () => {
  it('should filter caelus-mcp tools correctly for each agent', async () => {
    const mockTools = {
      caelus_natal_chart: { name: 'caelus_natal_chart' },
      caelus_chart_facts: { name: 'caelus_chart_facts' },
      caelus_transits: { name: 'caelus_transits' },
      caelus_synastry: { name: 'caelus_synastry' },
      caelus_dasha: { name: 'caelus_dasha' },
      caelus_progressions: { name: 'caelus_progressions' },
      caelus_profections: { name: 'caelus_profections' },
      caelus_returns: { name: 'caelus_returns' },
      caelus_rectification_grid: { name: 'caelus_rectification_grid' },
    };

    const spy = vi.spyOn(mcpClient, 'listToolsWithErrors').mockResolvedValue({
      tools: mockTools as any,
      errors: {},
    });

    // Timelord agent should only get progressions and profections
    const timelordTools = await getToolsFor('timelord');
    expect(Object.keys(timelordTools)).toContain('caelus_progressions');
    expect(Object.keys(timelordTools)).toContain('caelus_profections');
    expect(Object.keys(timelordTools)).not.toContain('caelus_dasha');

    // Transit agent should only get transit tools
    const transitTools = await getToolsFor('transit');
    expect(Object.keys(transitTools)).toContain('caelus_transits');
    expect(Object.keys(transitTools)).not.toContain('caelus_synastry');

    // Consultation agent should get zero caelus tools
    const consultationTools = await getToolsFor('consultation');
    expect(Object.keys(consultationTools)).toHaveLength(0);
  });
});
