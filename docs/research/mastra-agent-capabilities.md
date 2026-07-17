# Mastra Agent Capabilities — Enrichment for astroguia

Research complement to `mastra-project-structure.md` and `mastra-caelus-integration.md`. Covers agent-level capabilities discovered in the Mastra docs (agents overview, supervisor agents, structured output, processors, guardrails, memory, agent approval).

**Date**: 2026-07-17
**Sources**: mastra.ai — Agents overview, Supervisor agents, Structured output, Processors, Guardrails, Memory overview, Agent approval, Tools

---

## 1. Summary

The existing research covered agent definition, MCP wiring, and file-based structure but did not cover: **structured output**, **agent-level approval/HITL**, **supervisor delegation hooks**, **processors/guardrails pipeline**, **observational memory**, or **tool lifecycle hooks**. These are not just nice-to-have — several are critical for astroguia's core product: producing typed, structured evolutionary readings with quality control.

---

## 2. Structured Output — Typed Evolutionary Readings

### Gap

Zero coverage in existing research. The only output format discussed is free-text agent responses.

### What it is

Agents can return typed objects matching a Zod/Valibot/ArkType schema instead of plain text. This means the astrologer agent can return a structured reading with sections.

```typescript
import { z } from 'zod'

const evolutionaryReadingSchema = z.object({
  pluto: z.object({
    sign: z.string(),
    house: z.number(),
    interpretation: z.string(),
    evolutionaryIntent: z.string(),
  }),
  nodalAxis: z.object({
    northNodeSign: z.string(),
    northNodeHouse: z.number(),
    southNodeSign: z.string(),
    southNodeHouse: z.number(),
    purposeStatement: z.string(),
    comfortZonePatterns: z.string(),
  }),
  saturn: z.object({
    sign: z.string(),
    house: z.number(),
    lesson: z.string(),
    karmicPattern: z.string(),
  }),
  tenseAspects: z.array(z.object({
    aspect: z.string(),
    bodies: z.array(z.string()),
    orb: z.number(),
    interpretation: z.string(),
  })),
  evolutionaryAxis: z.object({
    houses4_8_12: z.array(z.object({
      house: z.number(),
      planets: z.array(z.string()),
      rulerCondition: z.string(),
    })),
    unconsciousPatterns: z.string(),
  }),
  timeLords: z.object({
    firdaria: z.string(),
    profectionLord: z.string(),
    currentTransits: z.array(z.string()),
  }),
  dignities: z.object({
    strongestPlanet: z.string(),
    peregrinePlanets: z.array(z.string()),
    sectAlignment: z.string(),
  }),
  lunarPhase: z.object({
    phase: z.string(),
    evolutionaryImplication: z.string(),
  }),
  synthesis: z.string(),
})

const response = await astrologerAgent.generate(
  'Cast and interpret chart for 1990-06-10 at 27.95,-82.46',
  {
    structuredOutput: { schema: evolutionaryReadingSchema },
  }
)

console.log(response.object.pluto.interpretation)
console.log(response.object.synthesis)
```

### Model compatibility

**Tools + structured output**: Some models don't support both simultaneously. Three workarounds:

1. **Separate structuring model** — the agent calls Caelus tools for data, a second model structures the result:
   ```typescript
   structuredOutput: {
     schema: evolutionaryReadingSchema,
     model: 'openai/gpt-5.5',  // second model just for structuring
   }
   ```

2. **`prepareStep`** — separate tools and structured output into different steps:
   ```typescript
   prepareStep: async ({ stepNumber }) => {
     if (stepNumber === 0) {
       return { tools: caelusTools, toolChoice: 'required' }
     }
     return { tools: undefined, structuredOutput: { schema: readingSchema } }
   }
   ```

3. **`jsonPromptInjection`** — inject schema as prompt instructions (compatible with all models):
   ```typescript
   structuredOutput: {
     schema: evolutionaryReadingSchema,
     jsonPromptInjection: 'auto',  // auto-selects best strategy per model
   }
   ```

