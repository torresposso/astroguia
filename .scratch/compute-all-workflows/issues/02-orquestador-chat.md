# 02 — Orquestador chat-mode

**What to build:** Un único agente Mastra que recibe todas las preguntas del astrólogo. Solo tiene las 3 tools CRUD (`loadPerson`, `listPersons`, `savePerson`). En modo chat libre, el agente lee datos cacheados de `persons.db` y responde preguntas *sin llamar a caelus nunca*. Si faltan datos, sugiere ejecutar el workflow compute-all. Si necesita datos bajo demanda (transits, retornos, sinastría), delega al workflow correspondiente.

- **GitHub**: [#15](https://github.com/torresposso/astroguia/issues/15)

**Blocked by:** [#14](https://github.com/torresposso/astroguia/issues/14) (compute-all) — necesita que exista el cache para poder leerlo.

**Status:** ready-for-agent

- [ ] Reemplazar el `consultationAgent` actual (`src/mastra/agents/consultation-agent.ts`) con el nuevo orquestador que solo tiene las 3 tools CRUD (`loadPerson`, `listPersons`, `savePerson`) y **ninguna** tool de caelus.
- [ ] El system prompt del orquestador debe instruir:
  - Al cargar una persona, leer `cached_results` de `persons.db`
  - Si el cache existe, responder preguntas sobre la carta natal, dashas, etc. directo del cache — no llamar caelus
  - Si faltan datos para responder, sugerir ejecutar compute-all (ticket 01) o delegar a workflow bajo demanda
  - Respuestas siempre en español
- [ ] Crear una tool `queryCache(personId, queryType)` que extrae del `cached_results` JSON la porción relevante (ej: `natal_chart`, `dasha_periods`) y la devuelve como contexto para que el LLM responda
- [ ] El orquestador NO debe tener acceso directo a caelus-mcp tools — solo lee del cache
- [ ] Cuando el usuario pide datos que requieren fecha (transits, retornos, etc.), el orquestador sugiere o dispara el workflow correspondiente (ticket 03)
- [ ] Tests: verificar que el orquestador responde desde cache sin llamar caelus, que detecta cache faltante y sugiere compute-all
