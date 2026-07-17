# Mastra Workflow Patterns for Evolutionary Astrology

Research for GitHub issue #4 complement: workflow orchestration patterns applicable to astroguia's multi-factor chart reading pipeline.

**Date**: 2026-07-17
**Sources**: Mastra docs at mastra.ai — Workflows overview, Control flow, Workflow state, Suspend & Resume, Error handling, Human-in-the-loop, Snapshots, Time travel, Step class, Workflow class, Tools, Agents

---

## 1. Summary

The existing research (`mastra-project-structure.md`, `mastra-caelus-integration.md`) focused on agent definition and MCP tool wiring but did not cover Mastra's **workflow orchestration layer**. Workflows are the natural fit for astroguia's evolutionary reading pipeline: a deterministic multi-step process that gathers 10+ astrological factors, passes them through an LLM agent for interpretation, and produces a structured report.

This doc maps every workflow capability to concrete astroguia use cases and proposes a recommended architecture.

---

## 2. Control Flow Patterns

Mastra workflows support six control flow primitives beyond basic `.then()` chaining. Each maps to a specific astroguia need.

### 2a. `.parallel()` — Simultaneous chart computation

An evolutionary reading requires multiple independent astrological computations. `.parallel()` runs them concurrently and passes all results as a keyed object to the next step.

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'

// Each step calls the astrologer agent with a specific tool instruction
const natalStep = createStep({
  id: 'natal',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ natalAtoms: z.array(z.any()) }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `Cast natal chart for ${inputData.date} at ${inputData.lat},${inputData.lon}. Return chart_facts atoms.`,
      { activeTools: ['caelus_chart_facts'] }
    )
    return { natalAtoms: JSON.parse(result.text) }
  },
})

const transitStep = createStep({
  id: 'transits',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ transitAtoms: z.array(z.any()) }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `Get current transits for natal chart ${inputData.date} at ${inputData.lat},${inputData.lon}. Return transit atoms.`,
      { activeTools: ['caelus_chart_facts'] }
    )
    return { transitAtoms: JSON.parse(result.text) }
  },
})

const firdariaStep = createStep({
  id: 'firdaria',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ firdariaPeriod: z.any() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `Get firdaria for ${inputData.date} at ${inputData.lat},${inputData.lon} with current target_date.`,
      { activeTools: ['caelus_firdaria'] }
    )
    return { firdariaPeriod: JSON.parse(result.text) }
  },
})

const profectionStep = createStep({
  id: 'profection',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ profectionData: z.any() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `Get profections for ${inputData.date} at ${inputData.lat},${inputData.lon} with current target_date.`,
      { activeTools: ['caelus_profections'] }
    )
    return { profectionData: JSON.parse(result.text) }
  },
})

const synthesizeStep = createStep({
  id: 'synthesize',
  inputSchema: z.object({
    'natal': z.object({ natalAtoms: z.array(z.any()) }),
    'transits': z.object({ transitAtoms: z.array(z.any()) }),
    'firdaria': z.object({ firdariaPeriod: z.any() }),
    'profection': z.object({ profectionData: z.any() }),
  }),
  outputSchema: z.object({ interpretation: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `Synthesize an evolutionary astrology reading from these factors:
       Natal: ${JSON.stringify(inputData.natal.natalAtoms)}
       Transits: ${JSON.stringify(inputData.transits.transitAtoms)}
       Firdaria: ${JSON.stringify(inputData.firdaria.firdariaPeriod)}
       Profection: ${JSON.stringify(inputData.profection.profectionData)}`
    )
    return { interpretation: result.text }
  },
})

export const evolutionaryReading = createWorkflow({
  id: 'evolutionary-reading',
  inputSchema: z.object({
    date: z.string(),
    lat: z.number(),
    lon: z.number(),
    houseSystem: z.string().optional(),
  }),
  outputSchema: z.object({ interpretation: z.string() }),
})
  .parallel([natalStep, transitStep, firdariaStep, profectionStep])
  .then(synthesizeStep)
  .commit()
```

**Key point**: Each parallel step's output is keyed by its `id`. The synthesize step receives `{ natal: {...}, transits: {...}, firdaria: {...}, profection: {...} }`.

**Concurrency note**: `.parallel()` runs all branches simultaneously with no concurrency limit option. All must complete before the next step runs.

### 2b. `.branch()` — Conditional chart type routing

Not all readings are natal charts. `.branch()` lets the workflow choose different computation paths based on the requested chart type.

```typescript
const natalPipeline = createWorkflow({
  id: 'natal-pipeline',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ interpretation: z.string() }),
})
  .parallel([natalStep, transitStep, firdariaStep, profectionStep])
  .then(synthesizeStep)
  .commit()

