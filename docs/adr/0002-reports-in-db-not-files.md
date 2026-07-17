# Reports live in the Mastra LibSQL DB, not on disk

Spec #10 user story 17 specified "CLI outputs the report as a file saved to disk under a predictable path." Reversed: reports (markdown + typed `Analysis` JSON + typed `CollectedData` JSON) are persisted in a custom `reports` table inside the same `./mastra.db` LibSQLStore that backs the Q&A agent's `Memory`. No file storage is configured.

## Why

- Mastra's `LibSQLStore` is already a hard dependency (Q&A agent memory needs it). Re-using the connection adds one custom table — zero new storage config.
- The astrologer's working directory doesn't fill with `.md` files; version-controlled considerations for the reports content (which lives in the DB) decouple from the code repo.
- Queries (`astroguia report list --client maria`) become a single indexed SELECT instead of filesystem globbing.

## Cost / trade-off

- **Lost: filesystem ergonomics.** `bat reports/maria/2026-07-17.md`, `git diff` on prose, `grep` across all reports — gone. Recovered via two CLI subcommands instead: `astroguia report show <id>` (stdout) and `astroguia report export <id> [<path>]` (one-shot file write).
- **Lost: free `git` versioning on prose.** Reports are in a SQLite file, not diff-able by git directly. Acceptable — reports are deliverables, not source code.
- **Gain: single storage backend.** One DB file, one connection, one backup.

## Schema

One table, indexed by `(client, generated_at DESC)`:

```sql
CREATE TABLE reports (
  id            TEXT PRIMARY KEY,        -- uuid or slug
  client        TEXT NOT NULL,
  generated_at  TEXT NOT NULL,           -- ISO8601
  target_date   TEXT,                    -- ISO8601, NULL for natal-only reads
  report_markdown TEXT NOT NULL,
  analysis_json   TEXT NOT NULL,         -- typed Analysis[], serialized
  collected_json  TEXT NOT NULL          -- typed CollectedData, serialized
);
CREATE INDEX reports_client_date ON reports (client, generated_at DESC);
```

## CLI surface (corresponding)

- `astroguia report <NatalInput>` — produces a report row. Prints a summary line to stdout (id + client + generated_at + word count + section count + citation count), NOT the full markdown.
- `astroguia report list --client <name>` — list IDs + timestamps for a client.
- `astroguia report show <id>` — echo full markdown to stdout (pipe to `bat` or redirect).
- `astroguia report export <id> [<path>]` — write `.md` to the given path (defaults to `./{client}-{date}.md`), return the path.

## Out of scope

Phase 2 may split reports into a separate `./astroguia-reports.db` if growth warrants; for MVP, single `./mastra.db` is the unified store.