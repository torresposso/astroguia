# Caelus API & Interpretation Layer — Enrichment for astroguia

Research complement to `caelus-tool-mapping.md` and `mastra-caelus-integration.md`. Covers the npm package ecosystem, interpretation pipeline, provenance framing, and programmatic access patterns discovered in the Caelus docs.

**Date**: 2026-07-17
**Sources**: ephemengine.com — API Reference, Interpretation Layer, MCP Setup, Chart Provenance

---

## 1. Summary

The existing research modeled Caelus exclusively as an MCP server — 34 tools accessed through an LLM agent. The Caelus docs reveal a **dual-access architecture**: MCP for LLM tool-use AND a TypeScript npm package (`caelus`) for programmatic calls. This dual nature, plus the interpretation layer (selectors, rules, `interpret()`, `chartBrief`, `auditCitations`), and the public-domain delineations package, fundamentally change the recommended astroguia architecture.

---

## 2. The Caelus Package Ecosystem

### Gap

Existing research only documents `caelus-mcp` (the MCP server). Five more packages exist.

| Package | Purpose | Relevance to astroguia |
|---|---|---|
| `caelus` | Core engine — `Engine`, `interpretationContext`, selectors, `interpret()` | **Critical** — programmatic chart computation in workflow steps |
| `caelus-mcp` | MCP server (already documented) | Agent tool-use path |
| `caelus-birth` | Birth data extraction from free text | Medium — parse "June 10 1990, 2:30pm, Tampa FL" |
| `caelus-wheel` | Chart wheel SVG/CSS visualization | Medium — render chart wheel in UI |
| `caelus-delineations-pd` | Public-domain delineation rules as `InterpretationSource` | **High** — bootstrap rule corpus |
| `caelus-engine` (PyPI) | Python bindings | Low — not relevant for TypeScript stack |

### Why this changes the architecture

The existing research states: *"MCP tools are Agent-only. Workflows must use `caelus` npm package directly for programmatic calls."* But it didn't document what that looks like. The API reference provides the exact pattern:

```typescript
import { Engine, julianDay, interpretationContext } from 'caelus'
import { embeddedData } from 'caelus/data-embedded'

const engine = new Engine(embeddedData)
```

**This means workflow steps for chart computation can bypass the LLM entirely**, using `caelus` directly instead of calling an agent that calls MCP tools. This is faster, cheaper, and deterministic.

### Revised MCP vs npm decision matrix

| Access pattern | When to use | Overhead |
|---|---|---|
| `caelus` npm in workflow step | Deterministic computation (chart cast, transit scan, dignities) | Zero LLM cost, sub-millisecond |
| `caelus-mcp` via Agent | LLM decides which tool to call (open-ended exploration) | LLM call per tool invocation |
| `caelus-mcp` via Agent with `activeTools` | LLM needs specific tool (guided computation) | One LLM call |

---

## 3. The Interpretation Layer — Full Pipeline

### Gap

Existing research only covers `chart_facts` MCP tool. The interpretation layer is a much deeper pipeline:

```
Engine.chart()
  → interpretationContext(chart, { stars, lots, ...enrichContextOptions })
  → Selectors (hasPlacement, hasAspect, hasPattern, ...)
  → Sources (your Rule[] corpus)
  → interpret(ctx, sources)  →  Reading
  → reconcile(reading)       →  ReadingGroup[]
  → chartBrief(ctx)          →  LLM prompt with citation instructions
  → auditCitations(claims, ctx) → citation verification
```

### 3a. `interpretationContext()` — programmatic fact projection

Equivalent to `chart_facts` MCP tool, but callable directly in code:

```typescript
import { Engine, julianDay, interpretationContext, enrichContextOptions } from 'caelus'

const engine = new Engine(embeddedData)
const chart = engine.chartAt(julianDay(1990, 6, 10, 14, 30, 0), 27.95, -82.46, 'placidus')

const ctx = interpretationContext(chart, {
  stars: engine.starConjunctions(chart),  // fixed-star conjunctions
  lots: engine.lots(chart),               // Hermetic lots
  ...enrichContextOptions(engine, chart, {
    jd: julianDay(2026, 7, 17, 12, 0),   // current date for transits + time-lords
    lat: 27.95,
    lonEast: -82.46,
    zodiac: chart.zodiac,
  }),
})

// ctx.atoms — ranked FactAtom[] with salience, id, text, kind
// ctx.atoms[0].id   → "pattern:t_square:mars-moon-saturn"
// ctx.atoms[0].text → "T-square: Mars, Moon, Saturn (apex Saturn)"
// ctx.atoms[0].salience → 4.2
```

