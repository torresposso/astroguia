# Astroguía Context

Astroguía is a multi-agent computational astrology assistant powered by Mastra and Caelus.

## Person

A person whose birth chart is analyzed by the astrologer — the astrologer's client. The database table is `persons`, the repository is `PersonRepository`.
**Avoid**: Client, patient, subject

## Consultation

An astrological reading performed by the astrologer for a person. The database field for the type of consultation (natal, transit, synastry, timelord, returns, rectification) is called "tipo de consulta".
**Avoid**: Session, reading, query

## Working memory

A Mastra Memory feature that persists key information (person birth data) across conversation threads. Not translated — kept in English as a Mastra-specific term.
**Avoid**: Memoria de trabajo, scratchpad, context

## Agent

A Mastra Agent instance with tools and instructions. Generic term.

## Agent orchestrator (Agente orquestador)

An agent that receives all input, manages persons (load/list/save tools, `loadChartData`), reads pre-computed chart data from `persons.chart_data`, and delegates live computations to specialist agents. It has no Caelus MCP tools.
**Avoid**: Supervisor, router, dispatcher

## Agent specialist (Agente especialista)

An agent with a focused set of Caelus MCP tools for one astrological domain that requires live computation (transits, synastry, progressions/profections, solar/lunar returns, rectification). Specialist agents no longer exist for static chart data.
**Avoid**: Worker, subagent, expert

## Chart data

Pre-computed astrological results stored as JSON in the `chart_data` column of `persons`. Includes the natal chart, chart facts, dignities, Hermetic lots, Vedic data, dashas, firdaria, primary directions, and zodiacal releasing. Computed once by the `computeAllCharts` workflow when a person is created or updated, then read directly by the orchestrator via `loadChartData`. The `chart_facts` tool bundles 9 sub-tools into one call and includes a ready-to-use LLM brief.
**Avoid**: Cache, cached results, stored results

## computeAllCharts

A Mastra workflow that runs synchronously after `savePerson` creates or updates a person. Executes `chart_facts` + 4 timing tools (dasha, firdaria, directions, releasing) from caelus-mcp in parallel and stores results in `chart_data`. Partial failures are preserved; total failure throws an error.

## MCP client

The technical connection to `caelus-mcp` via stdio. Always qualified as "MCP client" — never abbreviated to "client" alone to avoid ambiguity with Person.
**Avoid**: Client (unqualified), cliente

## Language conventions

- Code: English
- Agent system prompts: English
- Agent responses to the astrologer: Spanish
- Specs, tickets, docs: Spanish
- Sign/aspect names in responses: English
