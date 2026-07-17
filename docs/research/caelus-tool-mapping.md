# Caelus MCP Tool Mapping to Evolutionary Factors

> Research for GitHub issue #2 — torresposso/astroguia
> Based on Caelus v0.23.0 (34 MCP tools), docs at ephemengine.com, MCP_SPEC.md, and interpretation layer docs.

## Executive Summary

Caelus MCP exposes 34 tools over stdio and Streamable HTTP. For evolutionary astrology, **`chart_facts`** is the canonical tool: it returns ranked, citable fact atoms (placements, aspects, patterns, dignities, dispositors, fixed stars, lots) plus a ready-to-interpret `brief`. With the optional `target_date` parameter, it adds **transits and time-lords** (profections, firdaria, dashas) in a single call. The model writes the interpretation in original prose and cites each fact's `[id]` — it never recalculates (or hallucinates) positions.

For factors requiring specialized calculations (aspect patterns such as T-squares/yods, firdaria periods, profections, detailed transits, dignities, lunar phase), dedicated tools exist that return more granular structured data.

---

## Mapping Table

| # | Evolutionary Factor | Caelus Tool(s) | Key Parameters | Response Fields to Use | Notes |
|---|---|---|---|---|---|
| 1 | **Pluto** — sign, house, aspects | `chart_facts` (recommended) or `natal_chart` | `date`, `lat`, `lon`, `house_system?` | `chart_facts`: atoms `placement:pluto` (sign, house, retrograde), `aspect:pluto~*:*` (aspects to Pluto). `natal_chart`: `bodies.pluto.{sign, signDeg, house, rx, lon}`, `aspects[]` filtering `a === "pluto"` or `b === "pluto"` | `chart_facts` also includes Pluto dignities and reception/dispositor atoms. The soul's evolutionary intent is read in the sign, house, and hard aspects to Pluto. |
| 2 | **North Node / South Node** — signs, houses, rulers, aspects | `chart_facts` or `natal_chart` | `date`, `lat`, `lon`, `house_system?` | `chart_facts`: atoms `placement:mean_node` / `placement:true_node` (sign, house), `aspect:mean_node~*:*`, `dispositor:mean_node:*` (ruler). `natal_chart`: `bodies.mean_node.{sign, house, lon}`, `bodies.true_node.{sign, house, lon}` | Both nodes (mean_node and true_node) are included in every chart. For the node ruler: use the `dispositor` atom in `chart_facts`, or compute from the node's sign with `SIGN_RULERS`. The purpose axis is nodal by definition. |
| 3 | **Saturn** — sign, house, aspects | `chart_facts` or `natal_chart` | `date`, `lat`, `lon`, `house_system?` | `chart_facts`: atoms `placement:saturn` (sign, house, rx), `aspect:saturn~*:*`, `dignity:saturn:*`. `natal_chart`: `bodies.saturn.{sign, house, rx, lon}`, aspects filtering Saturn | Retrograde Saturn is particularly relevant in evolution (karmic review). `chart_facts` gives the `retrograde` flag in the placement and adds essential dignity. |
| 4 | **Tense aspects** — squares, oppositions, T-squares, yods, etc. | `aspect_patterns` or `chart_facts` | `date`, `lat`, `lon`, `house_system?` | `aspect_patterns`: `patterns[]` with `kind` (`t_square`, `grand_cross`, `yod`, `kite`, `mystic_rectangle`, `stellium_sign`, `stellium_house`), `bodies[]`, `apex` (for T-square/yod). `chart_facts`: atoms `pattern:t_square:*`, `pattern:yod:*`, and individual atoms `aspect:*:square`, `aspect:*:opposition` | `aspect_patterns` returns patterns as maximal structured objects (no duplicates). `chart_facts` includes them as ranked atoms with higher salience. Both include orbs. Individual aspects in `chart_facts` carry `phase` (applying/separating) and normalized `strength`. |
| 5 | **Houses 4, 8, 12 and their rulers** — unconscious patterns | `chart_facts` or `natal_chart` | `date`, `lat`, `lon`, `house_system?` | `chart_facts`: atoms `placement:*` filtering `house` ∈ {4, 8, 12}; `dispositor:*:*` for the ruler of each planet in those houses; `angle:ic` (house 4 cusp). `natal_chart`: `cusps[3]` (house 4), `cusps[7]` (house 8), `cusps[11]` (house 12); `bodies` filtering by `house` | The house 4 cusp is the `IC` (`angles.ic`). Rulers are obtained from `dispositor` atoms which trace the domicile chain. Also useful: `chart_signature` to see quadrant/hemisphere emphasis (water houses = 4/8/12). |
| 6 | **Firdaria** — planetary periods | `firdaria` | `date`, `lat`, `lon`, `target_date?` | `timeline[]` (array of 9 major periods, each with `lord`, `start`, `end`, `subs[]`). If `target_date` is passed: `active.major` (active major lord), `active.sub` (active sub-period) | Without `target_date` it returns the full 75-year timeline. With `target_date`, it returns only the active period. The sect (diurnal/nocturnal) is determined from the natal chart: day starts with the Sun, night with the Moon. Purely arithmetic tool — no zodiac required. |
| 7 | **Profections** — lord of the year | `profections` | `date`, `lat`, `lon`, `target_date` | `age_years`, `annual.{house, sign, lord}`, `monthly.{house, sign, lord}` | Requires exact birth date with time and place (needs the Ascendant). Advances one whole sign per year of life. The `lord` is the traditional ruler of the profected sign. The monthly profection advances one additional sign per twelfth of the year. |
| 8 | **Current transits** over key evolutionary points | `transits` or `chart_facts` with `target_date` | `transits`: `date`, `lat`, `lon`, `transit_date?`, `orb?`. `chart_facts`: `date`, `lat`, `lon`, `target_date="2026-07-17T..."` | `transits`: `natal` (natal chart), `transits` (transiting planet positions), `aspects[]` with `{t, n, aspect, orb, applying}`. `chart_facts`: atoms `transit:saturn~natal_pluto:square`, `transit:uranus~natal_moon:conjunction`, etc. | `chart_facts` with `target_date` is superior: it adds transits + time-lords + phase/strength in a single call. For reverse lookup ("when does Saturn square my natal Moon"), use `find_aspect_dates`. For transits over houses 4/8/12: `transits` shows which natal house each transiting planet falls in. |
| 9 | **Essential dignities** | `dignities` or `chart_facts` | `dignities`: `date`, `lat`, `lon`. `chart_facts`: `date`, `lat`, `lon` | `dignities`: per traditional planet (7): `sign`, `dignities[]` (domicile, exaltation, detriment, fall), `planetarySect`, `inSect`. `chart_facts`: atoms `dignity:*:domicile`, `dignity:*:exaltation`, plus `term:`, `face:`, `triplicity:`, `almuten:` via enrichment | `dignities` only covers the 7 traditional planets with qualitative dignities. `chart_facts` additionally includes Egyptian terms, faces/decanates, Dorothean triplicities, and the degree almuten — all available when using `enrichContextOptions` (which `chart_facts` applies automatically). |
| 10 | **Natal lunar phase** | `sky_events` (for the nearest phase event) or `natal_chart` (for Sun-Moon angle) | `sky_events`: `start`, `end`, `kinds=["lunar_phase"]`. `natal_chart`: `date`, `lat`, `lon` | `sky_events`: `events[]` with `kind: "lunar_phase"`, `phase` ("new", "first_quarter", "full", "last_quarter") and exact timestamp. `natal_chart`: `bodies.sun.lon` and `bodies.moon.lon` → compute angle to determine phase | The most direct way: look up the `lunar_phase` event immediately preceding birth with `sky_events`. The phase is inferred from which phase preceded birth. For the exact angle, use Sun and Moon longitudes from `natal_chart` and compute `(moonLon - sunLon + 360) % 360`. |