### 3b. Selectors — rule matching as code

The existing research has no coverage of selectors. These are the core building block for deterministic rule-based interpretations:

```typescript
import {
  hasPlacement, hasAspect, hasPattern, hasDispositor,
  hasReception, hasSignature, hasTransit, hasTimelord,
  hasStar, hasLot, matchAll, matchAny, matchNone,
} from 'caelus'

// Evolutionary astrology selectors
const plutoInWaterHouse = matchAll(
  hasPlacement({ body: 'pluto' }),
  matchAny(
    hasPlacement({ house: 4 }),
    hasPlacement({ house: 8 }),
    hasPlacement({ house: 12 }),
  ),
)

const tenseAspectToPluto = matchAny(
  hasAspect({ between: ['pluto', 'saturn'], aspect: 'square' }),
  hasAspect({ between: ['pluto', 'saturn'], aspect: 'opposition' }),
  hasAspect({ between: ['pluto', 'mars'], aspect: 'square' }),
)

const saturnInAngularHouse = matchAll(
  hasPlacement({ body: 'saturn' }),
  matchAny(
    hasPlacement({ house: 1 }),
    hasPlacement({ house: 4 }),
    hasPlacement({ house: 7 }),
    hasPlacement({ house: 10 }),
  ),
)
```

### 3c. `interpret()` — deterministic rule-based reading

```typescript
import { interpret, reconcile } from 'caelus'

const source: InterpretationSource = {
  id: 'evolutionary-astrology',
  version: '0.1',
  rules: [
    {
      id: 'pluto-water-house',
      when: plutoInWaterHouse,
      text: 'Pluto in a water house signals deep unconscious evolutionary pressure. The soul is working through ancestral or karmic material that resists intellectual analysis.',
      weight: 1.5,
      tags: ['pluto', 'water', 'karmic'],
    },
    {
      id: 'tense-pluto',
      when: tenseAspectToPluto,
      text: (match) =>
        `Hard aspects to Pluto (${match.atoms.map(a => a.id).join(', ')}) indicate the evolutionary journey involves confrontation with power, control, and transformation.`,
      weight: 1.3,
      tags: ['pluto', 'challenging'],
    },
  ],
}

const reading = interpret(ctx, [source])
// reading.entries — ranked by salience, each with atomIds (provenance)

const reconciled = reconcile(reading, {
  dedupe: true,
  conflicts: [['affirming', 'challenging']],
})
```

### 3d. `chartBrief()` — LLM prompt with citation instructions

```typescript
import { chartBrief, auditCitations } from 'caelus'

const brief = chartBrief(ctx, { limit: 30, reading })

// brief.prompt is ready to send to an LLM:
// "Natal chart facts follow, each with a stable id in [brackets].
//  Interpret them in your own words; after each statement, cite the
//  id(s) it rests on as [id]..."
//
// [placement:pluto] Pluto in Scorpio, house 8, retrograde
// [aspect:pluto~saturn:square] Pluto square Saturn (applying, orb 2.1°)
// ...

// After the LLM responds, verify its citations:
const audit = auditCitations(llmClaims, ctx)
if (!audit.ok) {
  console.log('Hallucinated fact IDs:', audit.unknown)
}
```

### 3e. Architecture impact: hybrid reading (rules + LLM)

The interpretation layer enables a **hybrid architecture** unique to astroguia:

```
Workflow Step 1: Compute chart via caelus npm (programmatic, no LLM)
  → Engine.chartAt() → interpretationContext() → enriched atoms

Workflow Step 2: Rule-based reading via interpret() (deterministic, no LLM)
  → Selectors match evolutionary patterns → ranked Reading

Workflow Step 3: LLM synthesis via chartBrief() + Agent
  → Send brief.prompt to LLM → agent writes novel prose citing [ids]

Workflow Step 4: Verification via auditCitations()
  → Check all LLM citations resolve to real facts
```

This gives astroguia the best of both worlds: deterministic rule grounding + fluent LLM prose.

---

