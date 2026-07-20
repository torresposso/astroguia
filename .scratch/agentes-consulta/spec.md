- **GitHub**: [#5](https://github.com/torresposso/astroguia/issues/5)
- **Status**: listo-para-agente

## Problem Statement

Un astrólogo profesional necesita asistencia en tiempo real durante sus sesiones con personas. Actualmente el proyecto astroguia tiene un solo agente (`natalchart-agent`) que solo calcula cartas natales — insuficiente para una consulta completa que abarca cartas natales, tránsitos, sinastría, dashas/firdaria, progresiones, retornos solares/lunares y rectificación de hora de nacimiento. Cada herramienta astrológica se invoca manualmente, sin memoria compartida entre tipos de consulta, y sin persistencia de datos de personas entre sesiones.

## Solution

Un sistema de **7 agentes Mastra** (1 orquestador + 6 especialistas) que:

- Usa **caelus-mcp** como fuente de las 34 herramientas astrológicas, filtradas por dominio para cada agente especialista
- El **orquestador** gestiona personas, mantiene contexto de sesión vía working memory compartido, y deriva consultas al especialista correcto
- Cada **especialista** tiene herramientas enfocadas en su dominio e instrucciones precisas
- Los **datos de personas** se persisten en LibSQL (`persons.db`) con su historial de consultas
- La **memoria de trabajo** se comparte entre agentes usando `scope: resource` con `resourceId = personId`
- Todo corre en **Mastra Studio** (`mastra dev`), interfaz de chat

### Convenciones de idioma

- Código: inglés
- AGENTS.md: inglés
- System prompts de agentes: inglés
- Nombres de aspectos y signos: inglés
- Respuestas al astrólogo: español
- Specs, tickets, docs, triage: español

## User Stories

1. Como astrólogo, quiero cargar un perfil de persona con sus datos de nacimiento (fecha, hora, ciudad, sistema de casas), para no tener que reingresarlos en cada consulta.

2. Como astrólogo, quiero buscar una persona por nombre y recuperar sus datos de nacimiento, para retomar una consulta donde la dejé.

3. Como astrólogo, quiero listar todas mis personas, para elegir con quién trabajar en esta sesión.

4. Como astrólogo, quiero pedir la carta natal completa de una persona y recibir una interpretación detallada en español con posiciones planetarias, aspectos, patrones (stelliums, T-squares, grandes trígonos), dignidades, lots herméticos, nakshatras, vargas y yogas védicos, para tener un panorama astrológico completo.

5. Como astrólogo, quiero consultar los tránsitos actuales de una persona — planetas en tránsito sobre su carta natal, aspectos aplicando/separando, fechas exactas de aspectos futuros, y clima cósmico general — para orientar a la persona sobre el momento presente.

6. Como astrólogo, quiero comparar la carta de dos personas (sinastría) con aspectos inter-carta, house overlays en ambas direcciones, y cartas compuestas (midpoint y Davison), para analizar compatibilidad en relaciones.

7. Como astrólogo, quiero consultar los dashas védicos (Vimshottari, Yogini, Ashtottari), firdaria medieval, progresiones secundarias, direcciones primarias, profecciones anuales/mensuales y releasing zodiacal, para entender los períodos de vida activos.

8. Como astrólogo, quiero calcular la revolución solar y lunar de una persona para un período, para analizar el año o mes astrológico que comienza.

9. Como astrólogo, quiero rectificar la hora de nacimiento de una persona usando una grilla de ASC/MC sobre una ventana de horas y fechas de eventos de vida, para afinar cartas con hora desconocida o aproximada.

10. Como astrólogo, quiero que el sistema recuerde los datos de la persona actual durante toda la sesión sin que yo los repita, cambiando automáticamente de contexto cuando cambio de persona.

11. Como astrólogo, quiero que las respuestas de los agentes sean en español, con una explicación clara y educativa, destacando los hallazgos más relevantes de cada tipo de consulta.

12. Como astrólogo, quiero que el sistema mantenga un historial de consultas por persona (tipo, fecha, resumen), para saber qué temas ya se trataron en sesiones anteriores.

## Implementation Decisions

### Arquitectura de agentes

**7 agentes en total:**

1. **ConsultationAgent** (orquestador) — herramientas: `load_person`, `list_persons`, `save_person`. Sub-agentes: los 6 especialistas. Modelo: `opencode/hy3-free`. Sin herramientas de caelus-mcp. Recibe los mensajes del astrólogo, gestiona personas, carga datos en working memory, y deriva al especialista según el tipo de consulta.

2. **NatalAgent** (carta natal) — herramientas caelus-mcp: `natal_chart`, `chart_facts`, `chart_signature`, `aspect_patterns`, `dignities`, `lots`, `nakshatras`, `vargas`, `yogas` (9 tools). Modelo: `opencode/hy3-free`.

3. **TransitAgent** (tránsitos) — herramientas caelus-mcp: `transits`, `find_aspect_dates`, `current_sky`, `cosmic_weather`, `void_of_course`, `planetary_hours`, `sky_events` (7 tools). Modelo: `opencode/hy3-free`.

4. **SynastryAgent** (sinastría) — herramientas caelus-mcp: `synastry`, `composite` (2 tools). Modelo: `opencode/hy3-free`.

5. **TimelordAgent** (dashas, firdaria, progresiones) — herramientas caelus-mcp: `dasha`, `firdaria`, `progressions`, `directions`, `profections`, `releasing` (6 tools). Modelo: `opencode/hy3-free`.

6. **ReturnsAgent** (retornos solares/lunares) — herramientas caelus-mcp: `returns`, `current_sky` (2 tools). Modelo: `opencode/hy3-free`.

7. **RectificationAgent** (rectificación) — herramientas caelus-mcp: `rectification_grid`, `find_aspect_dates` (2 tools). Modelo: `opencode/hy3-free`.

### Integración con Caelus

Se usa **caelus-mcp** como servidor MCP vía stdio. Un solo `MCPClient` se conecta a `npx caelus-mcp`. Las 34 herramientas se filtran por agente usando una función `getToolsFor(agentId)` que devuelve solo el subconjunto correspondiente. Esto evita escribir wrappers manuales y aprovecha las descripciones, esquemas y manejo de edge cases que ya tiene caelus-mcp.

### Memoria compartida

Todos los agentes usan `Memory` con `LibSQLStore` y `workingMemory` habilitado con `scope: 'resource'`. El `resourceId` es el `personId`. Esto permite que:

- El orquestador cargue los datos de una persona en working memory
- Cualquier especialista al que se derive vea esos mismos datos sin necesidad de consultar la DB
- El working memory mantenga el template:

```
# Person
- **Name**:
- **Date**:
- **Time**:
- **City**:
- **Lat**:
- **Lon**:
- **Timezone**:
- **House system**:
```

### Almacenamiento de personas

Tabla `persons` en LibSQL separado (`persons.db`):

- `id` (TEXT PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `birth_date` (TEXT NOT NULL, YYYY-MM-DD)
- `birth_time` (TEXT NOT NULL, HH:MM)
- `birth_city` (TEXT NOT NULL)
- `birth_lat` (REAL NOT NULL)
- `birth_lon` (REAL NOT NULL)
- `timezone` (TEXT NOT NULL)
- `house_system` (TEXT DEFAULT 'placidus')
- `notes` (TEXT DEFAULT '')
- `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP)

Tabla `consultations`:

- `id` (TEXT PRIMARY KEY)
- `person_id` (TEXT NOT NULL REFERENCES persons(id))
- `type` (TEXT NOT NULL: natal|transit|synastry|timelord|returns|rectification)
- `thread_id` (TEXT)
- `date` (TEXT DEFAULT CURRENT_TIMESTAMP)
- `summary` (TEXT DEFAULT '')

### Herramientas de persona

Tres herramientas custom con `createTool`:

- `load_person` — busca persona por nombre o id, carga sus datos en working memory. Input: `{ name?: string, id?: string }`.
- `list_persons` — lista todas las personas. Sin input.
- `save_person` — crea o actualiza una persona. Input: `{ id?: string, name, birth_date, birth_time, birth_city, birth_lat, birth_lon, timezone, house_system?, notes? }`.

Estas herramientas solo las tiene el **ConsultationAgent**.

### Modelos

Todos los agentes usan `opencode/hy3-free`. En el futuro, si se detecta latencia en el orquestador, se puede cambiar solo ese agente a un modelo más rápido sin afectar a los especialistas.

## Testing Decisions

### Qué hace un buen test

- Probar comportamiento externo (funciones exportadas), no implementación interna
- Cada test debe ser independiente y no requerir LLM, MCP, ni Mastra corriendo
- Usar SQLite en memoria (`:memory:`) para tests de storage

### Seams a testear

1. **PersonRepository** — CRUD sobre `persons.db`: insertar, buscar por nombre/id, listar, actualizar. Se testea con SQLite `:memory:` y vitest.

2. **`getToolsFor(agentId)`** — la función que filtra las 34 herramientas de caelus-mcp por agente. Se testea que NatalAgent recibe 9 tools, TransitAgent recibe 7, etc., y que los IDs de herramientas son los correctos.

3. **Registro de agentes en Mastra** — se instancia `new Mastra({ agents: { consultationAgent } })` y se verifica que `mastra.getAgent('consultation-agent')` existe y sus sub-agentes están configurados.

### Prior art

El proyecto no tiene tests actualmente. Se establecerá el patrón con esta spec.

### Evals (fuera de esta spec)

El comportamiento de los agentes con LLM + caelus-mcp (respuestas en español, uso correcto de herramientas, no alucinaciones) se evaluará en una spec futura usando `runEvals` de `@mastra/core/evals` con scorers de prompt alignment.

## Out of Scope

- Interfaz de usuario más allá de Mastra Studio
- Autenticación, multi-usuario, roles
- Despliegue en producción (Mastra Cloud, Vercel, etc.)
- Evals automatizadas de calidad de respuestas
- Agentes para astrología electiva (`electional_search`)
- Agentes para astrocartografía
- Visualización de cartas (ruedas astrológicas, gráficos)
- Corpus de interpretaciones astrológicas
- Exportación de reportes (PDF, etc.)

## Further Notes

- El código existente en `src/mastra/agents/natalchart-agent.ts` y `src/mastra/tools/compute-natal-chart.ts` y `src/mastra/tools/geocode-city.ts` será reemplazado — caelus-mcp maneja todo el cómputo.
- El `index.ts` actual se actualizará para registrar el `consultationAgent` en lugar del `natalchartAgent`.
- `caelus-mcp` ya está instalado (`package.json`) pero no se usa actualmente.
- Las instrucciones de cada agente especialista deben ser en inglés, precisas, y especificar exactamente qué herramientas tiene disponibles y cómo usarlas.
- Las respuestas al astrólogo deben ser siempre en español y basadas únicamente en datos devueltos por las herramientas (no alucinar).
