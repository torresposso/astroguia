# Workflow for structured reports; Agent for Q&A — and the seams between them

The system has two pieces (decided in spec #10): a **Mastra Workflow** produces the fixed-shape evolutionary report (`collect → analyze → synthesize`), and a **file-based Mastra Agent** answers free-form Q&A about a natal chart. A supervisor-agent topology was considered for the report and rejected — the report's structure is fixed, so adaptive LLM-driven orchestration buys nothing over a typed workflow while adding non-determinism, cost, and a hallucination surface in front of deterministic Caelus computation.

Two seams follow from that shape, and they're hard to reverse:

## Seam 1 — Structured output at Step 2, not Step 3

Workflow Step 2 (`analyze`) emits a **typed `Analysis`** via `generateObject()` against a Zod schema (`sections: Array<{id, body, citations}>`), not a markdown string. Step 3 (`synthesize`) consumes that typed object and returns the final markdown `Report`. The type-safe boundary sits *between* the two LLM calls — that's where corrupted output is most expensive to detect. A pure `renderAnalysis()` / `renderReport()` path owns all markdown structure and is unit-tested by Vitest; `checks.includes('## 1.')` style gates become redundant where schematized fields already enforce presence.

Rejected: plain `generate()` + post-hoc `checks.includes` gates (probabilistic enforcement), and full `generateObject()` at Step 3 (over-constrains the synthesis reviewer, which may want narrative freedom).

## Seam 2 — Caelus npm in the Workflow, Caelus MCP in the Agent

The Workflow Step 1 (`collect`) calls the `caelus` npm package directly — synchronous typed TS imports, `Promise.all` over three functions, no LLM, no serialization hop. The Q&A Agent uses `MCPClient` from `@mastra/mcp` so Mastra auto-surfaces ~15 curated tools to the LLM with `activeTools` filtering. Rejected alternatives: npm-only (would force hand-rolling an MCP-equivalent tool wrapper for the agent) and MCP-only (would add a serialization round-trip inside a deterministic workflow step that already has full TS types). Both paths depend on the same `caelus` npm package and ship in version lockstep, so they can't drift.

Note: spec #10's "both pieces share the same MCPClient instance" wording is superseded — the Workflow doesn't touch MCP at all. The MCPClient is owned by the Q&A agent; the Workflow owns nothing MCP-related. They share the `caelus` npm dependency and nothing else.

## Out of scope for this ADR

The Q&A agent's processor pipeline (prompt-injection guard, blocking mode) is captured in Engram memory but not ADR'd — it's trivially reversible.