## 4. Provenance — Honest Handling of Uncertain Birth Data

### Gap

Existing research assumes exact birth times. Caelus has a `Realm` + `Certainty` system for honest uncertainty handling.

### The `realize()` pattern

```typescript
import { Engine, realize, interpretationContext } from 'caelus'

const realized = realize(engine, {
  realm: 'natal',
  when: { kind: 'instant', instant: '1990-06-10T14:30:00Z' },
  where: { kind: 'geo', lat: 27.95, lonEast: -82.46 },
})

// When birth time is approximate:
const uncertain = realize(engine, {
  realm: 'natal',
  when: {
    kind: 'range',
    earliest: '1990-06-10T12:00:00Z',
    latest: '1990-06-10T18:00:00Z',
  },
  where: { kind: 'geo', lat: 27.95, lonEast: -82.46 },
})

const ctx = interpretationContext(uncertain.chart, {
  provenance: {
    realm: uncertain.realm,
    certainty: uncertain.time.certainty, // 'approximate' | 'representative'
  },
})
```

### Certainty damping

When `certainty` is not `exact`, Caelus automatically damps:
- Moon and angle salience: **×0.7** (approximate) or **×0.6** (representative)
- Slow planets keep full weight
- `chartBrief` prepends a realm framing line warning the model

### Realms

| Realm | Meaning | Effect on interpretation |
|---|---|---|
| `natal` | A person's birth | Standard interpretation |
| `forecast` | A future moment | Provisional framing in brief |
| `mythic` | A symbolic/mythological subject | Treated as symbol, not biography |
| `archetypal` | An abstract concept | Compiled from constraints, not ephemeris |
| `conceptual` | An idea or question | Same as archetypal |

### Why this matters for astroguia

Evolutionary astrology readings must be honest about birth time uncertainty. The provenance system handles this automatically:
- Unknown birth time → warn about Moon/angles/houses being uncertain
- Forecast → frame as provisional
- Archetypal queries → use `compileForm` for constraint-synthesized charts

---

## 5. Delineations Package — Bootstrap Rule Corpus

### Gap

Not mentioned in existing research.

### What it is

`caelus-delineations-pd` is a companion npm package containing **hundreds of public-domain delineations** decomposed into `InterpretationSource` rules. It's separate from the engine.

```typescript
import { publicDomainSources } from 'caelus-delineations-pd'
import { interpret } from 'caelus'

const reading = interpret(ctx, publicDomainSources)
```

This gives astroguia a ready-to-use rule corpus for planet-in-sign, planet-in-house, aspects, rising signs, and fixed stars — all with citation provenance.

### How to use it in astroguia

The delineations provide a baseline that astroguia can extend with evolutionary-specific rules:

```typescript
import { publicDomainSources } from 'caelus-delineations-pd'

const evolutionarySource: InterpretationSource = {
  id: 'evolutionary',
  version: '0.1',
  rules: [
    // Evolutionary-specific rules (Pluto, nodes, Saturn patterns)
  ],
}

const reading = interpret(ctx, [...publicDomainSources, evolutionarySource])
```

---

## 6. Programmatic Access in Workflow Steps

### Gap

Existing research says workflows can't use MCP tools but must use `caelus` npm. But the exact code pattern wasn't documented.

### Concrete workflow step with direct Caelus access

```typescript
import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { Engine, julianDay, interpretationContext, enrichContextOptions } from 'caelus'
import { embeddedData } from 'caelus/data-embedded'

const engine = new Engine(embeddedData)

export const computeChartAtoms = createStep({
  id: 'compute-chart-atoms',
  inputSchema: z.object({
    date: z.string(),
    lat: z.number(),
    lon: z.number(),
    houseSystem: z.string().optional(),
  }),
  outputSchema: z.object({ atoms: z.array(z.any()), briefPrompt: z.string() }),
  execute: async ({ inputData }) => {
    const birthDate = new Date(inputData.date)
    const jd = julianDay(
      birthDate.getUTCFullYear(),
      birthDate.getUTCMonth() + 1,
      birthDate.getUTCDate(),
      birthDate.getUTCHours(),
      birthDate.getUTCMinutes(),
      birthDate.getUTCSeconds(),
    )

    const chart = engine.chartAt(jd, inputData.lat, inputData.lon, inputData.houseSystem ?? 'placidus')

    const ctx = interpretationContext(chart, {
      stars: engine.starConjunctions(chart),
      lots: engine.lots(chart),
      ...enrichContextOptions(engine, chart, {
        jd: julianDay(new Date().getUTCFullYear(), /* ... */),
        lat: inputData.lat,
        lonEast: inputData.lon,
        zodiac: chart.zodiac,
      }),
    })

    const brief = chartBrief(ctx, { limit: 30 })

    return {
      atoms: ctx.atoms,
      briefPrompt: brief.prompt,
    }
  },
})
```

