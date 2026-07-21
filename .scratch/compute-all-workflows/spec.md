- **GitHub**: [#18](https://github.com/torresposso/astroguia/issues/18)
- **Status**: listo-para-agente

## Problem Statement

Actualmente cada vez que un astrólogo consulta la carta natal, dashas, firdaria o direcciones de una persona, el sistema delega al agente especialista correspondiente, que a su vez llama a caelus-mcp para obtener los datos. Para datos astrológicos que no dependen de una fecha objetivo, caelus se invoca repetidamente devolviendo siempre los mismos resultados, desperdiciando tiempo y tokens de LLM.

Además, no hay un mecanismo centralizado que dispare el cómputo de estos datos estáticos cuando se crea o actualiza una persona. El astrólogo debe pedir explícitamente cada tipo de consulta.

## Solution

Un workflow de cómputo batch (**computeAllCharts**) que, al crear o actualizar una persona, ejecuta `chart_facts` + 4 tools de timing (dasha, firdaria, directions, releasing) de caelus-mcp y persiste los resultados en una columna JSON `chart_data` dentro de `persons.db`. Una vez computados, ningún agente necesita volver a llamar caelus para estos datos — el orquestador los lee directamente de `chart_data` usando la tool `loadChartData`.

`chart_facts` reemplaza 9 tools natales individuales (natal_chart, chart_signature, aspect_patterns, dignities, lots, nakshatras, vargas, yogas) en una sola llamada que ya incluye atoms rankeados + brief listo para LLM.

## User Stories

1. Como astrólogo, quiero que al crear una persona el sistema calcule automáticamente toda su carta natal y líneas de tiempo estáticas (dashas, firdaria, direcciones, releasing), para no tener que pedir cada cosa por separado.

2. Como astrólogo, quiero que al actualizar los datos de nacimiento de una persona el sistema invalide el chart_data existente y lo recalcule, para asegurar que siempre trabajo con datos correctos.

3. Como astrólogo, quiero que el orquestador responda mis preguntas natales y de timing directamente desde chart_data sin llamar a caelus, para obtener respuestas más rápidas.

4. Como astrólogo, quiero que si una herramienta de caelus falla durante el cómputo, las demás se sigan calculando sin abortar todo el proceso.

5. Como astrólogo, quiero que si caelus-mcp no está disponible al crear una persona, el sistema me lo notifique con un error claro en lugar de crear la persona sin datos.

6. Como desarrollador, quiero que chart_data tenga una key por tool computada (chart_facts, dasha, firdaria, directions, releasing) para acceder a resultados específicos sin parsear todo el JSON.

## Implementation Decisions

### Schema de chart_data en persons.db

Se agregan dos columnas a la tabla `persons`:

- `chart_data` (TEXT) — JSON object. Cada key es un toolId de caelus y cada value es el resultado de esa tool (también JSON). Las keys son: `chart_facts`, `dasha`, `firdaria`, `directions`, `releasing`.
- `computed_at` (TEXT) — timestamp ISO 8601 del momento en que se ejecutó computeAllCharts.

Estructura del JSON:

```json
{
  "chart_facts": { ... },
  "dasha": { ... },
  "firdaria": { ... },
  "directions": { ... },
  "releasing": { ... }
}
```

`chart_facts` reemplaza las tools: natal_chart, chart_signature, aspect_patterns, dignities, lots, nakshatras, vargas, yogas — todas están embebidas en su resultado, que incluye atoms rankeados y un brief listo para LLM.

¿Por qué JSON column en vez de tabla separada? chart_data es siempre 1:1 con la persona, se carga y guarda completo. 5 keys es un tamaño manejable.

### PersonRepository — métodos nuevos

Se agregan al `PersonRepository`:

- `saveChartData(personId: string, results: Record<string, unknown>): Promise<void>` — guarda `chart_data` (serializado) y actualiza `computed_at` en la fila de la persona.
- `loadChartData(personId: string): Promise<Record<string, unknown> | null>` — lee y deserializa `chart_data`. Retorna null si no hay datos.
- `invalidateChartData(personId: string): Promise<void>` — limpia `chart_data` y `computed_at`. Se llama automáticamente en `update()` cuando cambia algún campo de nacimiento.

La interface `Person` se actualiza con las propiedades `chart_data?: string` y `computed_at?: string`.

### Workflow computeAllCharts

Workflow registrado en Mastra con 3 Steps:

1. **validate** — recibe `personId`, carga la persona desde PersonRepository. Si no existe, aborta con error.
2. **compute** — ejecuta en paralelo (con `Promise.allSettled`) las 5 tools de caelus-mcp:
   - `chart_facts` (recibe birth data de la persona, incluye Védico)
   - `dasha` (Vimshottari default, timeline completa)
   - `firdaria`
   - `directions` (max_years: 120)
   - `releasing` (horizon_years: 100)
3. **store** — para cada tool con éxito, incluye su resultado en `results`. Para las que fallaron, registra `{ error: mensaje }`. Guarda todo vía `saveChartData()`. Si caelus-mcp no responde (error de conexión en todas las tools), no guarda nada y lanza error claro.

### Tool loadChartData

Tool del orquestador que lee chart_data y extrae la key correspondiente:

```
loadChartData(personId, toolName)
```

- `personId`: string — ID de la persona
- `toolName`: enum — `"chart_facts" | "dasha" | "firdaria" | "directions" | "releasing"`
- Devuelve el JSON crudo de esa tool, o null si no existe.

### Integración con savePerson

`savePerson` dispara `computeAllCharts` después de crear/actualizar la persona. Es síncrono: el usuario espera a que termine. Si computeAllCharts falla (caelus caído), `savePerson` lanza error y la persona no se crea sin datos.

### Invalidación de chart_data

`invalidateChartData()` se llama en `PersonRepository.update()` si cambió: `birth_date`, `birth_time`, `birth_city`, `birth_lat`, `birth_lon`, `timezone`, `house_system`.

Después de invalidar, `savePerson` dispara `computeAllCharts` que recalcula todo automáticamente.

### Eliminación de agentes viejos

Se eliminan en T1:
- `src/mastra/agents/natal-agent.ts`
- `src/mastra/agents/factory.ts`
- Las tools estáticas del timelord-agent (dasha, firdaria, directions, releasing) se quitan de su toolset. timelord-agent se queda con 2 tools: progressions, profections.

### ADR-0004

Se crea ADR-0004 documentando el cambio: de especialistas con tools de caelus a chart_data persistente + orquestador con loadChartData. Los especialistas restantes (transit, synastry, returns, rectification, timelord recortado) solo existen para consultas que requieren fecha objetivo.

## Testing Decisions

### Qué hace un buen test

- Probar comportamiento externo: que el workflow llama a las tools correctas, que chart_data persiste y se recupera, que la invalidación funciona.
- Usar SQLite en memoria para tests de repository.
- No requiere LLM ni MCP real — mockear MCPClient.

### Seams a testear

1. **PersonRepository** — `saveChartData`/`loadChartData`/`invalidateChartData` sobre SQLite `:memory:`. Verificar que persiste, recupera, se invalida, y que `loadChartData()` retorna `null` si no hay datos.

2. **computeAllCharts workflow** — con MCPClient mockeado:
   - Verificar que llama las 5 tools correctas
   - Fallos parciales: mock que falla en 2 tools, verificar que las 3 exitosas se guardan con error en las 2 fallidas
   - Error de conexión: mock que lanza error de conexión, verificar que no guarda nada y lanza error claro

### Prior art

- `src/mastra/__tests__/persons.test.ts` — tests de CRUD de PersonRepository con SQLite `:memory:`. Los tests de chart_data siguen el mismo patrón.
- `src/mastra/__tests__/mcp.test.ts` — tests de filtrado con mock. Los tests del workflow usan mock similar de MCPClient.

## Out of Scope

- Compute de datos que dependen de fecha objetivo (transits, progressions, profections, returns, synastry) — serán cubiertos en tickets futuros (workflows bajo demanda).
- Interfaz de usuario para ver chart_data o forzar recálculo.
- Cache distribuido o persistencia alternativa a SQLite.
- El orquestador chat-mode (T2) que responde desde chart_data sin delegar — se implementa después de este ticket.
- Compresión del JSON de chart_data.

## Further Notes

- `chart_facts` de caelus-mcp ya incluye un `brief` listo para LLM con atoms rankeados y citables.
- Védico (nakshatras, vargas, yogas, dasha) se computa junto con Occidental en chart_facts + dasha. La presentación separada se maneja a nivel de orquestador.
- La investigación de consultas reales mostró que los astrólogos trabajan con sesiones enfocadas (1-3 técnicas, ~60 min). chart_data optimiza para esto: datos natales + timing precomputados, el resto bajo demanda.
- El naming sigue las convenciones del proyecto: DB columns en snake_case, tools/methods en camelCase, toolNames consistente con los toolId de caelus-mcp.
