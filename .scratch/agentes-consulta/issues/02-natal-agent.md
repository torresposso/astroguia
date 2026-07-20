# 02 — NatalAgent: agente de carta natal

- **GitHub**: [#7](https://github.com/torresposso/astroguia/issues/7)

**What to build:** Agente especialista en cartas natales. Usa 9 herramientas de caelus-mcp para computar y analizar la carta natal completa de una persona, incluyendo posiciones planetarias, aspectos, patrones, dignidades, lots herméticos, nakshatras, vargas y yogas védicos. Responde en español con interpretación clara y educativa.

**Blocked by:** 01-infraestructura

**Status:** listo-para-agente

- [ ] Crear `src/mastra/agents/natal-agent.ts`: instancia `Agent` con `id: 'natal-agent'`, modelo `opencode/hy3-free`, tools filtradas vía `getToolsFor('natal-agent')`
- [ ] Instrucciones en inglés: rol de astrólogo computacional especializado en cartas natales, lista de 9 herramientas disponibles con cuándo usar cada una, formato de respuesta en español, uso de working memory para datos de la persona, prohibición de alucinar posiciones o aspectos
- [ ] Herramientas MCP incluidas: `natal_chart`, `chart_facts`, `chart_signature`, `aspect_patterns`, `dignities`, `lots`, `nakshatras`, `vargas`, `yogas`
- [ ] Memoria configurada con `LibSQLStore` (`file:./memory.db`), working memory habilitado con `scope: 'resource'` y template compartido importado
- [ ] El agente exportado puede ser importado sin errores
- [ ] `getToolsFor('natal-agent')` devuelve exactamente 9 tools con los IDs correctos
