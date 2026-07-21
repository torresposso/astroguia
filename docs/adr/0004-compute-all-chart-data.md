# Persist chart_data instead of calling caelus-MCP per delegation

Eliminate the natal specialist agent and fold static chart data (natal chart, facts, patterns, dignities, lots, Vedic, dashas, firdaria, directions, releasing) into a `chart_data` JSON column on `persons`. A `computeAllCharts` workflow runs on person create/update, calls `chart_facts` + 4 timing tools once, and stores the results. The orchestrator reads from `chart_data` via `loadChartData` instead of delegating to a natal specialist. The timelord agent is reduced to 2 tools (progressions, profections) — dashas/firdaria/directions/releasing are now static data.

**Why:** Every natal/timing delegation called caelus-mcp and got the same result, wasting tokens and time. Pre-computing once and storing in the DB eliminates redundant calls. The orchestrator can answer natal questions directly from chart_data. The research on real astrologer consultations showed sessions are focused (1–3 techniques) — chart_data optimizes for this by having the most-requested data always ready.

**Trade-off:** chart_data must be invalidated and recomputed when birth data changes. The `chart_facts` tool bundles 9 natal sub-tools into one call (includes a ready-to-use LLM brief), so we lose per-tool granularity but save 8 MCP calls per person.
