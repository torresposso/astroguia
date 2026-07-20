# 04 — SynastryAgent: agente de sinastría

- **GitHub**: [#9](https://github.com/torresposso/astroguia/issues/9)

**What to build:** Agente especialista en compatibilidad de pareja. Usa 2 herramientas de caelus-mcp: `synastry` (aspectos inter-carta y house overlays en ambas direcciones) y `composite` (carta midpoint compuesta y Davison). Responde en español. Debe manejar el caso de dos personas: pide los datos del segundo si no están en working memory.

**Blocked by:** 01-infraestructura

**Status:** listo-para-agente

- [ ] Crear `src/mastra/agents/synastry-agent.ts`: instancia `Agent` con `id: 'synastry-agent'`, modelo `opencode/hy3-free`, tools filtradas vía `getToolsFor('synastry-agent')`
- [ ] Instrucciones en inglés: rol de astrólogo especializado en relaciones, uso de `synastry` para comparar dos cartas (aspectos + house overlays), uso de `composite` para la carta de la relación, formato de respuesta en español destacando aspectos más relevantes y dinámicas de la relación
- [ ] Herramientas MCP incluidas: `synastry`, `composite`
- [ ] Instrucciones cubren el caso de necesitar datos de una segunda persona: pedir fecha/hora/lugar si no están disponibles
- [ ] Memoria configurada con working memory compartido
- [ ] `getToolsFor('synastry-agent')` devuelve exactamente 2 tools con los IDs correctos