**No LLM call required for chart computation.** The LLM is only needed for the interpretation/synthesis step.

---

## 7. New Caelus Tools Not in the Existing Mapping

| Tool | Use in astroguia | Priority |
|---|---|---|
| `chart_features` + `similar_skies` | ML feature vectors; find when sky matched a reference | Low |
| `counterfactual_chart` | "What if born 1 hour earlier?" | Medium |
| `cosmic_weather` | Daily configurations without natal chart | Medium |
| `rectification_grid` | Birth time rectification for uncertain times | Medium |
| `sky_view` / `sky_view_sequence` | Visual sky rendering at birth moment | Low |
| `compileForm` | Synthesize archetypal charts from constraints | Medium |
| `chart_diff` | Diff two charts (e.g., current vs birth transits) | High |
| `similar_skies` | Find past/future moments matching a configuration | Low |

### `chartDiff` — transit impact visualization

```typescript
import { chartDiff, transitAspects } from 'caelus'

const diff = chartDiff(natalChart, currentChart)
// diff.bodyChanges — bodies that changed sign or house
// diff.aspectsGained — new aspects at current time
// diff.aspectsLost — aspects that dissolved
// diff.angleChanges — angles that changed sign
```

---

## 8. Salience Customization for Evolutionary Astrology

### Gap

Existing research doesn't cover salience customization.

### Default salience weights are overridable

```typescript
const ctx = interpretationContext(chart, {
  salience: {
    // Evolutionary priorities
    pattern: 6,       // upweight configurations (T-squares, yods)
    hardAspect: 4,    // upweight squares/oppositions
    angular: 3,       // keep angles important
    luminary: 2,      // moderate luminary bump
    dispositor: 3,    // upweight dispositor chains
    transit: 5,       // upweight active transits
    timelord: 5,      // upweight profections/firdaria
  },
})
```

This allows astroguia to tune what the engine considers "prominent" specifically for evolutionary readings, where Pluto, nodes, hard aspects, and time-lords matter more than in traditional astrology.

---

## 9. `toModelOutput` + `chartBrief` — Optimized LLM Context

The existing research mentions using `activeTools` filtering and `ToolSearchProcessor` to manage tool context. The interpretation layer provides a more elegant solution:

```typescript
// Instead of sending all 34 tool descriptions to the LLM,
// send only the pre-computed, salience-ranked facts:

const brief = chartBrief(ctx, { limit: 20 })

// This produces a compact prompt that fits easily in context:
// [placement:pluto] Pluto in Scorpio, house 8, retrograde
// [aspect:pluto~saturn:square] Pluto square Saturn (applying, orb 2.1°)
// ...
```

The LLM receives validated facts, not tool descriptions. It writes prose and cites `[id]`. Zero tool calls during interpretation — all computation happened programmatically.

---

## 10. Recommended Architecture (Revised)

