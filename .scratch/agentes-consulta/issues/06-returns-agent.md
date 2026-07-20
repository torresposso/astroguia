# 06 — ReturnsAgent: agente de retornos solares y lunares

- **GitHub**: [#11](https://github.com/torresposso/astroguia/issues/11)

**What to build:** Agente especialista en retornos planetarios. Usa 2 herramientas de caelus-mcp: `returns` (retorno solar y lunar — instantes exactos y carta del retorno) y `current_sky` (para contexto del cielo en el momento del retorno). Responde en español explicando el significado del retorno y las posiciones planetarias clave.

**Blocked by:** 01-infraestructura

**Status:** listo-para-agente

- [ ] Crear `src/mastra/agents/returns-agent.ts`: instancia `Agent` con `id: 'returns-agent'`, modelo `opencode/hy3-free`, tools filtradas vía `getToolsFor('returns-agent')`
- [ ] Instrucciones en inglés: rol de astrólogo especializado en retornos, uso de `returns` con `body: 'sun'` (anual) o `body: 'moon'` (mensual), parámetros `search_start`/`search_end` para la ventana de búsqueda, `return_lat`/`return_lon` para ubicación del retorno si difiere del nacimiento, `current_sky` para contexto adicional. Formato de respuesta en español destacando ASC del retorno, casa del Sol/Luna retornando, y aspectos principales
- [ ] Herramientas MCP incluidas: `returns`, `current_sky`
- [ ] Memoria configurada con working memory compartido
- [ ] `getToolsFor('returns-agent')` devuelve exactamente 2 tools con los IDs correctos
