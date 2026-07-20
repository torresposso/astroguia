# Agent instructions for astroguia

Multi-agent computational astrology assistant built with **Mastra** + **Caelus** (astrological computation engine via MCP).

## Stack

| Layer | Tech |
|---|---|
| Framework | `@mastra/core`, `@mastra/mcp`, `@mastra/memory`, `@mastra/libsql`, `@mastra/duckdb`, `@mastra/observability` |
| Astrology | `caelus`, `caelus-birth`, `caelus-mcp` |
| Model | `opencode/hy3-free` (all agents) |
| Runtime | TypeScript ESM (ES2022, `moduleResolution: bundler`) |
| Storage | SQLite (`persons.db`) for people + consultations; LibSQL (`mastra.db`) for agent memory; DuckDB for observability |
| Tests | vitest |

## Architecture: 1 orchestrator + 6 specialists

- **consultationAgent** — receives all input, manages persons (loadPerson / listPersons / savePerson), delegates to specialists. No caelus tools.
- **6 specialist agents** — each created via `createSpecialistAgent()` factory (`src/mastra/agents/factory.ts`). They share model, input processors, and memory config. Each has a filtered subset of caelus MCP tools (2–9 per domain).

See ADRs: [ADR-0001](docs/adr/0001-caelus-via-mcp.md) (Caelus via MCP), [ADR-0002](docs/adr/0002-arquitectura-agentes.md) (1+6 architecture), [ADR-0003](docs/adr/0003-working-memory-compartido.md) (shared working memory).

## Source map

```
src/mastra/
├── index.ts                         # Mastra app setup: composite storage, observability
├── agents/
│   ├── factory.ts                   # createSpecialistAgent() — shared Agent constructor
│   ├── consultation-agent.ts        # Orchestrator (tools: loadPerson, listPersons, savePerson)
│   ├── natal-agent.ts               # 9 caelus tools: natal chart, facts, patterns, dignities, etc.
│   ├── transit-agent.ts             # 7 caelus tools: transits, aspect dates, sky events, etc.
│   ├── synastry-agent.ts            # 2 caelus tools: synastry, composite
│   ├── timelord-agent.ts            # 6 caelus tools: dasha, firdaria, progressions, directions, etc.
│   ├── returns-agent.ts             # 2 caelus tools: returns, current_sky
│   └── rectification-agent.ts       # 2 caelus tools: rectification_grid, find_aspect_dates
├── mcp/
│   └── caelus.ts                    # MCPClient → npx caelus-mcp; AGENT_TOOLS filter map; getToolsFor()
├── tools/
│   ├── load-person.ts               # find person by ID or name
│   ├── list-persons.ts              # list all registered persons
│   └── save-person.ts               # create or update person
├── memory/
│   └── template.ts                  # WORKING_MEMORY_TEMPLATE (birth data fields)
├── storage/
│   └── persons.ts                   # PersonRepository (SQLite via @libsql/client)
└── __tests__/
    ├── mcp.test.ts                  # tool filtering per agent domain
    └── persons.test.ts              # CRUD + consultation persistence
```

## Commands

```bash
npm test              # vitest run
npm run dev           # mastra dev → Studio at :4111
npm run build         # mastra build
npm run start         # mastra start
```

### Trace debugging

```bash
npm run trace:latest       # last 5 traces with duration
npm run trace:tools        # MCP/tool calls per trace
npm run trace:errors       # traces with child errors
npm run trace:get <id>     # single trace detail
npm run trace:list <json>  # paginated trace list
```

When something doesn't work as expected, these are the first place to look.

## Mastra skill (local)

This repo has a local Mastra skill at `.agents/skills/mastra/SKILL.md` and an MCP docs server configured in `opencode.jsonc`. Before touching Mastra code:
1. Read that skill — it has up-to-date API references, embedded docs guidance, and a provider registry script
2. Docs priority: **MCP docs server** (live) → embedded (`node_modules/@mastra/*/dist/docs/`) → source code → remote (`mastra.ai/llms.txt`)
3. Run `scripts/provider-registry.mjs` before using a new model or provider

## CodeGraph

This repo is CodeGraph-indexed (`.codegraph/`). Use `codegraph_explore` to understand symbols, flows, and blast radius — it replaces grep + Read cycles.

## Engram / persistent memory

Save memory with `mem_save` after:
- **Architecture changes** — new agents, tool changes, MCP config changes (topic: `architecture/agent-model`)
- **Bug fixes** — what was wrong and how it was fixed (topic: `bugfix/*`)
- **Patterns established** — naming, structure, conventions (topic: `pattern/*`)
- **Config changes** — model, storage, processors (topic: `config/*`)

Use `topic_key` for evolving topics so the same observation gets updated rather than duplicated.

## Project conventions

### Language
- Agent system prompts: **English**
- Agent responses to the astrologer: **Spanish**
- Code, comments, spec/ticket docs: **English** (except spec files — Spanish)
- Astrological terms in responses: English (sign names, aspect names, house numbers)

### Agent config
- Model: `opencode/hy3-free` on all agents
- Input processors: `TokenLimiter(100000)` + `ToolCallFilter({ preserveModelOutput: true, filterAfterToolSteps: 3 })`
- Working memory: `scope: 'resource'` with `resourceId = personId`. Specialists use `readOnly: true`

### Tests
- vitest, co-located in `__tests__/` next to the source under test
- DB tests: `file::memory:` SQLite, `beforeEach`/`afterEach` for isolation
- MCP tool tests: `vi.spyOn(mcpClient, 'listTools')` with mock tool lists
- Write tests when adding new tools or modifying tool filtering

### Person data flow
1. User provides person details → `savePerson` creates/updates in SQLite
2. `loadPerson` reads from DB and writes to working memory (`resourceId = personId`)
3. All 6 specialists read working memory (readOnly) — no repeated DB queries per delegation

## Domain vocabulary

See [CONTEXT.md](CONTEXT.md) for the glossary (`person`, `consultation`, `working memory`, `agent specialist`, `agent orchestrator`, etc.) and the terms to avoid.

## ADRs

| ADR | Topic |
|---|---|
| [0001](docs/adr/0001-caelus-via-mcp.md) | Caelus integration via MCP (instead of direct npm imports) |
| [0002](docs/adr/0002-arquitectura-agentes.md) | Agent architecture: 1 orchestrator + 6 specialists |
| [0003](docs/adr/0003-working-memory-compartido.md) | Shared working memory for multi-agent coordination |

## Issue tracker

Issues tracked as markdown under `.scratch/`, mirrored to GitHub. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

## Triage labels

| Role | Label |
|---|---|
| needs-triage | `necesita-triaje` |
| needs-info | `necesita-info` |
| ready-for-agent | `listo-para-agente` |
| ready-for-human | `listo-para-humano` |
| wontfix | `descartado` |

See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

## Domain docs layout

Single-context layout: root `CONTEXT.md` + `docs/adr/`. See [docs/agents/domain.md](docs/agents/domain.md).