Given the full Caelus ecosystem, the optimal astroguia architecture is:

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Step 1                           │
│  caelus npm (Engine.chartAt + interpretationContext)         │
│  → Programmatic, no LLM, sub-millisecond                     │
│  → Returns: ctx.atoms (ranked facts) + brief.prompt          │
├─────────────────────────────────────────────────────────────┤
│                    Workflow Step 2                           │
│  interpret(ctx, [publicDomainSources, evolutionarySource])   │
│  → Deterministic rule-based reading (no LLM)                 │
│  → Returns: Reading (ranked entries with provenance)         │
├─────────────────────────────────────────────────────────────┤
│                    Workflow Step 3                           │
│  LLM Agent (openai/gpt-5.5)                                 │
│  → Receives: chartBrief(ctx, { reading }) prompt             │
│  → Writes: novel evolutionary prose citing [ids]             │
│  → StructuredOutput: EvolutionaryReadingSchema               │
├─────────────────────────────────────────────────────────────┤
│                    Workflow Step 4                           │
│  auditCitations(llmClaims, ctx)                              │
│  → Verify no hallucinated facts                              │
│  → Returns: ok + unknown ids                                 │
└─────────────────────────────────────────────────────────────┘
```

**Key insight**: The LLM is only used in step 3 for prose generation. Steps 1, 2, and 4 are deterministic TypeScript code. This is faster, cheaper, and more reliable than having the LLM drive Caelus MCP tools.

---

## 11. Summary of Enrichment Impact

| Capability | Priority | Existing Coverage | What Changes |
|---|---|---|---|
| `caelus` npm programmatic access | **Critical** | Only MCP documented | Workflow steps compute charts without LLM overhead |
| `interpretationContext()` | **Critical** | Only `chart_facts` MCP tool | Direct fact projection in code |
| `chartBrief()` + `auditCitations()` | **Critical** | Not covered | LLM gets validated facts + citation verification |
| Selectors + `interpret()` | **High** | Not covered | Deterministic rule-based reading engine |
| Delineations package | **High** | Not covered | Ready-to-use public-domain rule corpus |
| Provenance / Certainty | **Medium** | Not covered | Honest handling of uncertain birth times |
| Salience customization | **Medium** | Not covered | Tune prominence for evolutionary priorities |
| `chartDiff` | **High** | Not covered | Transit impact visualization |
| `counterfactual_chart` | **Medium** | Not covered | "What if" exploration |
| `caelus-birth` | **Medium** | Not covered | Parse birth data from free text |
| `caelus-wheel` | **Low** | Not covered | Chart wheel rendering |

---

## 12. Sources Consulted

- [Caelus API Reference](https://www.ephemengine.com/docs/api)
- [Caelus Interpretation Layer](https://www.ephemengine.com/docs/interpretation)
- [Caelus MCP Setup](https://www.ephemengine.com/docs/mcp)
- [Caelus Chart Provenance](https://www.ephemengine.com/docs/provenance)
- [Caelus Architecture](https://www.ephemengine.com/docs/architecture)
- [Caelus Edge Cases & Stability](https://www.ephemengine.com/docs/edge-cases)
- Existing astroguia research: `caelus-tool-mapping.md`, `mastra-caelus-integration.md`

---

## 13. Architecture Pipeline — `caelus-birth` and the Full Stack

### Gap

Existing research treats chart computation as a single MCP call. Caelus is a layered pipeline.

### The full pipeline

```text
place + local time
  → caelus-birth    resolve IANA zone from coords, local → UT (DST-safe)
  → caelus          positions, houses, aspects from the UT instant
  → caelus-wheel    SSR-safe SVG wheel from the chart object
  → caelus-mcp      (optional) same engine as AI tools
```

Only `caelus-birth` has runtime dependencies (timezone data). The core engine is zero-dependency and I/O-free. The wheel renders to a string.

### `caelus-birth` — DST-safe time resolution

The existing research treats birth dates as already-UTC strings. In reality, users enter local wall-clock time. `caelus-birth` resolves the IANA timezone from coordinates and handles DST edge cases:

```typescript
import { localToChart } from 'caelus-birth'
import { Engine } from 'caelus'
import { embeddedData } from 'caelus/data-embedded'

const engine = new Engine(embeddedData)

const { chart, zone, status } = localToChart(
  { year: 1990, month: 6, day: 10, hour: 14, minute: 30, lat: 27.95, lon: -82.46 },
  engine,
)

