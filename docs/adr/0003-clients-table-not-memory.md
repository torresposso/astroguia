# Birth data lives in a `clients` table, not in the agent's Memory

Spec #10 said the Q&A agent has "working memory enabled (stores birth data for session)." Reversed: birth data is canonical world state, kept in a custom `clients` table in `./mastra.db` alongside the `reports` table (ADR-0002) and `Memory`'s `threads`/`messages`. The agent's `Memory` persists *conversational* state — turns, observations, working-memory scratchpad — NOT the deterministic facts about a chart's subject.

## Why

- **Birth data is long-lived world state, not conversation memory.** `Memory`'s schema is designed for what the agent experiences across a thread; birth coordinates are an attribute of the client, true regardless of whether the agent ever thinks about them.
- **Deterministic lookup beats semantic recall.** Q&A agent load path: `astroguia qa --client maria` → `SELECT * FROM clients WHERE name = 'maria'` → pass `NatalInput` to the agent as session context. No "did the agent remember the latitude correctly?" risk.
- **Symmetric with ADR-0002's pattern.** Reports got their own table to avoid storage config; clients get theirs for the same reason — co-located in the existing LibSQL connection.

## Cost / trade-off

- **Lost: free-form recall of birth data mid-conversation.** The agent can still *reference* the birth data it received at session start in its reasoning — but if you edit it (`astroguia client update maria --time 22:15`), the running session doesn't know; you have to restart `qa --client maria`. Acceptable — birth data is stable; edits happen between sessions, not mid-chat.
- **Two tables, one `./mastra.db`.** Same connection, no extra storage backend. If reports/clients grow orders of magnitude larger than Memory, split then.

## Schema

```sql
CREATE TABLE clients (
  name           TEXT PRIMARY KEY,
  date           TEXT NOT NULL,
  time           TEXT,
  lat            REAL NOT NULL,
  lon            REAL NOT NULL,
  timezone       TEXT,
  house_system   TEXT DEFAULT 'placidus',
  created_at     TEXT NOT NULL
);
```

## CLI surface

- `astroguia client add <name> --date --time --lat --lon --timezone --house-system`
- `astroguia client list` — all clients, sorted by name
- `astroguia client update <name> [--date --time --lat --lon --timezone --house-system]`
- `astroguia client remove <name>` — with `--force` to bypass confirmation if it would orphan reports/threads

`astroguia qa --client <name>` requires the client row to exist; if not, errors helpfully: "client 'maria' not found, run `astroguia client add maria ...`".

## Q&A REPL surface

- `astroguia qa --client maria` → REPL mode (default), single-client per session.
- `astroguia qa --client maria --question "..."` → single-shot, exit after answer.
- REPL prompt: `[maria ♑] >` where `♑` is Maria's Sun sign glyph, computed once at REPL startup via a single Caelus `natal_chart` call. Fallback to `[maria] >` (no glyph) if the Caelus compute fails on session open, with a one-line warning to stderr.
- Exit: Ctrl-D / `exit` / `quit` / `:q` all accepted. On exit, print summary: "Session: N turns, M tool calls — done."

## Out of scope

- Multi-client REPL session (one client per session, switch by restarting).
- Editing birth data mid-session (edit between sessions, then restart).
- Deleting a client that has existing reports/threads without explicit confirmation (Phase 2 may build a `--cascade` flag for cleanup).