const synastryPipeline = createWorkflow({
  id: 'synastry-pipeline',
  inputSchema: z.object({
    person1: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
    person2: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  }),
  outputSchema: z.object({ interpretation: z.string() }),
})
  .then(computeSynastryStep)
  .then(synthesizeSynastryStep)
  .commit()

const classifyStep = createStep({
  id: 'classify',
  inputSchema: z.object({ chartType: z.enum(['natal', 'synastry', 'solar_return']) }),
  outputSchema: z.object({ chartType: z.enum(['natal', 'synastry', 'solar_return']) }),
  execute: async ({ inputData }) => inputData,
})

export const readingRouter = createWorkflow({
  id: 'reading-router',
  inputSchema: z.object({
    chartType: z.enum(['natal', 'synastry', 'solar_return']),
    date: z.string(),
    lat: z.number(),
    lon: z.number(),
  }),
  outputSchema: z.object({ interpretation: z.string() }),
})
  .then(classifyStep)
  .branch([
    [async ({ inputData }) => inputData.chartType === 'natal', natalPipeline],
    [async ({ inputData }) => inputData.chartType === 'synastry', synastryPipeline],
    [async ({ inputData }) => inputData.chartType === 'solar_return', solarReturnPipeline],
  ])
  .commit()
```

**Branch output pattern**: Only one branch executes. The output is keyed by the executed workflow/step's `id`. Subsequent steps must handle all possible branch outputs with optional fields.

### 2c. `.foreach()` — Multi-aspect or multi-chart processing

When processing multiple aspects of a chart, or multiple charts in batch, `.foreach()` applies the same step to each array item with controllable concurrency.

```typescript
const analyzeAspectStep = createStep({
  id: 'analyze-aspect',
  inputSchema: z.object({ aspect: z.string(), orb: z.number(), bodies: z.array(z.string()) }),
  outputSchema: z.object({ interpretation: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `Interpret the evolutionary meaning of ${inputData.aspect} between ${inputData.bodies.join(' and ')} (orb ${inputData.orb}°).`
    )
    return { interpretation: result.text }
  },
})

const aggregateAspectsStep = createStep({
  id: 'aggregate-aspects',
  inputSchema: z.array(z.object({ interpretation: z.string() })),
  outputSchema: z.object({ combined: z.string() }),
  execute: async ({ inputData }) => ({
    combined: inputData.map(a => a.interpretation).join('\n\n'),
  }),
})

// Usage: after extracting aspects from chart_facts atoms
export const multiAspectWorkflow = createWorkflow({
  id: 'multi-aspect',
  inputSchema: z.array(z.object({
    aspect: z.string(),
    orb: z.number(),
    bodies: z.array(z.string()),
  })),
  outputSchema: z.object({ combined: z.string() }),
})
  .foreach(analyzeAspectStep, { concurrency: 4 })
  .then(aggregateAspectsStep)
  .commit()
```

**Concurrency**: Default is 1 (sequential). Use `{ concurrency: N }` to process up to N items in parallel — relevant for I/O-bound LLM calls.

### 2d. `.map()` — Transform data between steps

When step outputs don't match the next step's input schema, `.map()` transforms them without creating an intermediate step.

```typescript
const extractEvoFactors = createStep({
  id: 'extract-factors',
  inputSchema: z.object({ atoms: z.array(z.any()) }),
  outputSchema: z.object({
    pluto: z.any(),
    nodes: z.any(),
    saturn: z.any(),
    waterHouses: z.array(z.any()),
    tenseAspects: z.array(z.any()),
  }),
  execute: async ({ inputData }) => {
    const atoms = inputData.atoms
    return {
      pluto: atoms.filter(a => a.kind === 'placement' && a.bodies?.includes('pluto')),
      nodes: atoms.filter(a => a.kind === 'placement' && (a.bodies?.includes('mean_node') || a.bodies?.includes('true_node'))),
      saturn: atoms.filter(a => a.kind === 'placement' && a.bodies?.includes('saturn')),
      waterHouses: atoms.filter(a => a.kind === 'placement' && [4, 8, 12].includes(a.house)),
      tenseAspects: atoms.filter(a => a.kind === 'aspect' && ['square', 'opposition'].includes(a.aspect)),
    }
  },
})