### Error handling for structured output

```typescript
structuredOutput: {
  schema: evolutionaryReadingSchema,
  errorStrategy: 'fallback',
  fallbackValue: {
    pluto: { sign: 'Unknown', house: 0, interpretation: '', evolutionaryIntent: '' },
    // ... all fields with safe defaults
  },
}
```

### Why this matters for astroguia

| Without structured output | With structured output |
|---|---|
| Free-text interpretation, hard to parse | Typed `response.object` with sections |
| No way to validate completeness | Schema ensures all 10 factors are covered |
| UI must regex-parse markdown | UI renders typed fields directly |
| No way to enforce format | Zod schema enforces the evolutionary reading structure |

---

## 3. Supervisor Agents — Multi-Agent Evolutionary Reading

### Gap

Existing research mentions "supervisor agents" in passing but none of: delegation hooks, memory isolation, task completion scoring, message filtering, iteration monitoring, background tasks, or rubric scorers.

### Architecture for astroguia

Instead of one monolithic astrologer agent with 34 Caelus tools, split into specialized sub-agents coordinated by a supervisor:

```
Supervisor Agent
├── ChartComputer Agent   → caelus_chart_facts, caelus_natal_chart
├── TransitAgent          → caelus_transits, caelus_chart_facts (with target_date)
├── DignityAgent          → caelus_dignities
├── TimeLordAgent         → caelus_firdaria, caelus_profections
├── PatternAgent          → caelus_aspect_patterns
└── InterpreterAgent      → synthesizes all outputs into structured reading
```

```typescript
const chartComputer = new Agent({
  id: 'chart-computer',
  description: 'Computes natal chart facts including placements, aspects, and patterns. Returns structured JSON of chart_facts atoms.',
  model: 'openai/gpt-5-mini',
  tools: await caelusMcp.listTools(),
})

const transitAgent = new Agent({
  id: 'transit-agent',
  description: 'Computes current transits over a natal chart. Returns transit aspects with orbs and applying/separating phase.',
  model: 'openai/gpt-5-mini',
  tools: await caelusMcp.listTools(),
})

const dignityAgent = new Agent({
  id: 'dignity-agent',
  description: 'Computes essential dignities, triplicity rulers, terms, faces, and almutens for all 7 traditional planets.',
  model: 'openai/gpt-5-mini',
  tools: await caelusMcp.listTools(),
})

const timeLordAgent = new Agent({
  id: 'timelord-agent',
  description: 'Computes firdaria periods, annual and monthly profections.',
  model: 'openai/gpt-5-mini',
  tools: await caelusMcp.listTools(),
})

const interpreterAgent = new Agent({
  id: 'interpreter-agent',
  description: 'Synthesizes all astrological factors into an evolutionary reading. Takes chart data as input, returns a structured evolutionary astrology interpretation.',
  model: 'openai/gpt-5.5',
})

const supervisor = new Agent({
  id: 'evolutionary-astrologer',
  instructions: `You coordinate an evolutionary astrology reading.

Available agents:
- chart-computer: Computes natal chart (placements, aspects, dispositors, patterns)
- transit-agent: Computes current transits over the natal chart
- dignity-agent: Computes essential dignities and sect
- timelord-agent: Computes firdaria and profections
- interpreter-agent: Synthesizes all factors into a structured evolutionary reading

Delegation strategy:
1. First, delegate to chart-computer with the birth data
2. In parallel, delegate to transit-agent, dignity-agent, and timelord-agent
3. Once all data is gathered, delegate to interpreter-agent with ALL results
4. Return the structured reading from interpreter-agent

Always include: Pluto interpretation, Nodal axis, Saturn lesson, tense aspects,
water houses (4/8/12), firdaria, profections, transits over key points, dignities,
lunar phase, and a final synthesis.`,

  model: 'openai/gpt-5.5',
  agents: {
    chartComputer,
    transitAgent,
    dignityAgent,
    timeLordAgent,
    interpreterAgent,
  },
  memory: new Memory({
    storage: new LibSQLStore({ id: 'astroguia-storage', url: 'file:./mastra.db' }),
  }),
})
```

