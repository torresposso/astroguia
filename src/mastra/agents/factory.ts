import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { TokenLimiter, ToolCallFilter } from '@mastra/core/processors'
import { getToolsFor, AGENT_TOOLS } from '../mcp/caelus'
import { WORKING_MEMORY_TEMPLATE } from '../memory/template'
import { memoryStorage } from '../storage/memory'

type AgentDomain = Exclude<keyof typeof AGENT_TOOLS, 'consultation'>

export function createSpecialistAgent(config: {
  id: string
  name: string
  description: string
  domain: AgentDomain
  instructions: string
}) {
  return new Agent({
    id: config.id,
    name: config.name,
    description: config.description,
    tools: async () => await getToolsFor(config.domain),
    instructions: config.instructions,
    model: 'opencode/hy3-free',
    inputProcessors: [
      new TokenLimiter(100000),
      new ToolCallFilter({ preserveModelOutput: true, filterAfterToolSteps: 3 }),
    ],
    defaultOptions: {
      tracingOptions: {
        tags: ['astroguia', config.domain],
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
}
