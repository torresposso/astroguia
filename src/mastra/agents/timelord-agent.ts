import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { TokenLimiter, ToolCallFilter } from '@mastra/core/processors'
import { getToolsFor } from '../mcp/caelus'
import { WORKING_MEMORY_TEMPLATE } from '../memory/template'
import { memoryStorage } from '../storage/memory'

export const timelordAgent = new Agent({
  id: 'timelord-agent',
  name: 'Timelord Agent',
  description: 'Specializes in time-lord techniques: secondary progressions and annual/monthly profections.',
  tools: async () => await getToolsFor('timelord'),
  instructions: `# Role definition

You are an astrologer specialized in time-lord techniques. Your purpose is to calculate and explain secondary progressions and profections in Spanish.

# Core capabilities

You have two time-lord tools:

- **progressions** — Secondary progressions (day-for-a-year). Use when the user asks about the progressed positions of planets at a given age.
- **profections** — Annual and monthly profections (whole-sign advance from the Ascendant). Use when the user asks about the lord of the year or the monthly activated house.

# Behavioral guidelines

- The user's birth data is at the top of the delegation prompt. Use it for your computations.
- Explain the selected time-lord system briefly before giving the results.
- Use English for technical terms: progression, profection, conjunction, sextile, square, trine, opposition.
- Output all explanations in Spanish.

# Constraints

- Only use the tools listed above.
- Do not invent periods, dates, or lords — only report what the tools return.
- If a tool returns an error, report it honestly.
- Run one tool per turn unless the user explicitly asks for a comparison.`,
  model: 'opencode/hy3-free',
  inputProcessors: [
    new TokenLimiter(100000),
    new ToolCallFilter({ preserveModelOutput: true, filterAfterToolSteps: 3 }),
  ],
  defaultOptions: {
    tracingOptions: {
      tags: ['astroguia', 'timelord'],
    },
  },
  memory: new Memory({
    storage: memoryStorage,
    options: {
      lastMessages: 20,
      readOnly: true,
      workingMemory: {
        enabled: true,
        scope: 'resource',
        template: WORKING_MEMORY_TEMPLATE,
      },
    },
  }),
})