### Delegation hooks — quality control

```typescript
const stream = await supervisor.stream(
  'Cast chart for 1990-06-10 at 27.95,-82.46 and generate an evolutionary reading',
  {
    maxSteps: 15,
    delegation: {
      onDelegationStart: async (context) => {
        // Ensure chart-computer always runs first
        if (context.primitiveId === 'interpreter-agent' && context.iteration < 4) {
          return {
            proceed: false,
            rejectionReason: 'Gather all chart data before interpreting.',
          }
        }
        return { proceed: true }
      },
      onDelegationComplete: async (context) => {
        // Validate chart-computer returned data
        if (context.primitiveId === 'chart-computer' && !context.result) {
          return {
            feedback: 'Chart computer returned no data. Retry with the exact birth parameters.',
          }
        }
      },
    },
  }
)
```

### Task completion scoring — rubric for evolutionary readings

Ensure the reading covers all 10 evolutionary factors before finishing:

```typescript
import { createRubricScorer } from '@mastra/evals/scorers/prebuilt'

const rubricScorer = createRubricScorer({
  model: 'openai/gpt-5-mini',
  criteria: [
    { description: 'Reading includes Pluto sign, house, and evolutionary intent' },
    { description: 'Reading covers the North Node sign, house, and purpose statement' },
    { description: 'Reading covers the South Node sign, house, and comfort zone patterns' },
    { description: 'Reading covers Saturn sign, house, and karmic lesson' },
    { description: 'Reading analyzes tense aspects (squares, oppositions, T-squares, yods)' },
    { description: 'Reading analyzes houses 4, 8, and 12 and their rulers' },
    { description: 'Reading covers current firdaria period and profection lord' },
    { description: 'Reading covers current transits over key natal points' },
    { description: 'Reading covers essential dignities and planetary strength' },
    { description: 'Reading covers natal lunar phase and its evolutionary implication' },
    { description: 'Reading includes a final synthesis tying all factors together' },
  ],
})

const stream = await supervisor.stream('Chart for 1990-06-10...', {
  maxSteps: 15,
  isTaskComplete: {
    scorers: [rubricScorer],
    strategy: 'all',  // ALL criteria must pass
  },
})
```

### Memory isolation in supervisor

Sub-agents get full context but only their delegation prompt + response is saved to their memory. Each delegation uses a unique thread ID. Resource IDs are deterministic: `{parentResourceId}-{agentName}`. This means `chart-computer` remembers facts across delegations for the same user.

```typescript
// chart-computer's resourceId = "user-123-chart-computer"
// interpreter-agent's resourceId = "user-123-interpreter-agent"
// They share parent resource ("user-123") but have isolated memory

// Default isolation — no sharing
await supervisor.stream('Reading for user-123', {
  memory: { resource: 'user-123', thread: 'reading-1' },
})
```

### Background tasks for long-running computations

Some Caelus computations (like `electional_search`) can be long-running. Run sub-agents as background tasks:

```typescript
const supervisor = new Agent({
  id: 'evolutionary-astrologer',
  agents: { chartComputer, transitAgent, /* ... */ },
  backgroundTasks: {
    tools: {
      chartComputer: { enabled: true, timeoutMs: 300_000 },
      transitAgent: { enabled: true, timeoutMs: 120_000 },
    },
  },
})

// Use streamUntilIdle to wait for background sub-agents
const stream = await supervisor.streamUntilIdle('Chart for 1990-06-10...', {
  memory: { thread: 't1', resource: 'u1' },
})
```

### Cancellation

```typescript
const controller = new AbortController()
const stream = await supervisor.stream('Reading...', {
  abortSignal: controller.signal,
})
// Cancel all in-flight sub-agents
controller.abort()
```

---

## 4. Agent Approval — Human Review of Readings

### Gap

Existing research only mentions MCP-level `requireToolApproval`. The agent-level approval system is far richer.

