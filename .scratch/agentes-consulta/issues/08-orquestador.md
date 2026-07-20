# 08 — Orquestador: ConsultationAgent + ensamble final

- **GitHub**: [#13](https://github.com/torresposso/astroguia/issues/13)

**What to build:** El orquestador que une los 6 agentes especialistas en un sistema multi-agente. El ConsultationAgent recibe los mensajes del astrólogo, gestiona personas con las 3 herramientas de persona, mantiene el working memory con los datos de la persona actual, y deriva consultas al especialista correcto usando el patrón de agent network de Mastra. También se actualiza `index.ts` para registrar el orquestador y se elimina el código viejo.

**Blocked by:** 02-natal-agent, 03-transit-agent, 04-synastry-agent, 05-timelord-agent, 06-returns-agent, 07-rectification-agent

**Status:** listo-para-agente

- [ ] Crear `src/mastra/agents/consultation-agent.ts`: instancia `Agent` con `id: 'consultation-agent'`, modelo `opencode/hy3-free`, tools `{ loadPerson, listPersons, savePerson }`, sub-agents `{ natalAgent, transitAgent, synastryAgent, timelordAgent, returnsAgent, rectificationAgent }`
- [ ] Instrucciones en inglés: rol de orquestador de consultas astrológicas, no tiene herramientas astrológicas propias, su función es: (1) gestionar personas con las 3 tools de persona, (2) cargar datos de la persona en working memory al seleccionar una persona, (3) derivar preguntas astrológicas al especialista correcto según el tipo de consulta, (4) pasar los datos de la persona en el mensaje de delegación. Descripción clara de qué agente usar para cada tipo de consulta
- [ ] Cada sub-agente declarado con `description` para que el orquestador sepa cuándo delegar
- [ ] Memoria configurada con working memory compartido, mismo template, `scope: 'resource'`
- [ ] Actualizar `src/mastra/index.ts`: importar y registrar `consultationAgent` en lugar de `natalchartAgent`, mantener storage y observability existentes
- [ ] Eliminar archivos obsoletos: `src/mastra/agents/natalchart-agent.ts`, `src/mastra/tools/compute-natal-chart.ts`, `src/mastra/tools/geocode-city.ts`
- [ ] `mastra dev` inicia sin errores y muestra `consultation-agent` como agente disponible
- [ ] Verificar que `mastra.getAgent('consultation-agent')` existe y tiene 6 sub-agentes
