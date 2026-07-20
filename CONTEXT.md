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

An agent that routes requests to specialists. It manages persons (load/list/save tools) and delegates astrological computation to specialist agents. It has no Caelus MCP tools.
**Avoid**: Supervisor, router, dispatcher

## Agent specialist (Agente especialista)

An agent with a focused set of Caelus MCP tools for one astrological domain (natal, transits, synastry, dashas/firdaria/progressions, solar/lunar returns, rectification).
**Avoid**: Worker, subagent, expert

## MCP client

The technical connection to `caelus-mcp` via stdio. Always qualified as "MCP client" — never abbreviated to "client" alone to avoid ambiguity with Person.
**Avoid**: Client (unqualified), cliente

## Language conventions

- Code: English
- Agent system prompts: English
- Agent responses to the astrologer: Spanish
- Specs, tickets, docs: Spanish
- Sign/aspect names in responses: English
