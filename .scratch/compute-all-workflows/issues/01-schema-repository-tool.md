# 01 — Schema, repository y tool loadChartData

- **GitHub**: [#19](https://github.com/torresposso/astroguia/issues/19)

**What to build:** Agregar las columnas `chart_data` y `computed_at` a la tabla `persons` en SQLite, los métodos `saveChartData`/`loadChartData`/`invalidateChartData` en `PersonRepository`, la invalidación automática en `update()`, y la tool `loadChartData(personId, toolName)` en el orquestador.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Agregar columnas `chart_data` (TEXT) y `computed_at` (TEXT) al CREATE TABLE en `PersonRepository.init()`
- [ ] Agregar propiedades `chart_data?: string` y `computed_at?: string` a la interface `Person`
- [ ] Implementar `saveChartData(personId, results)` — serializa y guarda el JSON, actualiza `computed_at`
- [ ] Implementar `loadChartData(personId)` — deserializa y retorna el JSON, o null si no existe
- [ ] Implementar `invalidateChartData(personId)` — limpia `chart_data` y `computed_at`
- [ ] Integrar `invalidateChartData()` en `update()` cuando cambien: birth_date, birth_time, birth_city, birth_lat, birth_lon, timezone, house_system
- [ ] Crear tool `loadChartData` para el consultation-agent: input `(personId, toolName)` con toolName enum `chart_facts|dasha|firdaria|directions|releasing`, devuelve JSON crudo de esa key o null
- [ ] Tests: `saveChartData`/`loadChartData`/`invalidateChartData` con SQLite `:memory:` — persistencia, null si no hay datos, invalidación al actualizar birth_date