### Two mechanisms

| Mechanism | When it pauses | Use case |
|---|---|---|
| `requireApproval: true` on tool | Before `execute()` runs | Always gate a tool (e.g., "send reading to client") |
| `suspend()` inside tool `execute()` | Mid-execution | Tool discovers it needs input (e.g., missing birth time) |
| `requireToolApproval: true/fn` on stream/generate | Before any tool call | Per-request gating |

### Tool-level approval for astroguia

```typescript
const sendReadingTool = createTool({
  id: 'send-reading',
  description: 'Sends the final evolutionary reading to the client via email',
  inputSchema: z.object({ email: z.string(), reading: z.string() }),
  outputSchema: z.object({ sent: z.boolean() }),
  requireApproval: true,  // Always requires astrologer approval
  execute: async ({ email, reading }) => {
    await emailService.send(email, 'Your Evolutionary Reading', reading)
    return { sent: true }
  },
})
```

### Runtime suspension for missing data

```typescript
const natalChartTool = createTool({
  id: 'compute-natal',
  description: 'Computes a natal chart',
  inputSchema: z.object({
    date: z.string(),
    lat: z.number(),
    lon: z.number(),
    birthTime: z.string().optional(),
  }),
  outputSchema: z.object({ chart: z.any() }),
  suspendSchema: z.object({
    message: z.string(),
    missingField: z.string(),
  }),
  resumeSchema: z.object({
    birthTime: z.string(),
  }),
  execute: async (input, context) => {
    if (!input.birthTime && !context?.agent?.resumeData?.birthTime) {
      return context?.agent?.suspend({
        message: 'Birth time is required for accurate house cusps. Please provide the birth time (HH:MM).',
        missingField: 'birthTime',
      })
    }
    const birthTime = context?.agent?.resumeData?.birthTime ?? input.birthTime
    return { chart: await computeChart(input.date, input.lat, input.lon, birthTime) }
  },
})
```

### Automatic resumption in conversation

```typescript
const agent = new Agent({
  id: 'astrologer',
  tools: { natalChartTool },
  memory: new Memory(),
  defaultOptions: {
    autoResumeSuspendedTools: true,  // User's next message auto-resumes
  },
})

// User: "Cast my natal chart for June 10 1990"
// Agent: "I need your birth time. What time were you born?"
// User: "3:30 PM"
// Agent automatically extracts { birthTime: "15:30" } and resumes the tool
```

### Recovering suspended runs after server restart

```typescript
// In the request handler after a restart
const { runs } = await agent.listSuspendedRuns({
  threadId: 'thread-123',
  resourceId: 'user-456',
})

const run = runs[0]
const toolCall = run?.toolCalls[0]

if (toolCall?.requiresApproval) {
  stream = await agent.approveToolCall({ runId: run.runId })
} else {
  stream = await agent.resumeStream({ birthTime: '15:30' }, { runId: run.runId })
}
```

---

## 5. Processors & Guardrails — Quality and Safety

### Gap

Zero coverage in existing research. This is the entire quality/safety pipeline.

### Key processors for astroguia

| Processor | Type | Use in astroguia |
|---|---|---|
| `TokenLimiter` | Input | Prevent context overflow with 34 Caelus tools |
| `ToolSearchProcessor` | Input | Dynamic tool discovery for large Caelus tool set |
| `ToolCallFilter` | Input | Remove verbose tool results from LLM context, keeping only `toModelOutput` |
| `ModerationProcessor` | Both | Block harmful content in chart interpretations |
| `PIIDetector` | Input | Redact PII from birth data before it reaches the LLM |
| `CostGuardProcessor` | Input | Enforce budget per reading |
| `ResponseCache` | Input | Cache identical chart computations |
| `UnicodeNormalizer` | Input | Normalize birth date/time formats |

### Configuration