// Map the extract output to the format the synthesis agent expects
export const readingWorkflow = createWorkflow({...})
  .then(fetchChartAtomsStep)
  .then(extractEvoFactors)
  .map(async ({ inputData }) => ({
    prompt: `Evolutionary reading with:
      Pluto: ${JSON.stringify(inputData.pluto)}
      Nodes: ${JSON.stringify(inputData.nodes)}
      Saturn: ${JSON.stringify(inputData.saturn)}
      Water houses: ${JSON.stringify(inputData.waterHouses)}
      Tense aspects: ${JSON.stringify(inputData.tenseAspects)}`,
  }))
  .then(synthesizeStep)
  .commit()
```

### 2e. `.dountil()` / `.dowhile()` — Iterative refinement

For cases where the interpretation needs iterative refinement (e.g., checking that all 10 evolutionary factors are addressed).

```typescript
const checkCoverageStep = createStep({
  id: 'check-coverage',
  inputSchema: z.object({ interpretation: z.string(), missingFactors: z.array(z.string()) }),
  outputSchema: z.object({ interpretation: z.string(), missingFactors: z.array(z.string()) }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `This interpretation: "${inputData.interpretation}" is missing these factors: ${inputData.missingFactors.join(', ')}. Add them.`
    )
    return { interpretation: result.text, missingFactors: [] }
  },
})

// Refine until no missing factors remain
export const refinementWorkflow = createWorkflow({...})
  .then(initialSynthesis)
  .dountil(checkCoverageStep, async ({ inputData }) =>
    inputData.missingFactors.length === 0
  )
  .commit()
```

---

## 3. Workflow State — Shared Data Without Schema Threading

State (`stateSchema`, `state`, `setState`) lets steps accumulate data without threading everything through `inputSchema`/`outputSchema`. Critical for astroguia where 10+ factors are gathered and only the synthesis step needs all of them.

```typescript
const gatherPluto = createStep({
  id: 'gather-pluto',
  inputSchema: z.object({}),
  outputSchema: z.object({ done: z.boolean() }),
  stateSchema: z.object({
    plutoData: z.any().optional(),
    nodesData: z.any().optional(),
    saturnData: z.any().optional(),
    tenseAspects: z.any().optional(),
    waterHouses: z.any().optional(),
    firdariaData: z.any().optional(),
    profectionData: z.any().optional(),
    transitData: z.any().optional(),
    dignities: z.any().optional(),
    lunarPhase: z.any().optional(),
  }),
  execute: async ({ state, setState, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate('Get Pluto placement and aspects from chart_facts.')
    await setState({ ...state, plutoData: JSON.parse(result.text) })
    return { done: true }
  },
})

// Similar steps for nodes, saturn, waterHouses, tenseAspects, firdaria, profection, transits, dignities, lunarPhase...

const synthesizeFromState = createStep({
  id: 'synthesize',
  inputSchema: z.object({}),
  outputSchema: z.object({ interpretation: z.string() }),
  stateSchema: z.object({
    plutoData: z.any(),
    nodesData: z.any(),
    saturnData: z.any(),
    tenseAspects: z.any(),
    waterHouses: z.any(),
    firdariaData: z.any(),
    profectionData: z.any(),
    transitData: z.any(),
    dignities: z.any(),
    lunarPhase: z.any(),
  }),
  execute: async ({ state, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `Synthesize an evolutionary reading from:
       Pluto: ${JSON.stringify(state.plutoData)}
       Nodes: ${JSON.stringify(state.nodesData)}
       Saturn: ${JSON.stringify(state.saturnData)}
       Tense aspects: ${JSON.stringify(state.tenseAspects)}
       Water houses: ${JSON.stringify(state.waterHouses)}
       Firdaria: ${JSON.stringify(state.firdariaData)}
       Profection: ${JSON.stringify(state.profectionData)}
       Transits: ${JSON.stringify(state.transitData)}
       Dignities: ${JSON.stringify(state.dignities)}
       Lunar phase: ${JSON.stringify(state.lunarPhase)}`
    )
    return { interpretation: result.text }
  },
})

export const statefulReading = createWorkflow({
  id: 'stateful-evolutionary-reading',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ interpretation: z.string() }),
  stateSchema: z.object({
    plutoData: z.any().optional(),
    nodesData: z.any().optional(),
    saturnData: z.any().optional(),
    tenseAspects: z.any().optional(),
    waterHouses: z.any().optional(),
    firdariaData: z.any().optional(),
    profectionData: z.any().optional(),
    transitData: z.any().optional(),
    dignities: z.any().optional(),
    lunarPhase: z.any().optional(),
  }),
})
  .parallel([
    gatherPluto, gatherNodes, gatherSaturn,
    gatherTenseAspects, gatherWaterHouses,
    gatherFirdaria, gatherProfection,
    gatherTransits, gatherDignities, gatherLunarPhase,
  ])
  .then(synthesizeFromState)
  .commit()