---

## Relevant complementary tools

| Tool | Use in evolutionary astrology |
|---|---|
| `chart_signature` | Elemental, modal, quadrant, and hemisphere distribution. The `chartRuler` (Ascendant ruler) and dominant sign/planet. Useful for general context of the psychic structure. |
| `synastry` | For comparing two charts (e.g. client and therapist). Returns `synastry:*`, `composite:*` atoms and `brief`. |
| `returns` | Solar return (`body: "sun"`) and lunar return (`body: "moon"`). The solar return is key in evolution to see the annual climate. `return_lat`/`return_lon` allow calculating the chart at another location. |
| `progressions` | Secondary progressions (day-for-a-year) and solar arc directions. Show the evolutionary development of each planet. |
| `releasing` | Aphesis / Zodiacal Releasing from Lot of Spirit or Fortune. Hellenistic time periods with 4 depth levels. Complements firdaria. |
| `directions` | Primary directions to the angles (and optionally between planets). Traditional predictive method. |
| `find_aspect_dates` | Exact dates of transit aspects (with re-hit from retrogradation). For planning key moments. |
| `cosmic_weather` | Active configurations of the day without needing a natal chart. For mundane context. |
| `counterfactual_chart` | Perturbed chart: change time, place, or longitudes. For exploring "what if". |

