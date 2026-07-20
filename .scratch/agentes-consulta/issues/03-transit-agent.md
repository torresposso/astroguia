# 03 — TransitAgent: agente de tránsitos

- **GitHub**: [#8](https://github.com/torresposso/astroguia/issues/8)

**What to build:** Agente especialista en tránsitos planetarios. Usa 7 herramientas de caelus-mcp para analizar tránsitos actuales y futuros sobre la carta natal, fechas exactas de aspectos, cielo actual, clima cósmico, horas planetarias y luna fuera de curso. Responde en español con interpretación clara.

**Blocked by:** 01-infraestructura

**Status:** listo-para-agente

- [ ] Crear `src/mastra/agents/transit-agent.ts`: instancia `Agent` con `id: 'transit-agent'`, modelo `opencode/hy3-free`, tools filtradas vía `getToolsFor('transit-agent')`
- [ ] Instrucciones en inglés: rol de astrólogo especializado en tránsitos, lista de 7 herramientas con cuándo usar cada una (ej: `find_aspect_dates` para buscar fechas exactas, `cosmic_weather` para panorama general sin carta natal), formato de respuesta en español mencionando aspectos aplicando vs separando, orbes, casas natales activadas
- [ ] Herramientas MCP incluidas: `transits`, `find_aspect_dates`, `current_sky`, `cosmic_weather`, `void_of_course`, `planetary_hours`, `sky_events`
- [ ] Memoria configurada con working memory compartido (mismo template que todos los agentes)
- [ ] `getToolsFor('transit-agent')` devuelve exactamente 7 tools con los IDs correctos