// status: 'ok' | 'ambiguous' | 'nonexistent'
// zone: 'America/New_York'
// chart: the Chart object with DST-correct UTC
```

**Critical for production**: `status` can be `ambiguous` (fall-back DST overlap — two UTC instants map to the same wall time) or `nonexistent` (spring-forward gap — the wall time never happened). Both must be surfaced to the user, never silently resolved.

### Starter template

`caelus-starter` is a deployable Next.js app with the full pipeline pre-wired: birth form, timezone handling, server-rendered wheel, optional reading route. Clone it instead of wiring from scratch.

---

## 14. Edge Cases & Production Stability

### Gap

Zero coverage in existing research. These are production-critical for any app serving real users.

### 14a. Date range: 1800–2149

The engine throws `RangeError` outside 1800–2149 (Moon/Chiron: 1850–2150). The REST API returns 400. Validate birth dates before calling the engine.

```typescript
const year = birthDate.getUTCFullYear()
if (year < 1800 || year > 2149) {
  throw new Error(`Date ${year} outside supported range 1800–2149`)
}
```

### 14b. Longitude: east-positive

Caelus uses **east-positive** (NY = `-74.0`, Tokyo = `+139.7`). A sign flip silently gives wrong charts. The REST endpoint validates `[-180, 180]` but the npm engine does not. Always validate longitude before passing to `chartAt`:

```typescript
function validateLon(lon: number): void {
  if (lon < -180 || lon > 180) {
    throw new Error(`Longitude ${lon} outside [-180, 180]. Caelus uses east-positive convention.`)
  }
}
```

### 14c. DST edge cases in production

Two civil time problems the engine cannot resolve:

| Case | When | Resolution |
|---|---|---|
| **Nonexistent time** | Spring-forward gap (e.g., 02:30 on DST start) | Reject or snap to gap edge |
| **Ambiguous time** | Fall-back overlap (two UTC instants) | Surface both offsets, let user pick |

`caelus-birth` returns `status: 'nonexistent'` or `status: 'ambiguous'`. Always check this:

```typescript
const { chart, status } = localToChart({ year, month, day, hour, minute, lat, lon }, engine)

if (status === 'nonexistent') {
  return { error: 'This local time does not exist (DST spring-forward gap).' }
}
if (status === 'ambiguous') {
  return { error: 'This local time is ambiguous (DST fall-back). Please specify the UTC offset.' }
}
```

### 14d. Polar house fallback

Placidus and Koch are undefined above ~66° latitude. The engine **silently falls back** to whole-sign houses. Always compare `houseSystem` vs `houseSystemRequested`:

```typescript
const chart = engine.chart(2024, 1, 1, 12, 0, 0, 78.22, 15.65, 'placidus')

if (chart.houseSystem !== chart.houseSystemRequested) {
  console.warn(
    `Placidus undefined above polar circles. ` +
    `Fell back to ${chart.houseSystem}. House cusps are whole-sign.`
  )
}
```

Quadrant-independent systems (Porphyry, Equal, Whole Sign) never fall back.

### 14e. Circumpolar rise/set

During polar day/night, bodies don't cross the horizon. `riseSet()` returns `null`. Always branch:

```typescript
const rise = riseSet(engine, 'sun', jd, 78.22, 15.65, 'rise')
if (rise === null) {
  // Polar day/night, or no rise within the searched window
}
```

### 14f. Event search windows

Results bounded by explicit `[start, end]` AND the 1800–2149 fitted range. Empty result = "nothing in this window", not "never". Widen and retry. Outer planets can have multiple hits around retrograde loops.

### 14g. Missing data packs

`loadNodeData` degrades per-body, not all-or-nothing. A body only available in an extended pack is simply unavailable — core bodies keep working at embedded precision.

---

## 15. Versioning & Stability Contract

### Gap

No coverage of what changes between versions.

### Lockstep versioning

All four packages (`caelus`, `caelus-mcp`, `caelus-birth`, `caelus-wheel`) ship at one version. Pin exact versions and upgrade together.

### Semver-zero (pre-1.0)

| Bump | Risk |
|---|---|
| Minor (`0.x.0`) | May carry breaking changes |
| Patch (`0.x.y`) | Safe, no breaks |

### Stable surface (aiming to stay stable through 1.0)

- Core read paths: `new Engine(data)`, `chart()`, `chartAt()`, `position()`, `longitude()`, `when()`, event-search, `julianDay()`
- Data suppliers: `embeddedData`, `loadNodeData()`
- Result shapes (`Chart`, `Position`): changes are additive

### Still moving before 1.0

- Derived-charts surface (0.7.0)
- Turbo tier (0.8.0)
- MCP tool, resource, and prompt schemas
- Low-level helpers not re-exported from package root
- Unexported internals (never depend on these)

### Recommendation for astroguia

- Pin exact versions in `package.json`: `"caelus": "0.23.0"`
- Only use the stable surface (imports from package root)
- Expect MCP tool schemas to evolve; pin `caelus-mcp@0.23.0`
- Read the changelog before upgrading minor versions