---

## Anatomy of the `chart_facts` response

`chart_facts` is the recommended integrating tool for evolutionary interpretation. Its response includes:

```
{
  "atoms": [
    { "id": "placement:pluto", "kind": "placement", "bodies": ["pluto"],
      "salience": 4.2, "text": "Pluto in Scorpio, house 8, retrograde",
      "sign": "Scorpio", "house": 8, "retrograde": true, "dignities": [] },
    { "id": "aspect:pluto~saturn:square", "kind": "aspect",
      "bodies": ["pluto", "saturn"],
      "salience": 3.8, "text": "Pluto square Saturn (applying, orb 2.1°)",
      "aspect": "square", "orb": 2.1, "phase": "applying", "strength": 0.65 },
    { "id": "pattern:t_square:mars-moon-saturn", "kind": "pattern",
      "bodies": ["mars", "moon", "saturn"],
      "salience": 4.0, "text": "T-square: Mars, Moon, Saturn (apex Saturn)",
      "pattern": "t_square", "apex": "saturn" },
    { "id": "dispositor:pluto:mars", "kind": "dispositor",
      "bodies": ["pluto", "mars"],
      "salience": 2.0, "text": "Pluto in Scorpio, dispositor Mars" },
    // Con target_date:
    { "id": "transit:saturn~natal_pluto:square", "kind": "transit",
      "bodies": ["saturn", "pluto"],
      "salience": 3.5, "text": "Transit Saturn square natal Pluto (applying, orb 1.2°)" },
    { "id": "profection:year:scorpio:mars", "kind": "timelord",
      "salience": 3.0, "text": "Annual profection: Scorpio, lord Mars" },
    { "id": "firdaria:moon:sun", "kind": "timelord",
      "salience": 2.5, "text": "Firdaria: Moon major, Sun sub-period" }
  ],
  "brief": {
    "prompt": "Natal chart facts follow, each with a stable id in [brackets]...",
    "facts": [ /* ranked BriefFacts */ ]
  }
}
```

Notes on `chart_facts`:
- Atoms are sorted by `salience` (prominence), highest first.
- `salience` automatically weights: luminaries, angularity, hard aspects, patterns, dignities, active transits, and time-lords.
- With `target_date`, `transit`, `timelord` (profection/firdaria/ZR/dasha) atoms are added.
- With sidereal zodiac + `include_vedic`: `nakshatra`, `varga` (D9), `yoga` atoms are added.
- The `brief.prompt` is ready to send to the LLM with citation instructions.

---

## Recommended flow for an evolutionary reading

```
1. chart_facts(date, lat, lon, target_date="hoy", house_system="placidus")
   → base atoms (placements, aspects, patterns, dignities, dispositors, lots)

2. aspect_patterns(date, lat, lon)  [si se necesita detalle estructural de patrones]
   → T-squares, yods, grand crosses como objetos maximales

3. firdaria(date, lat, lon, target_date)
   → active planetary period

4. profections(date, lat, lon, target_date="hoy")
   → lord of the year and month

5. transits(date, lat, lon, transit_date="hoy", orb=3)
   → detailed transit aspects with applying/separating phase

6. dignities(date, lat, lon)
   → dignidades cualitativas de los 7 planetas tradicionales

7. returns(date, lat, lon, body="sun", ...)  [opcional]
   → solar return of the year
```

Simplified alternative: **just `chart_facts` with `target_date`** covers steps 1-5 in a single call.

---

## Sources consulted

- [Caelus llms.txt](https://www.ephemengine.com/llms.txt) — lista completa de 34 tools
- [MCP Setup docs](https://www.ephemengine.com/docs/mcp) — tool descriptions, configuration, example response
- [Interpretation Layer docs](https://www.ephemengine.com/docs/interpretation) — `chart_facts`, `interpretationContext`, `enrichContextOptions`, atoms, selectors, `chartBrief`
- [MCP_SPEC.md](https://github.com/heavyblotto/caelus/blob/main/MCP_SPEC.md) — per-tool contract specification, parameters, response fields
- [Hellenistic Time-Lords docs](https://www.ephemengine.com/docs/hellenistic) — lots, profections, firdaria, zodiacal releasing, primary directions
- [Chart Provenance docs](https://www.ephemengine.com/docs/provenance) — realms, certainty, `realize()`, framing for birth time uncertainty
- [Caelus API Reference](https://www.ephemengine.com/docs/api) — all interfaces and types (Chart, Position, FactAtom, ContextOptions, etc.)
- [Caelus repo README](https://github.com/heavyblotto/caelus) — monorepo structure, packages, current version