```

**State vs input/output tradeoff**:

| Approach | Pros | Cons |
|---|---|---|
| Step input/output threading | Type-safe, explicit data flow | Verbose schemas, coupling between steps |
| Workflow state | Loose coupling, accumulate freely | Less explicit data flow, runtime type checking |

**State persistence**: State survives `suspend()`/`resume()` cycles automatically. State also propagates from parent to child in nested workflows.

### Initial state

Set `initialState` when starting a run:

```typescript
const run = await workflow.createRun()
const result = await run.start({
  inputData: { date: '1990-06-10', lat: 27.95, lon: -82.46 },
  initialState: {
    plutoData: undefined,
    nodesData: undefined,
    // ... all fields initialized
  },
})
```

---

## 4. Agent-Step Integration — Streaming Interpretations

Mastra supports two patterns for using agents within workflow steps.

### 4a. Agent as step (via `createStep(agent)`)

The simplest pattern: wrap an agent directly as a step. The step's `id` is the agent's name; `inputSchema` becomes `{ prompt: string }`; `outputSchema` becomes `{ text: string }`.

```typescript
import { astrologerAgent } from '../agents/astrologer'

const astrologerStep = createStep(astrologerAgent)

export const simpleReading = createWorkflow({
  id: 'simple-reading',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ text: z.string() }),
})
  .then(fetchChartDataStep)
  .then(astrologerStep)
  .commit()
```

### 4b. Agent with structured output

```typescript
const readingSchema = z.object({
  plutoInterpretation: z.string(),
  nodalAxis: z.string(),
  saturnLesson: z.string(),
  currentTransits: z.string(),
  timeLordContext: z.string(),
  synthesis: z.string(),
})

const structuredAstrologer = createStep(astrologerAgent, {
  structuredOutput: { schema: readingSchema },
})
```

### 4c. Streaming agent output through a step's writer

For real-time streaming of the LLM's interpretation to the user:

```typescript
const streamInterpretation = createStep({
  id: 'stream-interpretation',
  inputSchema: z.object({ chartData: z.any() }),
  outputSchema: z.object({ value: z.string() }),
  execute: async ({ inputData, mastra, writer }) => {
    const agent = mastra!.getAgent('astrologer')
    const stream = await agent!.stream(
      `Interpret this chart data: ${JSON.stringify(inputData.chartData)}`
    )
    // Pipe agent's text output to workflow writer for real-time streaming
    await stream!.textStream.pipeTo(writer!)
    return { value: await stream!.text }
  },
})
```

### 4d. MCP tools in workflows — the indirect path

MCP tools (like Caelus's 34 tools) are **Agent-only** — they cannot be used directly in workflow step `execute()` functions. The workaround is:

```
Workflow Step → Mastra Agent (via mastra.getAgent()) → MCP Tools
```

The step calls the agent, and the agent has access to Caelus MCP tools. This is the pattern used in all examples above.

For programmatic (non-LLM) access to Caelus computations in workflow steps, use `caelus` npm package directly — installed separately from MCP.

---

## 5. Suspend/Resume — Human Review of Readings

For production use where an astrologer reviews the AI-generated interpretation before delivering it to the client:

```typescript
const generateDraft = createStep({
  id: 'generate-draft',
  inputSchema: z.object({ chartData: z.any() }),
  outputSchema: z.object({ draft: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `Generate an evolutionary astrology reading: ${JSON.stringify(inputData.chartData)}`
    )
    return { draft: result.text }
  },
})

const humanReviewStep = createStep({
  id: 'human-review',
  inputSchema: z.object({ draft: z.string() }),
  outputSchema: z.object({ finalInterpretation: z.string() }),
  resumeSchema: z.object({
    approved: z.boolean(),
    edits: z.string().optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    draftPreview: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    const { draft } = inputData
    const { approved, edits } = resumeData ?? {}

    if (approved === false) {
      return bail({ finalInterpretation: 'Reading cancelled by reviewer.' })
    }

    if (!approved) {
      return await suspend({
        reason: 'Astrologer review required before delivery.',
        draftPreview: draft.slice(0, 500),
      })
    }

    return {
      finalInterpretation: edits ?? draft,
    }
  },
})

export const reviewedReading = createWorkflow({
  id: 'reviewed-evolutionary-reading',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ finalInterpretation: z.string() }),
})
  .then(fetchChartDataStep)
  .then(generateDraft)
  .then(humanReviewStep)
  .commit()

