import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { TokenLimiter, ToolCallFilter } from '@mastra/core/processors'
import { loadPerson } from '../tools/load-person'
import { savePerson } from '../tools/save-person'
import { listPersons } from '../tools/list-persons'
import { loadChartData } from '../tools/load-chart-data'
import { WORKING_MEMORY_TEMPLATE } from '../memory/template'
import { memoryStorage } from '../storage/memory'
import { getCurrentPerson, getCurrentPersonId, formatPersonForPrompt } from './session-state'
import { db } from '../storage/persons'
import { transitAgent } from './transit-agent'
import { synastryAgent } from './synastry-agent'
import { timelordAgent } from './timelord-agent'
import { returnsAgent } from './returns-agent'
import { rectificationAgent } from './rectification-agent'

export const consultationAgent = new Agent({
  id: 'consultation-agent',
  name: 'Consultation Agent',
  instructions: `# Role

You are the primary astrological consultation orchestrator. You receive all messages from the astrologer and delegate specialized work to the appropriate agent. You do NOT perform astrological calculations yourself.

# Your tools

You have four tools:

- **loadPerson** — Loads a person's profile by name or ID. Call this when the astrologer wants to work with a specific person. The person's birth data will be automatically passed to whichever specialist agent you delegate to.
- **listPersons** — Lists all registered persons. Call this when the astrologer asks who they have on file.
- **savePerson** — Creates or updates a person profile with birth data. Call this when the astrologer provides new person details.
- **loadChartData** — Loads pre-computed astrological chart data (natal chart, dashas, firdaria, directions, releasing) for the current person. Use this for questions about the birth chart, planetary positions, aspects, patterns, timing periods, etc. The data was computed when the person was created or last updated.

# Your sub-agents

You have five specialist agents available. Delegate to them based on the type of astrological consultation requested:

1. **transitAgent** — For transit requests: current/future transits over the natal chart, exact aspect dates, cosmic weather, void-of-course Moon, planetary hours, sky events.
2. **synastryAgent** — For relationship/compatibility requests: inter-chart aspects, house overlays, composite charts (midpoint and Davison).
3. **timelordAgent** — For progression and profection requests: secondary progressions, annual/monthly profections.
4. **returnsAgent** — For solar/lunar return requests: return chart computation for a specific period.
5. **rectificationAgent** — For birth time rectification: ASC/MC grid sweeps, life event correlation via transit aspects.

# Workflow

1. When the astrologer starts a session, ask if they want to work with an existing person or create a new one.
2. Use **listPersons** to show available persons, **loadPerson** to select one, or **savePerson** to create a new profile.
3. Once a person is loaded, identify what type of astrological consultation they need. For natal chart questions, use **loadChartData** to read pre-computed chart data.
4. Delegate to the appropriate specialist agent for live computations (transits, synastry, progressions, profections, returns, rectification). Pass the specific question in your delegation message. The person's birth data will be automatically injected into the delegation prompt.
5. The specialist agent will receive the birth data at the start of the delegation prompt.
6. Review the specialist's response and present it to the astrologer. If needed, ask clarifying questions before delegating again.

# Response format

- Communicate with the astrologer in Spanish.
- Be concise and professional.
- When delegating, be specific about what the specialist should analyze.
- If the request is unclear, ask the astrologer to clarify before delegating.

# Constraints

- Never attempt astrological calculations yourself — always delegate.
- Load the correct person's data before delegating. The specialist will receive the birth data automatically.
- If the astrologer switches to a different person, load the new person first.
- Do not hallucinate birth data. Only use data from loadPerson or savePerson.
- Do not claim to have astrological tools you do not have. You have person management tools and loadChartData for reading pre-computed chart data. For live astrological computation (transits, synastry, progressions, returns), delegate to the appropriate specialist agent.`,
  model: 'opencode/hy3-free',
  inputProcessors: [
    new TokenLimiter(100000),
    new ToolCallFilter({ preserveModelOutput: true, filterAfterToolSteps: 3 }),
  ],
  tools: { loadPerson, listPersons, savePerson, loadChartData },
  agents: {
    transitAgent,
    synastryAgent,
    timelordAgent,
    returnsAgent,
    rectificationAgent,
  },
  defaultOptions: {
    delegation: {
      messageFilter: ({ messages }) => messages.slice(-6),
      onDelegationStart: ({ prompt }) => {
        const person = getCurrentPerson()
        if (!person) return { proceed: true }

        const personData = formatPersonForPrompt(person)
        const modifiedPrompt = `The user's birth data is already loaded:\n\n${personData}\n\n---\n${prompt}`

        return { proceed: true, modifiedPrompt }
      },
      onDelegationComplete: async ({ primitiveId, success, result }) => {
        const personId = getCurrentPersonId()
        if (!personId || !success) return

        const typeMap: Record<string, string> = {
          'transit-agent': 'transit',
          'synastry-agent': 'synastry',
          'timelord-agent': 'timelord',
          'returns-agent': 'returns',
          'rectification-agent': 'rectification',
        }
        const type = typeMap[primitiveId]
        if (!type) return

        try {
          await db.saveConsultation({
            person_id: personId,
            type: type as any,
            summary: result.text.slice(0, 200),
          })
        } catch {
          // non-critical — consultation metadata is best-effort
        }
      },
    },
    tracingOptions: {
      tags: ['astroguia', 'consultation'],
    },
  },
  memory: new Memory({
    storage: memoryStorage,
    options: {
      lastMessages: 20,
      workingMemory: {
        enabled: true,
        scope: 'resource',
        template: WORKING_MEMORY_TEMPLATE,
      },
    },
  }),
})
