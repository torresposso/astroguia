# 03 — Cleanup, ADR y documentación

- **GitHub**: [#21](https://github.com/torresposso/astroguia/issues/21)

**What to build:** Eliminar los agentes especialistas viejos que quedaron obsoletos (natal-agent, factory), recortar las tools estáticas del timelord-agent, crear ADR-0004 documentando el cambio de arquitectura, y actualizar CONTEXT.md con la nueva terminología.

**Blocked by:** 02 — Workflow computeAllCharts (el orquestador ya debe responder desde chart_data antes de eliminar los agentes natales).

**Status:** ready-for-agent

- [ ] Eliminar `src/mastra/agents/natal-agent.ts`
- [ ] Eliminar `src/mastra/agents/factory.ts` (createSpecialistAgent)
- [ ] En `AGENT_TOOLS` en `caelus.ts`, quitar dasha, firdaria, directions, releasing de `timelord` (se queda con progressions, profections)
- [ ] Actualizar `src/mastra/agents/timelord-agent.ts` — quitar las tools estáticas del system prompt
- [ ] Actualizar `src/mastra/index.ts` — remover referencias a natal-agent, factory
- [ ] Crear `docs/adr/0004-compute-all-stored-chart-data.md` documentando: de 6 especialistas vía MCP a chart_data persistente + orquestador con loadChartData
- [ ] Actualizar CONTEXT.md: agregar entry `## Chart data`, `## computeAllCharts`, actualizar `## Agent orchestrator`
- [ ] Verificar que `npm run build` y `npm test` pasan sin los archivos eliminados