// --- Resuming from a webhook or UI ---
const workflow = mastra.getWorkflow('reviewedEvolutionaryReading')
const run = await workflow.createRun()

const result = await run.start({
  inputData: { date: '1990-06-10', lat: 27.95, lon: -82.46 },
})

if (result.status === 'suspended') {
  const suspendedStepId = result.suspended[0]
  const suspendPayload = result.steps[suspendedStepId].suspendPayload
  // Show suspendPayload.reason and suspendPayload.draftPreview to the astrologer
  // ... astrologer reviews and approves/edits ...

  const resumedResult = await run.resume({
    step: suspendedStepId,
    resumeData: { approved: true, edits: 'Corrected interpretation...' },
  })
}
```

**`bail()` vs `suspend()`**: `bail()` ends the workflow with success (for explicit rejection). `suspend()` pauses for later resumption. Both are relevant for human-in-the-loop.

**Identifying suspended runs**: `result.status === 'suspended'` and `result.suspended` contains the path array of suspended steps.

---

## 6. Error Handling

### 6a. Result status discriminated union

```typescript
const result = await run.start({ inputData: { ... } })

switch (result.status) {
  case 'success':
    return result.result // the workflow output
  case 'failed':
    console.error(result.error.message)
    // Inspect which step failed:
    for (const [stepId, stepResult] of Object.entries(result.steps)) {
      if (stepResult.status === 'failed') {
        console.error(`Step ${stepId} failed:`, stepResult.error)
      }
    }
    break
  case 'suspended':
    // result.suspended — array of suspended step paths
    // result.suspendPayload — available per-step
    break
  case 'tripwire':
    // Guardrail/processor blocked execution
    console.log(result.tripwire?.reason)
    break
}
```

### 6b. Lifecycle callbacks

```typescript
export const resilientReading = createWorkflow({
  id: 'resilient-evolutionary-reading',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ interpretation: z.string() }),
  options: {
    onFinish: async (result) => {
      await analytics.track('reading_completed', {
        status: result.status,
        runId: result.runId,
      })
    },
    onError: async (errorInfo) => {
      await alertService.notify({
        channel: 'astroguia-errors',
        message: `Reading failed: ${errorInfo.error?.message}`,
      })
    },
  },
})
  .then(/* ... */)
  .commit()
```

Callbacks receive the full Mastra instance, logger, state, runId, and requestContext. Errors thrown inside callbacks are caught and logged but don't affect the workflow result.

### 6c. Retry configuration

```typescript
// Workflow-level: applies to all steps
export const readingWithRetries = createWorkflow({
  id: 'reading-with-retries',
  retryConfig: { attempts: 3, delay: 2000 },
})
  .then(/* ... */)
  .commit()

// Step-level: overrides workflow retry for specific steps
const fetchChartStep = createStep({
  id: 'fetch-chart',
  execute: async ({ inputData }) => {
    const response = await fetch('https://www.ephemengine.com/api/mcp', { ... })
    if (!response.ok) throw new Error('Caelus unavailable')
    return { ... }
  },
  retries: 5, // Caelus might need more retries
})
```

### 6d. Resilient parallel steps

When some parallel computations may fail (e.g., Caelus timeout for a specific tool), use try/catch inside steps so the parallel block doesn't fail entirely:

```typescript
const resilientFirdaria = createStep({
  id: 'resilient-firdaria',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ data: z.any().nullable(), failed: z.boolean() }),
  execute: async ({ inputData, mastra }) => {
    try {
      const agent = mastra!.getAgent('astrologer')
      const result = await agent.generate('Get firdaria.', {
        activeTools: ['caelus_firdaria'],
      })
      return { data: JSON.parse(result.text), failed: false }
    } catch {
      return { data: null, failed: true }
    }
  },
})