```typescript
import { Agent } from '@mastra/core/agent'
import {
  TokenLimiter,
  ToolSearchProcessor,
  ToolCallFilter,
  ModerationProcessor,
  PIIDetector,
  CostGuardProcessor,
  ResponseCache,
  UnicodeNormalizer,
} from '@mastra/core/processors'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

export const astrologerAgent = new Agent({
  id: 'astrologer',
  name: 'Astrologer',
  instructions: 'You are an evolutionary astrologer...',
  model: 'openai/gpt-5.5',
  tools: await caelusMcp.listTools(),
  memory: new Memory({
    storage: new LibSQLStore({ id: 'astroguia-mem', url: 'file:./mastra.db' }),
  }),

  inputProcessors: [
    new UnicodeNormalizer({ stripControlChars: true, collapseWhitespace: true }),
    new PIIDetector({
      model: 'openai/gpt-5-nano',
      strategy: 'redact',
      detectionTypes: ['email', 'phone'],
    }),
    new TokenLimiter(127000),
    new ToolCallFilter({ preserveModelOutput: true }),  // Keep compact tool outputs
    new CostGuardProcessor({ maxCost: 2.0, scope: 'thread', window: '24h' }),
  ],

  outputProcessors: [
    new ModerationProcessor({
      model: 'openai/gpt-5-nano',
      strategy: 'block',
      categories: ['hate', 'harassment', 'violence', 'self-harm'],
    }),
  ],
})
```

### ToolSearchProcessor — solving the 34-tool problem

The existing research identifies 34 Caelus tools as a problem. `ToolSearchProcessor` is the solution:

```typescript
inputProcessors: [
  new ToolSearchProcessor({
    // Agent gets search_tools and load_tool meta-tools instead of all 34
    // It searches by keyword and loads only what it needs
  }),
]
```

### Response caching — avoid recomputing the same chart

```typescript
import { ResponseCache } from '@mastra/core/processors'
import { InMemoryServerCache } from '@mastra/core/cache'

// Dev
const cache = new InMemoryServerCache()

// Prod
// import { RedisCache } from '@mastra/redis'
// const cache = new RedisCache({ url: process.env.REDIS_URL })

export const astrologerAgent = new Agent({
  inputProcessors: [
    new ResponseCache({ cache, ttl: 3600 }), // Cache chart data for 1 hour
  ],
})
```

### Processor workflow — parallel guardrails

Run PII detection, moderation, and cost guard in parallel to reduce latency:

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows'

const inputGuardrails = createWorkflow({
  id: 'input-guardrails',
  inputSchema: ProcessorStepSchema,
  outputSchema: ProcessorStepSchema,
})
  .parallel([
    createStep(new PIIDetector({ strategy: 'redact' })),
    createStep(new ModerationProcessor({ strategy: 'block' })),
    createStep(new CostGuardProcessor({ maxCost: 2.0 })),
  ])
  .map(async ({ inputData }) => inputData['processor:pii-detector']) // Keep redacted messages
  .commit()

const agent = new Agent({
  inputProcessors: [inputGuardrails],
})
```

---

## 6. Memory — Context Across Sessions

### Gap

Existing research mentions memory generically (3 types). New discoveries:

### Observational Memory (replaces raw message history)

For long conversations (e.g., iterative chart refinement), raw messages overflow context. Observational Memory compresses old messages into dense observations:

```typescript
const memory = new Memory({
  options: {
    observationalMemory: true,  // Auto-compresses old messages
    lastMessages: 20,           // Keep last 20 messages raw
  },
})
```

### Memory sharing between agents

```typescript
// chart-computer and interpreter share the same resource → shared observations + working memory
await chartComputer.generate('Cast natal chart for...', {
  memory: { resource: 'user-123', thread: 'computation-1' },
})

await interpreterAgent.generate('Interpret the chart data', {
  memory: { resource: 'user-123', thread: 'interpretation-1' },
})
```

### Per-request memory switching

```typescript
const premiumMemory = new Memory({ options: { observationalMemory: true } })
const standardMemory = new Memory({ options: { lastMessages: 10 } })

