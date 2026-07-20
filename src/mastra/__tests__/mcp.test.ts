import { describe, it, expect, vi } from 'vitest';
import { getToolsFor, mcpClient } from '../mcp/caelus';

describe('mcp tools filtering', () => {
  it('should filter caelus-mcp tools correctly for each agent', async () => {
    // Mock listTools to return a simulated list of namespaced tools
    const mockTools = {
      caelus_natal_chart: { name: 'caelus_natal_chart' },
      caelus_chart_facts: { name: 'caelus_chart_facts' },
      caelus_transits: { name: 'caelus_transits' },
      caelus_synastry: { name: 'caelus_synastry' },
      caelus_dasha: { name: 'caelus_dasha' },
      caelus_returns: { name: 'caelus_returns' },
      caelus_rectification_grid: { name: 'caelus_rectification_grid' },
      caelus_non_existent: { name: 'caelus_non_existent' },
    };

    vi.spyOn(mcpClient, 'listTools').mockResolvedValue(mockTools as any);

    // Natal agent should only get natal tools
    const natalTools = await getToolsFor('natal');
    expect(Object.keys(natalTools)).toContain('caelus_natal_chart');
    expect(Object.keys(natalTools)).toContain('caelus_chart_facts');
    expect(Object.keys(natalTools)).not.toContain('caelus_transits');

    // Transit agent should only get transit tools
    const transitTools = await getToolsFor('transit');
    expect(Object.keys(transitTools)).toContain('caelus_transits');
    expect(Object.keys(transitTools)).not.toContain('caelus_natal_chart');

    // Consultation agent should get zero caelus tools
    const consultationTools = await getToolsFor('consultation');
    expect(Object.keys(consultationTools)).toHaveLength(0);
  });
});