// The synthesis step filters out failed computations
const resilientSynthesize = createStep({
  id: 'resilient-synthesize',
  inputSchema: z.object({
    'natal': z.object({ data: z.any().nullable(), failed: z.boolean() }),
    'transits': z.object({ data: z.any().nullable(), failed: z.boolean() }),
    'firdaria': z.object({ data: z.any().nullable(), failed: z.boolean() }),
    'profection': z.object({ data: z.any().nullable(), failed: z.boolean() }),
    'dignities': z.object({ data: z.any().nullable(), failed: z.boolean() }),
  }),
  outputSchema: z.object({ interpretation: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const availableFactors = Object.entries(inputData)
      .filter(([_, v]) => !v.failed && v.data)
      .map(([k, v]) => `${k}: ${JSON.stringify(v.data)}`)
      .join('\n')

    const agent = mastra!.getAgent('astrologer')
    const result = await agent.generate(
      `Synthesize an evolutionary reading from available factors only:\n${availableFactors}`
    )
    return { interpretation: result.text }
  },
})
```

This pattern allows the reading to proceed even if one computation (e.g., firdaria) fails — the reading just notes which factors are unavailable.

### 6e. `bail()` — Early exit with success

When the agent detects an invalid birth date or missing data, `bail()` exits gracefully:

```typescript
const validateInput = createStep({
  id: 'validate',
  inputSchema: z.object({ date: z.string(), lat: z.number(), lon: z.number() }),
  outputSchema: z.object({ valid: z.boolean() }),
  execute: async ({ inputData, bail }) => {
    const birthDate = new Date(inputData.date)
    if (isNaN(birthDate.getTime())) {
      return bail({ valid: false, reason: 'Invalid birth date' })
    }
    return { valid: true }
  },
})
```

---

## 7. Time Travel — Debugging and Recovery

Time travel re-executes a workflow from any specific step without re-running prior steps. Critical for debugging failed readings or recovering from transient errors.

```typescript
const workflow = mastra.getWorkflow('evolutionaryReading')
const run = await workflow.createRun()

// Initial run fails at the synthesis step
const result = await run.start({
  inputData: { date: '1990-06-10', lat: 27.95, lon: -82.46 },
})

if (result.status === 'failed') {
  // Find which step failed
  const failedStepId = Object.entries(result.steps)
    .find(([_, s]) => s.status === 'failed')?.[0]

  // Re-run from the failed step with corrected context
  const recoveredResult = await run.timeTravel({
    step: failedStepId!,
    inputData: { /* corrected input */ },
  })
}
```

### Streaming time travel

```typescript
const stream = run.timeTravelStream({
  step: 'synthesize',
  inputData: { /* recovered context */ },
})

for await (const event of stream.fullStream) {
  console.log(event.type, event.payload)
}

const finalResult = await stream.result
```

### Time travel for nested workflow steps

```typescript
const result = await run.timeTravel({
  step: 'natalPipeline.gatherPluto',  // dot notation
  // or: step: ['natalPipeline', 'gatherPluto'],
  inputData: { chartData: correctedNatalData },
})
```

---

## 8. Snapshots — Persistence and Recovery

Snapshots are serializable representations of workflow execution state. Automatically persisted to storage on `suspend()`. Contain step statuses, outputs, execution paths, suspend/resume payloads, and retry counts.

### Snapshot storage configuration

```typescript
// src/mastra/storage.ts
import { LibSQLStore } from '@mastra/libsql'

export const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db', // .gitignore this
})
```

### Recovering suspended runs from storage

```typescript
import { createWorkflowStateReader } from '@mastra/core/workflows'

const workflow = mastra.getWorkflow('reviewedEvolutionaryReading')
const state = await workflow.getWorkflowRunById('run-123')

if (state?.status === 'suspended') {
  const reader = createWorkflowStateReader(state)
  const suspendedStep = reader.getSuspendedStep()
  const run = await workflow.createRun({ runId: state.runId })

  await run.resume({
    step: suspendedStep?.path,
    resumeData: { approved: true },
  })
}
```

### Snapshot best practices

1. **Keep snapshots small**: Store references (IDs), not large data blobs
2. **Ensure serializability**: All data in snapshots must be JSON-serializable
3. **Monitor suspended workflows**: Long-suspended runs may need alerting
4. **Storage cleanup**: Implement TTL or pruning for completed/failed snapshots

---

## 9. Workflow Registration and Execution

### Registration

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'
import { evolutionaryReading } from './workflows/evolutionary-reading'
import { reviewedReading } from './workflows/reviewed-reading'

export const mastra = new Mastra({
  workflows: {
    evolutionaryReading,
    reviewedReading,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({ name: 'astroguia', level: 'debug' }),
})
```

### Running workflows

