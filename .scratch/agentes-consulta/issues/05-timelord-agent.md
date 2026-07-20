# 05 — TimelordAgent: agente de dashas, firdaria y progresiones

- **GitHub**: [#10](https://github.com/torresposso/astroguia/issues/10)

**What to build:** Agente especialista en técnicas predictivas de timing. Usa 6 herramientas de caelus-mcp: dashas védicos (Vimshottari, Yogini, Ashtottari), firdaria medieval, progresiones secundarias, direcciones primarias, profecciones anuales/mensuales, y releasing zodiacal. Responde en español explicando los períodos activos y sus significados.

**Blocked by:** 01-infraestructura

**Status:** listo-para-agente

- [ ] Crear `src/mastra/agents/timelord-agent.ts`: instancia `Agent` con `id: 'timelord-agent'`, modelo `opencode/hy3-free`, tools filtradas vía `getToolsFor('timelord-agent')`
- [ ] Instrucciones en inglés: rol de astrólogo especializado en técnicas de tiempo, explicación de cada sistema (dashas védicos, firdaria, progresiones, direcciones, profecciones, releasing), cuándo usar cada herramienta, formato de respuesta en español destacando el período actual, el regente del período y su significado
- [ ] Herramientas MCP incluidas: `dasha`, `firdaria`, `progressions`, `directions`, `profections`, `releasing`
- [ ] Memoria configurada con working memory compartido
- [ ] `getToolsFor('timelord-agent')` devuelve exactamente 6 tools con los IDs correctos
