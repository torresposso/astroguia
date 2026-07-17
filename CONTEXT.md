# astroguia

An evolutionary astrology assistant for a working astrologer — produces structured natal chart reports and answers free-form questions about charts, grounded in Caelus-computed astronomical facts and a public-domain delineation corpus. Personal workbench, not a chatbot for clients.

## People & sessions

**Client**:
The astrologer's subject — one real person whose `NatalInput` is being read. Named in CLI as `--client <name>`, used as the Q&A agent's memory resource boundary so two clients' charts never collide. Distinct from "user" (the astrologer, who may have many clients).
_Avoid_: user, subject, person (all overloaded)

## Language

**NatalInput**:
Raw birth parameters a reading starts from — `{date, time?, lat, lon, timezone?, house_system?}`. First thing the system ingests; never re-derived.
_Avoid_: chart input, birth data (too generic)

**CollectedData**:
The deterministic output of Workflow Step 1 — typed bundle of `chartFacts`, `firdaria`, `profections` computed by the `caelus` npm package. Zero LLM in this stage.
_Avoid_: raw facts, chart bundle

**Analysis**:
The typed intermediate produced by Workflow Step 2 — an array of 8 sections, each with `id`, `body` (markdown prose), `citations` (`[id:...]` / `[pd:...]`). Emitted via `generateObject()` against a Zod schema; locked at the seam between the two LLM steps.
_Avoid_: reading, interpretation (those mean the final human-facing output)

**Report**:
The final human-facing markdown artifact — YAML frontmatter + 8 rendered sections + reference table. Produced by Workflow Step 3 (`synthesize`) from `Analysis`. Markdown string, not typed; structure enforced by `renderReport()` plus gates.
_Avoid_: reading, output

**Evolutionary factor**:
One of 10 dimensions every reading must cover — Pluto, North Node, South Node, Saturn, tense aspects, water houses (4/8/12), timing (firdaria + profections + transits), dignities, lunar phase, synthesis. Used as the rubric for the `evolutionaryCoverage` scorer.
_Avoid_: astrological topic (too broad)

**Caelus atom**:
A single factual datum returned by a Caelus tool — a planet's longitude, a house cusp, an aspect orb. Has a stable `id` and is citable as `[id:atom-NN]` in any `Analysis` section.
_Avoid_: chart fact (that's the bundle of atoms)

## Corpus

**Evolutionary corpus**:
The authored markdown content under `docs/corpus-evolutivo/` — 8 files, one per evolutionary factor (`pluto.md`, `nodes.md`, …, `glossary.md`). Conceptual framework the model uses as background, NOT a citable source. Injected into Workflow Step 2 (per-section blocks in one `generateObject` call) and slurped into the Q&A agent's `instructions.md`.
_Avoid_: framework (overloaded — could mean Mastra's workflow framework)

**PD passage**:
A delineation rule from `caelus-delineations-pd` — one of 334 classical passages for planet-in-sign, aspects, houses. Exposed as an `InterpretationSource` via `interpret()`, returns a stable ID, and is citable as `[pd:...]` in an `Analysis` section's `citations` array. Contrast with `Evolutionary corpus`, which is not cited.
_Avoid_: delineation (ambiguous — could mean any interpretive text)