export const astrologerAgent = new Agent({
  memory: ({ requestContext }) => {
    const tier = requestContext.get('user-tier')
    return tier === 'premium' ? premiumMemory : standardMemory
  },
})
```

---

## 7. Tool Lifecycle Hooks — Audit and Control

### Gap

Existing research doesn't cover `hooks`, `toModelOutput`, `transform`, or streaming lifecycle hooks.

### Auditing tool calls

```typescript
export const astrologerAgent = new Agent({
  hooks: {
    beforeToolCall: ({ toolName, input }) => {
      console.log(`[AUDIT] Calling ${toolName}`, input)
      // Block dangerous tool calls
      if (toolName === 'caelus_delete_chart' || toolName === 'caelus_realize') {
        return { proceed: false, output: 'Tool blocked by policy.' }
      }
    },
    afterToolCall: ({ toolName, output, error }) => {
      if (error) {
        console.error(`[ERROR] ${toolName} failed:`, error)
      }
    },
  },
})
```

### Shaping tool output for the model

Caelus `chart_facts` returns very rich data. Use `toModelOutput` to send the model only what it needs while keeping the full result in the app:

```typescript
const chartFactsTool = createTool({
  id: 'chart-facts-wrapper',
  execute: async ({ date, lat, lon }) => {
    const fullResult = await caelusMcp.callTool('caelus_chart_facts', { date, lat, lon })
    return fullResult  // Full result for app
  },
  toModelOutput: (output) => ({
    type: 'content',
    value: [{
      type: 'text',
      text: output.atoms
        .filter(a => a.salience >= 3)  // Only high-salience facts
        .map(a => `[${a.id}] ${a.text}`)
        .join('\n'),
    }],
  }),
})
```

---

## 8. Model Selection and Dynamic Configuration

### Gap

Existing research uses `openai/gpt-5.5` for everything. New capabilities allow model selection per task.

### Recommended model tiering for astroguia

| Task | Model | Rationale |
|---|---|---|
| Chart computation (agent routing Caelus tools) | `openai/gpt-5-mini` | Simple tool routing, no interpretation |
| Evolutionary interpretation | `openai/gpt-5.5` or `anthropic/claude-opus-4-7` | Complex synthesis, needs nuance |
| Guardrails (moderation, PII) | `openai/gpt-5-nano` | Classification only, minimal cost |
| Structured output extraction | `openai/gpt-5-mini` | Separate model for structuring |

### Per-step dynamic model switching

```typescript
const stream = await agent.stream('Chart for 1990-06-10...', {
  prepareStep: async ({ stepNumber }) => {
    if (stepNumber === 0) {
      return { model: 'openai/gpt-5-mini', toolChoice: 'required' }
    }
    return { model: 'openai/gpt-5.5', toolChoice: 'none' }
  },
})
```

---

## 9. Custom Processors for astroguia

### Birth data validation processor

```typescript
import type { Processor, ProcessInputArgs } from '@mastra/core/processors'

export class BirthDataValidator implements Processor {
  id = 'birth-data-validator'

  async processInput({ messages, abort }: ProcessInputArgs) {
    const lastMessage = messages[messages.length - 1]
    const text = lastMessage?.content?.parts
      ?.filter(p => p.type === 'text')
      .map(p => p.text)
      .join(' ') ?? ''

    const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/)
    const latMatch = text.match(/lat[=:\s]*([-\d.]+)/i)
    const lonMatch = text.match(/lon[=:\s]*([-\d.]+)/i)

    if (!dateMatch || !latMatch || !lonMatch) {
      abort('Missing required birth data. Please provide date (YYYY-MM-DD), latitude, and longitude.', {
        retry: true,
        metadata: { missingFields: ['date', 'lat', 'lon'].filter((_, i) => ![dateMatch, latMatch, lonMatch][i]) },
      })
    }
    return messages
  }
}
```

### Reading completeness validator

```typescript
export class ReadingValidator implements Processor {
  id = 'reading-validator'

