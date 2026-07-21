# 02 — Workflow computeAllCharts

- **GitHub**: [#20](https://github.com/torresposso/astroguia/issues/20)

**What to build:** Workflow `computeAllCharts` que ejecuta `chart_facts` + 4 tools de timing (dasha, firdaria, directions, releasing) de caelus-mcp en paralelo y persiste el resultado en `chart_data`. Se dispara automáticamente desde `savePerson` después de crear o actualizar una persona. Si caelus no responde, lanza error y no crea la persona.

**Blocked by:** 01 — Schema, repository y tool loadChartData (necesita saveChartData para persistir).

**Status:** ready-for-agent

- [ ] Crear `src/mastra/workflows/computeAllCharts.ts` con 3 Steps:
  - **validate**: recibe personId, carga persona desde PersonRepository. Aborta si no existe.
  - **compute**: ejecuta `Promise.allSettled` con las 5 tools de caelus-mcp: chart_facts, dasha, firdaria, directions, releasing
  - **store**: para cada tool exitosa incluye su resultado; para fallos guarda `{ error }`. Si todas fallaron (caelus caído), lanza error.
- [ ] Registrar workflow en `src/mastra/index.ts`: `Mastra({ workflows: { computeAllCharts } })`
- [ ] Integrar en `savePerson`: después de crear/actualizar, disparar `computeAllCharts`. Si falla, savePerson lanza error (no crear persona sin datos)
- [ ] Tests: con MCPClient mockeado — verificar que llama 5 tools, que fallos parciales se guardan con error, que error total lanza excepción
