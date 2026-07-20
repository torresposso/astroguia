# 03 — Workflows bajo demanda (transits, profections, progressions, returns, sinastría)

**What to build:** Workflows independientes que toman datos de persona (desde el cache de T1) más una fecha objetivo y llaman a caelus para obtener resultados que dependen de tiempo. Incluye: transits, profections, progressions, returns (solar/lunar), cosmic_weather, current_sky, sky_events. También el workflow de sinastría/composite que requiere 2 personas.

**Blocked by:** 01 (compute-all) — necesita natal chart cacheado para calcular transits/progressions/returns contra la carta natal. Sinastría necesita ambas cartas natales cacheadas.

**Status:** ready-for-agent

- [ ] Crear `src/mastra/workflows/transits.ts` — toma `personId` + `targetDate`, carga natal cacheado, llama `caelus_transits` y devuelve resultado
- [ ] Crear `src/mastra/workflows/profections.ts` — toma `personId` + `targetDate`, llama `caelus_profections`
- [ ] Crear `src/mastra/workflows/progressions.ts` — toma `personId` + `targetDate`, llama `caelus_progressions`
- [ ] Crear `src/mastra/workflows/returns.ts` — toma `personId` + `searchStart` + `searchEnd` + `body` (sun/moon), llama `caelus_returns`
- [ ] Crear `src/mastra/workflows/cosmic-weather.ts` — toma `date`, llama `caelus_cosmic_weather` (no necesita persona)
- [ ] Crear `src/mastra/workflows/synastry.ts` — toma `personIdA` + `personIdB`, carga ambas natales del cache, llama `caelus_synastry` y `caelus_composite`
- [ ] Cada workflow puede opcionalmente cachear su resultado en `cached_results` si tiene sentido (ej: synastry entre mismas 2 personas no cambia)
- [ ] Integrar con el orquestador (T2): cuando el usuario pide un dato con fecha, el orquestador delega al workflow correspondiente
