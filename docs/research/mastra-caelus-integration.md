# Mastra + Caelus MCP Integration Pattern

Research for [GitHub issue #3](https://github.com/torresposso/astroguia/issues/3).

**Date**: 2026-07-17
**Sources**: Mastra docs (mastra.ai), Caelus docs (ephemengine.com)

---

## 1. Connection Methods: Mastra MCPClient ↔ Caelus MCP

Mastra `MCPClient` supports **two transports**, auto-detected from the server config:

| Transport | How Mastra detects it | Caelus provides? |
|---|---|---|
| **stdio** | `command` field present | Yes — `npx -y caelus-mcp` |
| **Streamable HTTP** | `url` field present (tries Streamable HTTP first, falls back to SSE) | Yes — `https://www.ephemengine.com/api/mcp` |

There is **no "npm direct import" option** for MCPClient. Tools always flow through a transport protocol (stdio or HTTP).

> From the MCPClient reference: *"If `command` is provided, it uses the Stdio transport. If `url` is provided, it first attempts to use the Streamable HTTP transport and falls back to the legacy SSE transport if the initial connection fails."*

---

## 2. Configuration Shapes

### 2a. stdio (local `npx`) connection

```typescript
import { MCPClient } from '@mastra/mcp'

const caelusMcp = new MCPClient({
  id: 'caelus-mcp',
  servers: {
    caelus: {
      command: 'npx',            // string — the executable
      args: ['-y', 'caelus-mcp'], // string[] — CLI arguments
      env: {},                    // Record<string,string> — optional env vars
    },
  },
  timeout: 60000, // global timeout ms (default: 60000)
})
```

**Server-specific fields** (`MastraMCPServerDefinition`, stdio subset):

| Field | Type | Required | Notes |
|---|---|---|---|
| `command` | `string` | Yes | e.g., `'npx'`, `'node'` |
| `args` | `string[]` | No | e.g., `['-y', 'caelus-mcp@0.23.0']` |
| `env` | `Record<string, string>` | No | Environment variables for the child process |
| `timeout` | `number` | No | Server-specific timeout override (ms) |
| `requireToolApproval` | `boolean \| function` | No | Human-in-the-loop approval |
| `forwardInstructions` | `boolean` | No | Inject server instructions into agent system prompt |
| `enableServerLogs` | `boolean` | No | Default `true` |

### 2b. Streamable HTTP connection

```typescript
import { MCPClient } from '@mastra/mcp'

const caelusMcp = new MCPClient({
  id: 'caelus-mcp',
  servers: {
    caelus: {
      url: new URL('https://www.ephemengine.com/api/mcp'),
      // requestInit is optional for unauthenticated servers like Caelus
    },
  },
})
```

**Server-specific fields** (`MastraMCPServerDefinition`, HTTP subset):

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | `URL` | Yes | Streamable HTTP or SSE endpoint |
| `requestInit` | `RequestInit` | No | Passed to fetch for POST requests |
| `eventSourceInit` | `EventSourceInit` | No | **Required for SSE with custom headers** due to SDK bug |
| `fetch` | `(url, init, requestContext?) => Promise<Response>` | No | Custom fetch — simpler alternative to `requestInit` + `eventSourceInit` |
| `authProvider` | `OAuthClientProvider` | No | OAuth token management |

> **SSE header gotcha**: If using SSE (not Streamable HTTP) with custom headers, you MUST set both `requestInit` and `eventSourceInit`. A custom `fetch` function is the simpler workaround for both transports.

### 2c. Version pinning for production

Pin the Caelus version so `npx` doesn't re-download unexpectedly:

```typescript
args: ['-y', 'caelus-mcp@0.23.0']
```

---

## 3. How the 34 Caelus Tools Surface to a Mastra Agent

### Static pattern (single-user, fixed config)

```typescript
import { Agent } from '@mastra/core/agent'
import { caelusMcp } from '../mcp/caelus-mcp'

export const astrologerAgent = new Agent({
  id: 'astrologer',
  name: 'Astrologer Agent',
  instructions: `
    You are an astrologer with access to Caelus MCP tools.
    Use them to compute accurate natal charts, transits, synastry, etc.`,
  model: 'openai/gpt-5.5',
  tools: await caelusMcp.listTools(), // 34 tools, namespaced: caelus_natal_chart, caelus_transits, ...
})
```

- `listTools()` returns tools with names **namespaced** as `serverName_toolName` (e.g., `caelus_natal_chart`, `caelus_synastry`).
- This prevents collisions when connecting to multiple MCP servers.
- The `serverName` is the **key** used in the `servers` record (here: `caelus`).

### Dynamic pattern (multi-tenant, per-user config)

Use `listToolsets()` when config varies per request/user:

```typescript
const agent = mastra.getAgent('astrologer')

const response = await agent.generate('Natal chart for June 10 1990, Tampa FL', {
  toolsets: await caelusMcp.listToolsets(),
})
```

With `listToolsets()`, tools are passed at **call time** via `.generate()` or `.stream()`, not at agent construction.

### Tool namespacing detail

Tools are keyed as `serverName_toolName`:

```
caelus_natal_chart
caelus_transits
caelus_synastry
caelus_chart_facts
caelus_firdaria
caelus_profections
caelus_dignities
caelus_electional_search
caelus_cosmic_weather
caelus_sky_view
... (all 34)
```

Caelus also exposes two **resources** (`caelus://glossary`, `caelus://accuracy`) and one **prompt** (`rectification_session`), accessible via `mcpClient.resources` and `mcpClient.prompts` respectively.

### MCP tool annotations

If Caelus advertises tool annotations (`readOnlyHint`, `destructiveHint`, etc.), you can use them for dynamic approval:

```typescript
const caelusMcp = new MCPClient({
  servers: {
    caelus: {
      url: new URL('https://www.ephemengine.com/api/mcp'),
      requireToolApproval: ({ annotations }) => {
        if (annotations?.readOnlyHint) return false
        if (annotations?.destructiveHint) return true
        return true
      },
    },
  },
})
```

**Security note**: Annotations are untrusted advisory hints. Only relax approval when you trust the server.

---

## 4. Can Workflows Use MCP Tools?

**No — MCP tools (from `MCPClient`) are Agent-only.**

- `MCPClient.listTools()` and `.listToolsets()` return values designed exclusively for the Agent's `tools` property or `.generate()`/`.stream()` call options.
- Mastra Workflows (`Workflow` class with steps) do not consume MCP tools. A Workflow step is a function, not an LLM-backed agent.
- The **reverse** direction is documented: `MCPServer` can expose existing Workflows as MCP tools for external clients via `workflows: { ... }` in its constructor, but that is about serving tools outward, not consuming them inbound.

**Workaround**: If a Workflow needs astrological computation, a step can call `caelus` as an npm library directly (`npm install caelus`) rather than through MCP. MCP is specifically for LLM tool-use, not for programmatic function calls.

---

## 5. Documented Limitations and Gotchas

### Mastra MCPClient

| Gotcha | Detail |
|---|---|
| **Duplicate instance error** | Creating multiple `MCPClient` instances with identical configs (no `id`) throws. Use unique `id`s or call `.disconnect()` before recreating. |
| **GET listener reconnect loop** | The SDK opens a background GET stream for server-pushed notifications. If your server doesn't support it, return a synthetic `405` response from custom `fetch` to stop reconnection retries. Caelus's HTTP endpoint is stateless, so its behavior here needs verification. |
| **SSE header duplication** | Legacy SSE transport requires BOTH `requestInit` and `eventSourceInit` for custom headers. Prefer a custom `fetch` function to avoid this. |
| **Namespacing changes tool names** | Tools are renamed `serverName_toolName`. If your agent instructions reference original Caelus tool names, adjust them. |
| **First call latency (stdio)** | `npx -y caelus-mcp` downloads the package on first run. Subsequent calls use cache. Pin a version to prevent surprise re-downloads. |
| **PATH visibility (stdio)** | GUI clients (Claude Desktop, Cursor) don't inherit shell `PATH`. `npx`/`node` installed via nvm may be invisible. Use `which npx` to find the absolute path and use it as `command`. |
| **`forwardInstructions` is opt-in** | Server instructions are not injected into agent prompts by default. Set `forwardInstructions: true` only for trusted servers (risk of prompt injection). |
| **Tool approval is per-server** | `requireToolApproval` blocks ALL tools from a server. Granularity is at the server level, not individual tool level (unless using a dynamic function). |
| **Global timeout** | Default is 60 seconds. Long-running operations like `electional_search` may need a higher server-specific `timeout`. |
| **No streaming progress by default** | Tool execution progress (`notifications/progress`) requires the server to support it and the client to have `enableProgressTracking: true`. |

### Caelus MCP Specific

| Gotcha | Detail |
|---|---|
| **34 tools is a lot** | Large tool sets increase model context consumption. Consider using Mastra's [ToolSearchProcessor](https://mastra.ai/reference/processors/tool-search-processor) for agents with many tools. |
| **Stateless HTTP endpoint** | `https://www.ephemengine.com/api/mcp` is stateless — no sessions, no subscriptions, no progress notifications over GET streams. This simplifies client config but means features like elicitation and resource subscriptions won't work over HTTP. |
| **Node 18+ required** | For the local stdio transport. |
| **Tool output is structured JSON, not prose** | Agents must interpret structured position data. The `chart_facts` tool returns ranked interpretive atoms more suitable for natural-language interaction. |
| **No authentication on hosted endpoint** | The public endpoint has no API key requirement. This is fine for development but may change in production. |

### Mastra Agent Tool Limits

| Gotcha | Detail |
|---|---|
| **`tools` vs `toolsets` lifecycle** | Static tools (`listTools()`) keep the MCP connection alive for the agent's lifetime. Dynamic toolsets (`listToolsets()`) should be followed by `mcpClient.disconnect()` to release resources. |
| **`activeTools` filtering** | You can limit which MCP tools an agent sees at runtime with `activeTools: ['caelus_natal_chart', 'caelus_transits']` in `.generate()` options. |
| **`requestContext` forwarding** | When using custom `fetch`, the third `requestContext` parameter carries request-scoped auth data from middleware. This is `null` during initial connection handshake. |

---

## 6. Recommended Pattern for astroguia

### Stdio (development / offline / version-pinned)

```typescript
// src/mcp/caelus-mcp.ts
import { MCPClient } from '@mastra/mcp'

export const caelusMcp = new MCPClient({
  id: 'caelus-mcp',
  servers: {
    caelus: {
      command: 'npx',
      args: ['-y', 'caelus-mcp@0.23.0'],
    },
  },
})
```

### Streamable HTTP (production / serverless)

```typescript
// src/mcp/caelus-mcp.ts
import { MCPClient } from '@mastra/mcp'

export const caelusMcp = new MCPClient({
  id: 'caelus-mcp',
  servers: {
    caelus: {
      url: new URL('https://www.ephemengine.com/api/mcp'),
    },
  },
})
```

### Agent wiring

```typescript
// src/agents/astrologer.ts
import { Agent } from '@mastra/core/agent'
import { caelusMcp } from '../mcp/caelus-mcp'

export const astrologerAgent = new Agent({
  id: 'astrologer',
  name: 'Astrologer',
  instructions: `
    You are an astrologer. Use these Caelus tools for all computations:
    - caelus_natal_chart: cast a birth chart
    - caelus_transits: current transits over a natal chart
    - caelus_synastry: compare two charts
    - caelus_chart_facts: ranked interpretive atoms
    - caelus_dignities: essential dignity and sect
    Never guess positions — always call the tool.`,
  model: 'openai/gpt-5.5',
  tools: await caelusMcp.listTools(),
})
```

---

## Key Summary

1. **Both transports work**: Mastra MCPClient connects to Caelus via stdio (`command: 'npx'`) or Streamable HTTP (`url`). Transport is auto-detected.
2. **Namespacing**: All 34 Caelus tools become `caelus_toolName` in the agent.
3. **Agent-only**: MCP tools go to Agents, not Workflows. Workflows can use `caelus` npm package directly for programmatic calls.
4. **Key gotchas**: Duplicate MCPClient instances need unique `id`s; first `npx` call has download latency; GUI clients may not see `npx` on PATH; 34 tools may need ToolSearchProcessor at scale.
5. **No auth needed**: Caelus's hosted MCP endpoint is public and stateless — simplest possible integration.