  async processOutputStep({ text, abort, retryCount }) {
    const requiredSections = [
      'Pluto', 'North Node', 'South Node', 'Saturn',
      'Tense Aspects', 'Houses 4/8/12', 'Firdaria',
      'Profection', 'Transits', 'Dignities', 'Lunar Phase',
    ]
    const missing = requiredSections.filter(s => !text.includes(s))

    if (missing.length > 3 && retryCount < 2) {
      abort(`Missing these sections: ${missing.join(', ')}. Include them in the reading.`, {
        retry: true,
        metadata: { missingSections: missing },
      })
    }
    return []
  }
}
```

---

## 10. Summary of Enrichment Impact

| Capability | Priority | Existing Research Coverage | What Changes for astroguia |
|---|---|---|---|
| Structured output | **Critical** | None | Typed reading sections, UI rendering, completeness validation |
| Supervisor delegation | **Critical** | Mentioned only | Split into 5 specialized agents, rubric-scored completeness |
| Rubric scorer | **High** | None | Auto-validate all 10 evolutionary factors are covered |
| Agent-level approval | **High** | MCP-level only | Human review before sending, missing data suspension |
| Processors pipeline | **High** | None | PII redaction, moderation, cost guard, token limiting |
| ToolSearchProcessor | **High** | Identified as problem | Solution to the 34-tool context problem |
| Observational memory | **Medium** | Not covered | Long conversation support for iterative readings |
| Tool hooks | **Medium** | None | Audit logging, tool blocking, shaped model output |
| Response caching | **Medium** | None | Cache identical chart computations |
| Dynamic model switching | **Medium** | None | Use cheap models for tool routing, expensive for interpretation |
| Tool lifecycle hooks | **Low** | None | Streaming tool input for UI feedback |
| Background tasks | **Low** | None | Long-running Caelus computations |

---

## 11. Recommended Agent Architecture (Revised)

Given all new capabilities, the recommended astroguia architecture is:

```
┌──────────────────────────────────────────────────────────┐
│                 Supervisor Agent                          │
│  model: gpt-5.5 | memory: Observational                  │
│  inputProcessors: [PII, TokenLimiter, ToolCallFilter]    │
│  outputProcessors: [Moderation, ReadingValidator]        │
│  isTaskComplete: rubricScorer (11 criteria)              │
├──────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────┐  ┌───────────┐           │
│  │ChartComputer│  │TransitAg │  │DignityAg  │  ...      │
│  │ gpt-5-mini  │  │gpt-5-mini│  │gpt-5-mini │           │
│  │ Caelus MCP  │  │Caelus MCP│  │Caelus MCP │           │
│  └─────────────┘  └──────────┘  └───────────┘           │
│                                                          │
│  ┌──────────────────────────────────────┐                │
│  │         InterpreterAgent             │                │
│  │  gpt-5.5 | structuredOutput         │                │
│  │  schema: EvolutionaryReadingSchema   │                │
│  └──────────────────────────────────────┘                │
│                                                          │
│  ┌──────────────────────────────────────┐                │
│  │  sendReadingTool (requireApproval)    │                │
│  │  → human reviews before sending      │                │
│  └──────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────┘
```

---

## 12. Sources Consulted

- [Mastra Agents Overview](https://mastra.ai/docs/agents/overview)
- [Mastra Supervisor Agents](https://mastra.ai/docs/agents/supervisor-agents)
- [Mastra Structured Output](https://mastra.ai/docs/agents/structured-output)
- [Mastra Processors](https://mastra.ai/docs/agents/processors)
- [Mastra Guardrails](https://mastra.ai/docs/agents/guardrails)
- [Mastra Agent Approval](https://mastra.ai/docs/agents/agent-approval)
- [Mastra Memory Overview](https://mastra.ai/docs/memory/overview)
- [Mastra Tools](https://mastra.ai/docs/agents/using-tools)
- Existing astroguia research: `mastra-project-structure.md`, `mastra-caelus-integration.md`, `mastra-workflow-patterns.md`
