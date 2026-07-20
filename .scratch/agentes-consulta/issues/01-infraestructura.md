# 01 — Infraestructura: MCP, personas, y herramientas base

- **GitHub**: [#6](https://github.com/torresposso/astroguia/issues/6)

**What to build:** La capa de infraestructura que todos los agentes necesitan. Tres componentes: (1) cliente MCP a caelus-mcp con filtrado de herramientas por agente, (2) repositorio de personas con esquema de base de datos LibSQL, (3) tres herramientas custom para gestionar personas. Todo con tests unitarios.

**Blocked by:** None — can start immediately.

**Status:** listo-para-agente

- [ ] Instalar `@mastra/mcp` (`bun add @mastra/mcp`)
- [ ] Crear `src/mastra/mcp/caelus.ts`: instancia `MCPClient` conectada a `npx caelus-mcp`, función `getToolsFor(agentId)` que filtra las 34 tools de caelus-mcp por agente, y constante `AGENT_TOOLS` con el mapping de tool names a agentes
- [ ] Crear `src/mastra/storage/persons.ts`: clase `PersonRepository` con conexión LibSQL a `file:./persons.db`, schema de tablas `persons` y `consultations`, métodos CRUD: `create`, `findById`, `findByName`, `list`, `update`, `saveConsultation`
- [ ] Crear `src/mastra/tools/load-person.ts`: `createTool` que busca persona por nombre o id, devuelve datos completos
- [ ] Crear `src/mastra/tools/list-persons.ts`: `createTool` que lista todos las personas
- [ ] Crear `src/mastra/tools/save-person.ts`: `createTool` que crea o actualiza una persona
- [ ] Crear `src/mastra/memory/template.ts`: constante exportada con el template de working memory compartido para todos los agentes
- [ ] Tests unitarios para `PersonRepository` (CRUD con SQLite `:memory:`)
- [ ] Tests unitarios para `getToolsFor` (verifica cantidad y nombres de tools por agente)
- [ ] `mastra dev` inicia sin errores con los nuevos archivos (sin registrar agentes todavía)
