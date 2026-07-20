# 07 — RectificationAgent: agente de rectificación de hora de nacimiento

- **GitHub**: [#12](https://github.com/torresposso/astroguia/issues/12)

**What to build:** Agente especialista en rectificación de hora de nacimiento. Usa 2 herramientas de caelus-mcp: `rectification_grid` (barrido de ASC/MC sobre una ventana de horas) y `find_aspect_dates` (fechas exactas de aspectos para cotejar con eventos de vida). Responde en español guiando al astrólogo en el proceso de afinar la hora de nacimiento.

**Blocked by:** 01-infraestructura

**Status:** listo-para-agente

- [ ] Crear `src/mastra/agents/rectification-agent.ts`: instancia `Agent` con `id: 'rectification-agent'`, modelo `opencode/hy3-free`, tools filtradas vía `getToolsFor('rectification-agent')`
- [ ] Instrucciones en inglés: rol de astrólogo especializado en rectificación, flujo de trabajo: (1) usar `rectification_grid` con `window_start_hour`/`window_end_hour` y `step_minutes` para generar la grilla ASC/MC, (2) identificar candidatos de hora según eventos de vida de la persona, (3) usar `find_aspect_dates` para verificar qué horas candidatas generan aspectos en fechas de eventos significativos. Formato de respuesta en español mostrando las horas candidatas, cambios de signo del ASC, y fechas de aspectos relevantes
- [ ] Herramientas MCP incluidas: `rectification_grid`, `find_aspect_dates`
- [ ] Memoria configurada con working memory compartido
- [ ] `getToolsFor('rectification-agent')` devuelve exactamente 2 tools con los IDs correctos
