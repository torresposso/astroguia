import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersonRepository } from '../storage/persons';

vi.mock('../mcp/caelus', () => {
  const createMockTool = (name: string) => ({
    execute: vi.fn().mockImplementation(async (args: any) => {
      return { tool: name, received: args, success: true };
    }),
  });

  const mockTools: Record<string, any> = {
    'caelus_chart_facts': createMockTool('chart_facts'),
    'caelus_dasha': createMockTool('dasha'),
    'caelus_firdaria': createMockTool('firdaria'),
    'caelus_directions': createMockTool('directions'),
    'caelus_releasing': createMockTool('releasing'),
  };

  return {
    mcpClient: {
      listToolsWithErrors: vi.fn().mockResolvedValue({ tools: mockTools, errors: {} }),
    },
    getToolsFor: vi.fn().mockResolvedValue({}),
  };
});

describe('computeAllCharts', () => {
  let repo: PersonRepository;
  let personId: string;

  beforeEach(async () => {
    repo = new PersonRepository('file::memory:');
    await repo.init();

    const person = await repo.create({
      name: 'Compute Test',
      birth_date: '1990-06-10',
      birth_time: '14:30',
      birth_city: 'Tampa',
      birth_lat: 27.95,
      birth_lon: -82.46,
      timezone: 'America/New_York',
    });
    personId = person.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await repo.close();
  });

  it('should compute and store chart data for a person', async () => {
    const { computeAllChartsForPerson } = await import('../storage/persons');
    const result = await computeAllChartsForPerson(personId, repo);

    expect(result.success).toBe(true);
    expect(result.computed_at).toBeDefined();

    const chartData = await repo.loadChartData(personId);
    expect(chartData).not.toBeNull();
    expect(chartData?.chart_facts).toBeDefined();
    expect(chartData?.dasha).toBeDefined();
    expect(chartData?.firdaria).toBeDefined();
    expect(chartData?.directions).toBeDefined();
    expect(chartData?.releasing).toBeDefined();
  });

  it('should pass max_years for directions and horizon_years for releasing', async () => {
    const { computeAllChartsForPerson } = await import('../storage/persons');
    await computeAllChartsForPerson(personId, repo);

    const { mcpClient } = await import('../mcp/caelus');
    const tools = await mcpClient.listToolsWithErrors();

    const directionsTool = tools.tools['caelus_directions'];
    expect(directionsTool.execute).toHaveBeenCalledWith(
      expect.objectContaining({ max_years: 120 }),
      expect.anything(),
    );

    const releasingTool = tools.tools['caelus_releasing'];
    expect(releasingTool.execute).toHaveBeenCalledWith(
      expect.objectContaining({ horizon_years: 100 }),
      expect.anything(),
    );
  });

  it('should handle partial tool failures', async () => {
    const { mcpClient } = await import('../mcp/caelus');
    const failingMock = {
      'caelus_chart_facts': {
        execute: vi.fn().mockResolvedValue({ tool: 'chart_facts', success: true }),
      },
      'caelus_dasha': {
        execute: vi.fn().mockResolvedValue({ tool: 'dasha', success: true }),
      },
      'caelus_firdaria': {
        execute: vi.fn().mockRejectedValue(new Error('firdaria timeout')),
      },
      'caelus_directions': {
        execute: vi.fn().mockResolvedValue({ tool: 'directions', success: true }),
      },
      'caelus_releasing': {
        execute: vi.fn().mockRejectedValue(new Error('releasing failed')),
      },
    };
    vi.mocked(mcpClient.listToolsWithErrors).mockResolvedValue({ tools: failingMock as any, errors: {} });

    const { computeAllChartsForPerson } = await import('../storage/persons');
    const result = await computeAllChartsForPerson(personId, repo);

    expect(result.success).toBe(true);

    const chartData = await repo.loadChartData(personId);
    expect(chartData?.chart_facts).toBeDefined();
    expect(chartData?.dasha).toBeDefined();
    expect(chartData?.firdaria).toEqual({ error: 'firdaria timeout' });
    expect(chartData?.directions).toBeDefined();
    expect(chartData?.releasing).toEqual({ error: 'releasing failed' });
  });

  it('should throw when all tools fail', async () => {
    const { mcpClient } = await import('../mcp/caelus');
    const allFailing = {
      'caelus_chart_facts': { execute: vi.fn().mockRejectedValue(new Error('connection failed')) },
      'caelus_dasha': { execute: vi.fn().mockRejectedValue(new Error('connection failed')) },
    };
    vi.mocked(mcpClient.listToolsWithErrors).mockResolvedValue({ tools: allFailing as any, errors: {} });

    const { computeAllChartsForPerson } = await import('../storage/persons');
    await expect(computeAllChartsForPerson(personId, repo)).rejects.toThrow(
      'All caelus-mcp tools failed to respond'
    );
  });

  it('should throw for non-existent person', async () => {
    const { computeAllChartsForPerson } = await import('../storage/persons');
    await expect(computeAllChartsForPerson('nonexistent-id', repo)).rejects.toThrow(
      'Person with id nonexistent-id not found'
    );
  });
});