```typescript
// .start() — wait for completion
const workflow = mastra.getWorkflow('evolutionaryReading')
const run = await workflow.createRun()
const result = await run.start({
  inputData: { date: '1990-06-10', lat: 27.95, lon: -82.46 },
})
if (result.status === 'success') {
  console.log(result.result.interpretation)
}

// .stream() — real-time progress
const stream = run.stream({
  inputData: { date: '1990-06-10', lat: 27.95, lon: -82.46 },
})
for await (const chunk of stream.fullStream) {
  console.log(chunk)
}
const streamResult = await stream.result
```

### Scheduled workflows

Workflows can be scheduled via cron for periodic readings (e.g., daily transit reports):

```typescript
export const dailyTransitReport = createWorkflow({
  id: 'daily-transit-report',
  inputSchema: z.object({}),
  outputSchema: z.object({ report: z.string() }),
  schedule: {
    cron: '0 9 * * *',        // 9 AM daily
    timezone: 'America/New_York',
    inputData: {},             // fixed input for scheduled runs
  },
})
  .then(fetchDailyTransits)
  .then(generateReport)
  .commit()
```

---

## 10. Flow Composition Patterns Mapped to astroguia

| Mastra Control Flow | astroguia Use Case | Priority |
|---|---|---|
| `.parallel()` | Compute natal + transits + firdaria + profections + dignities simultaneously | Critical |
| `.branch()` | Route by chart type: natal vs synastry vs solar return vs composite | High |
| `.foreach()` | Process multiple transit aspects or multiple client charts in batch | High |
| `.map()` | Transform raw chart_facts atoms into structured EvoFactor groups before synthesis | Medium |
| `.dountil()` / `.dowhile()` | Iterative refinement until all 10 evolutionary factors are covered | Medium |
| Nested workflows | Encapsulate "natal chart computation" as reusable sub-workflow for different parent flows | High |
| Workflow state | Accumulate 10 factors across parallel steps without schema threading | Critical |
| Suspend/Resume | Human-in-the-loop: astrologer reviews AI draft before delivery | Medium |
| `bail()` | Early exit on invalid birth data or missing required fields | Medium |
| Time travel | Debug failed readings by re-running from the failed step | Low |
| Scheduled workflows | Daily transit reports, weekly lunar phase updates | Medium |
| Lifecycle callbacks | Logging, analytics, alerting on reading completion/failure | Medium |
| Retry config | Retry transient Caelus MCP failures | High |
| Clone workflow | Run the same reading pipeline under a different ID for A/B testing | Low |
| `createStep(agent)` | Wrap astrologer agent directly as a workflow step | Critical |
| Structured output step | Agent returns typed structured reading (pluto, nodes, saturn sections, etc.) | High |

---

## 11. Recommended Architecture for astroguia

### Tier 1: Simple single-chart reading (MVP)

```
Input → fetchChartAtoms (agent + caelus_chart_facts)
      → synthesizeInterpretation (agent)
      → Output: interpretation string
```

Uses: basic `.then()` chaining. No parallel, no state, no suspend.

### Tier 2: Full evolutionary reading (v1)

```
Input → parallel([natal, transits, firdaria, profection, dignities])  (each calls agent + Caelus tools)
      → aggregateStep (map parallel outputs to structured EvoFactors)
      → synthesizeStep (agent generates full reading from EvoFactors)
      → Output: structured reading
```

Uses: `.parallel()`, `.map()`, workflow state.

### Tier 3: Reviewed reading with human-in-the-loop (production)

```
Input → validateInput (bail on invalid)
      → parallel([...all 5 computations])
      → synthesizeDraft (agent)
      → humanReview (suspend → astrologer reviews → resume with edits)
      → formatOutput
      → Output: finalized reading
```

Adds: `bail()`, `suspend()`, `resume()`, lifecycle callbacks, retry config, snapshots.

### Tier 4: Multi-type routing + batch (platform)

```
Input → classifyType (branch)
      → natal → parallel([...])
      → synastry → parallel([person1Chart, person2Chart, synastryCompute])
      → solarReturn → parallel([natal, solarReturnCompute])
      → synthesize (depending on type)
      → Output
```

Adds: `.branch()`, nested workflows, `.foreach()` for batch.

---

## 12. Limitations and Gotchas

### General Workflow Limitations

