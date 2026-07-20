# 04 — Limpiar agentes especialistas viejos

**What to build:** Eliminar toda la arquitectura anterior de 6 agentes especialistas + factory, ya que ahora solo existe el orquestador. Esto incluye archivos, referencias y documentación obsoleta.

- **GitHub**: [#17](https://github.com/torresposso/astroguia/issues/17)

**Blocked by:** [#15](https://github.com/torresposso/astroguia/issues/15) (orquestador chat-mode) — el nuevo orquestador debe estar funcionando antes de eliminar los agentes viejos.

**Status:** ready-for-agent

- [ ] Eliminar `src/mastra/agents/natal-agent.ts`
- [ ] Eliminar `src/mastra/agents/transit-agent.ts`
- [ ] Eliminar `src/mastra/agents/synastry-agent.ts`
- [ ] Eliminar `src/mastra/agents/timelord-agent.ts`
- [ ] Eliminar `src/mastra/agents/returns-agent.ts`
- [ ] Eliminar `src/mastra/agents/rectification-agent.ts`
- [ ] Eliminar `src/mastra/agents/factory.ts` (createSpecialistAgent ya no se usa)
- [ ] Actualizar `src/mastra/index.ts` para que solo registre el nuevo orquestador
- [ ] Actualizar `AGENTS.md` — reemplazar la sección "1 orchestrator + 6 specialists" con la nueva arquitectura
- [ ] Marcar ADR-0002 (6 specialists) como obsoleto o eliminarlo
- [ ] Verificar que `npm run build` y `npm test` pasan sin los archivos eliminados
