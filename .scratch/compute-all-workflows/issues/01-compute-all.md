# 01 — Compute-all: cachear resultados estáticos de caelus

**What to build:** Al crear o actualizar una persona, un workflow ejecuta en batch todas las tools de caelus que no dependen de fecha objetivo y guarda los resultados en `persons.db`. Esto incluye tanto datos natales estáticos (natal chart, facts, signature, patterns, dignities, lots, nakshatras, vargas, yogas) como líneas de tiempo completas basadas en edad (dasha, firdaria, directions, releasing — hasta ~120 años desde nacimiento). Una vez cacheados, ningún workflow futuro necesita volver a llamar caelus para estos datos.

- **GitHub**: [#14](https://github.com/torresposso/astroguia/issues/14)

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Agregar columnas `cached_results` (TEXT JSON) y `computed_at` (TEXT) a la tabla `persons` en `persons.db`. El JSON almacena un objeto `{ natal_chart: {...}, chart_facts: [...], dasha: {...}, ... }` con cada resultado de tool.
- [ ] Agregar en `PersonRepository` un método `saveCache(personId, results)` y `loadCache(personId): CachedResults`. Opcionalmente un flag `hasValidCache(personId)` para saber si necesita recálculo.
- [ ] Crear `src/mastra/workflows/compute-all.ts` — un workflow que:
  - Toma un `personId`
  - Carga los datos de la persona desde `PersonRepository`
  - Llama caelus vía MCPClient para: `natal_chart`, `chart_facts`, `chart_signature`, `aspect_patterns`, `dignities`, `lots`, `nakshatras`, `vargas`, `yogas`, `dasha` (vimshottari default, timeline completa), `firdaria`, `directions` (max_years: 120), `releasing` (horizon_years: 100)
  - Almacena cada resultado en `cached_results` con su `computed_at`
  - Maneja fallos parciales: si una tool falla, registra el error pero no aborta las demás
- [ ] El schema del cache debe permitir invalidación: si se actualizan datos de nacimiento de la persona, `hasValidCache` retorna `false` hasta que se re-ejecute compute-all
- [ ] Tests: verificar que el workflow llama a las tools correctas, que `saveCache`/`loadCache` persiste y recupera correctamente, que la invalidación funciona