| Limitation | Detail | Impact on astroguia |
|---|---|---|
| No streaming within parallel results | All parallel steps must complete before the next step runs — no "stream as they complete" | Can't show partial results; user waits for all 5 computations |
| `.parallel()` has no concurrency limit option | All parallel branches always run simultaneously | 10 parallel agent calls could hit rate limits; consider batching into two `.parallel()` blocks |
| Step schemas must be JSON-serializable | `inputSchema`/`outputSchema` can't contain functions or complex types | Use Zod schemas for all step boundaries |
| Snapshots must be JSON-serializable | Can't store non-serializable state | Store references/IDs, not live objects |
| `getWorkflow()` preferred over direct import | Direct import loses Mastra instance context (logger, telemetry, storage) | Always use `mastra.getWorkflow('name')` |
| `getWorkflow()` type inference | Uses registration key, not workflow `id` property | `getWorkflowById()` exists but has weaker type inference |

### MCP-Specific Limitations

| Limitation | Detail | Impact on astroguia |
|---|---|---|
| MCP tools are Agent-only | Cannot call `caelus_natal_chart` directly in a step's `execute()` | Every computation step must go through an agent, adding LLM call overhead |
| `listTools()` keeps MCP connection alive | Static tools connection persists for agent lifetime | For long-running servers, prefer `listToolsets()` + `disconnect()` |
| First `npx` call latency | `npx -y caelus-mcp` downloads package on first run | Pin version in args; first cold start is slow |
| 34 tools is a large tool set | High context consumption for the agent | Use `activeTools` filtering per step, or ToolSearchProcessor |
| No auth on public Caelus endpoint | Stateless, no sessions, no progress notifications | Simplify client config; no auth tokens needed |
| Stateless HTTP = no subscriptions | Features like elicitation, resource subscriptions don't work | Not a problem for astroguia's read-only chart computation use case |

### Type Safety

- Use `mastra.getWorkflow('key')` with the registration key for full type inference on input/output schemas
- `.getWorkflowById('id')` exists but has weaker type inference
- Step `resumeSchema` and `suspendSchema` provide type-safe suspend/resume data
- `RequestContext` schema validation is available for multi-tenant setups

---

## 13. Migration Notes from Existing Research

| Existing Research Statement | Updated Understanding |
|---|---|
| "MCP tools are Agent-only, not available to Workflows" | Confirmed. Workaround: Workflow Step → Agent → MCP Tools. For programmatic access without LLM overhead, install `caelus` npm package separately. |
| "Workflows can call agents as steps" | Now has first-class support via `createStep(agent)` and `createStep(agent, { structuredOutput })` |
| "Schedules are not yet file-based" | Still true — schedules use the `schedule` config on `createWorkflow()`, not file-based discovery |
| Only Zod mentioned for schemas | Valibot and ArkType also supported via Standard JSON Schema |
| Basic `.then().commit()` shown | Full control flow now available: `.parallel()`, `.branch()`, `.foreach()`, `.map()`, `.dountil()`, `.dowhile()`, nested workflows, `cloneWorkflow()` |
| No workflow state mentioned | `stateSchema` + `state` + `setState` available for shared data across steps |
| Suspend/resume mentioned in passing | Full API documented: `suspend()`, `resume()`, `resumeSchema`, `suspendSchema`, `suspendData`, `bail()`, snapshots, `createWorkflowStateReader()` |
| No error handling documented | Full discriminated union result types, lifecycle callbacks (`onFinish`, `onError`), retry config, `bail()`, step-level error inspection |
| No streaming detail | `run.stream()`, `fullStream`, `resumeStream()`, agent `textStream.pipeTo(writer)` |
| No time travel / debugging | `run.timeTravel()`, `timeTravelStream()`, step-level re-execution, nested step paths |

---

## 14. Sources Consulted

- [Mastra Workflows Overview](https://mastra.ai/docs/workflows/overview)
- [Mastra Control Flow](https://mastra.ai/docs/workflows/control-flow)
- [Mastra Workflow State](https://mastra.ai/docs/workflows/workflow-state)
- [Mastra Suspend & Resume](https://mastra.ai/docs/workflows/suspend-and-resume)
- [Mastra Error Handling](https://mastra.ai/docs/workflows/error-handling)
- [Mastra Human-in-the-loop](https://mastra.ai/docs/workflows/human-in-the-loop)
- [Mastra Snapshots](https://mastra.ai/docs/workflows/snapshots)
- [Mastra Time Travel](https://mastra.ai/docs/workflows/time-travel)
- [Mastra Step class reference](https://mastra.ai/reference/workflows/step)
- [Mastra Workflow class reference](https://mastra.ai/reference/workflows/workflow)
- [Mastra Tools](https://mastra.ai/docs/agents/using-tools)
- Existing astroguia research: `mastra-project-structure.md`, `mastra-caelus-integration.md`, `caelus-tool-mapping.md`
