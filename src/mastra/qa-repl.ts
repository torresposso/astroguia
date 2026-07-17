#!/usr/bin/env npx tsx
import * as readline from 'node:readline'
import { Engine, SIGNS } from 'caelus'
import { embeddedData } from 'caelus/data-embedded'
import { readFileSync } from 'node:fs'
import { getLibSQLClient } from './db/schema.js'
import type { NatalInput } from './types/index.js'
import { mastra } from './index.js'
import { assembleAgentFromFsEntry } from '@mastra/core/agent'
import config from './agents/qa-evolutivo/config.js'
import memory from './agents/qa-evolutivo/memory.js'
import promptInjection from './agents/qa-evolutivo/processors/input/prompt-injection.js'

const SUN_GLYPHS = ['\u2648', '\u2649', '\u264A', '\u264B', '\u264C', '\u264D', '\u264E', '\u264F', '\u2650', '\u2651', '\u2652', '\u2653']

const EXIT_COMMANDS = new Set(['exit', 'quit', ':q'])

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

export function isExitInput(line: string): boolean {
  return EXIT_COMMANDS.has(line.trim())
}

export function promptFormat(clientName: string, glyph: string): string {
  return `[${clientName}${glyph}] > `
}

function parseDate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m, day: d }
}

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number)
  return { hour: h, minute: m }
}

function getTimezoneOffsetMinutes(epochMs: number, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = fmt.formatToParts(new Date(epochMs))
  const vals: Record<string, number> = {}
  for (const p of parts) {
    if (p.type !== 'literal') vals[p.type] = parseInt(p.value)
  }

  const utcTime = new Date(epochMs)
  const utcMinutes = utcTime.getUTCHours() * 60 + utcTime.getUTCMinutes()
  const tzMinutes = vals.hour * 60 + vals.minute
  const dayDiff = (vals.day - utcTime.getUTCDate()) * 24 * 60

  let offset = tzMinutes - utcMinutes + dayDiff
  if (offset > 720) offset -= 1440
  if (offset < -720) offset += 1440

  return offset
}

export function resolveUT(input: NatalInput): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const { year, month, day } = parseDate(input.date)
  const { hour, minute } = input.time
    ? parseTime(input.time)
    : { hour: 12, minute: 0 }

  if (!input.timezone) {
    return { year, month, day, hour, minute, second: 0 }
  }

  const epochMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offsetMin = getTimezoneOffsetMinutes(epochMs, input.timezone)
  const utcMs = epochMs - offsetMin * 60 * 1000
  const utcDate = new Date(utcMs)

  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
    hour: utcDate.getUTCHours(),
    minute: utcDate.getUTCMinutes(),
    second: utcDate.getUTCSeconds(),
  }
}

export function computeSunSignGlyph(natal: NatalInput): string | null {
  const ut = resolveUT(natal)
  const engine = new Engine(embeddedData)

  const chart = engine.chart(
    ut.year,
    ut.month,
    ut.day,
    ut.hour,
    ut.minute,
    ut.second,
    natal.lat,
    natal.lon,
    natal.house_system ?? 'placidus',
  )

  const signName = chart.bodies.sun.sign
  const signIndex = SIGNS.indexOf(signName)
  if (signIndex === -1) return null
  return SUN_GLYPHS[signIndex]
}

export async function lookupClient(
  clientName: string,
): Promise<NatalInput> {
  const db = getLibSQLClient()
  const result = await db.execute({
    sql: 'SELECT * FROM clients WHERE name = ?',
    args: [clientName],
  })

  if (result.rows.length === 0) {
    throw new Error(
      `client '${clientName}' not found, run \`astroguia client add ${clientName} ...\``,
    )
  }

  const row = result.rows[0]
  return {
    date: row.date as string,
    time: (row.time as string) || undefined,
    lat: row.lat as number,
    lon: row.lon as number,
    timezone: (row.timezone as string) || undefined,
    house_system: (row.house_system as NatalInput['house_system']) ?? 'placidus',
  }
}

export function formatNatalContext(
  clientName: string,
  natal: NatalInput,
): string {
  const parts = [
    `date=${natal.date}`,
    `lat=${natal.lat}`,
    `lon=${natal.lon}`,
  ]
  if (natal.time) parts.push(`time=${natal.time}`)
  if (natal.timezone) parts.push(`timezone=${natal.timezone}`)
  parts.push(`house_system=${natal.house_system ?? 'placidus'}`)

  return `Client ${clientName} birth data: ${parts.join(', ')}`
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { client?: string; question?: string } {
  const result: { client?: string; question?: string } = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--client' && i + 1 < argv.length) {
      result.client = argv[++i]
    } else if (argv[i] === '--question' && i + 1 < argv.length) {
      result.question = argv[++i]
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Agent registration
// ---------------------------------------------------------------------------

function ensureAgentRegistered() {
  try {
    mastra.getAgent('qa-evolutivo')
  } catch {
    const instructionsMd = readFileSync(
      new URL('./agents/qa-evolutivo/instructions.md', import.meta.url),
      'utf-8',
    )

    const agent = assembleAgentFromFsEntry({
      name: 'qa-evolutivo',
      config,
      instructionsMd,
      inputProcessors: [promptInjection],
      memory,
    })

    mastra.__registerFsAgents({ 'qa-evolutivo': agent })
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv)

  if (!args.client) {
    console.error('Usage: npx tsx src/mastra/qa-repl.ts --client <name> [--question "<text>"]')
    process.exit(1)
  }

  // 1. Look up client
  let natal: NatalInput
  try {
    natal = await lookupClient(args.client)
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }

  // 2. Compute Sun-sign glyph
  let glyph = ''
  try {
    const g = computeSunSignGlyph(natal)
    if (g) glyph = ` ${g}`
  } catch (err) {
    console.error(`warning: could not determine sun sign (${(err as Error).message})`)
  }

  // 3. Ensure agent is registered and get it
  ensureAgentRegistered()
  const agent = mastra.getAgent('qa-evolutivo')
  const threadId = `qa-repl-${args.client}-${Date.now()}`

  // Single-shot mode
  if (args.question) {
    const natalContext = formatNatalContext(args.client, natal)
    const message = `${natalContext}\n\nQuestion: ${args.question}`

    const output = await agent.generate(message, {
      memory: { thread: threadId, resource: args.client },
    })

    const toolCount = output.toolCalls?.length ?? 0
    console.log(output.text ?? '')
    console.log(`\nSession: 1 turn, ${toolCount} tool calls — done.`)
    return
  }

  // 4. REPL mode
  const prompt = promptFormat(args.client, glyph)
  const natalContext = formatNatalContext(args.client, natal)

  let turnCount = 0
  let toolCallCount = 0
  let firstMessage = true

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt,
  })

  console.log(`Q&A session for ${args.client}${glyph}. Type exit, quit, :q, or Ctrl-D to end.`)
  rl.prompt()

  rl.on('line', async (line: string) => {
    const trimmed = line.trim()

    if (isExitInput(trimmed)) {
      printSummary(turnCount, toolCallCount)
      rl.close()
      return
    }

    if (!trimmed) {
      rl.prompt()
      return
    }

    turnCount++

    const message = firstMessage
      ? `${natalContext}\n\nQuestion: ${trimmed}`
      : trimmed
    firstMessage = false

    try {
      const output = await agent.generate(message, {
        memory: { thread: threadId, resource: args.client! },
      })

      const tc = output.toolCalls?.length ?? 0
      toolCallCount += tc
      console.log(output.text ?? '')
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
    }

    rl.prompt()
  })

  rl.on('close', () => {
    // Ctrl-D triggers close; summary printed by line handler for explicit exits.
    // Reset the terminal stdin to raw false if needed.
    process.stdin.setRawMode?.(false)
    process.exit(0)
  })
}

function printSummary(turns: number, toolCalls: number) {
  console.log(`Session: ${turns} turns, ${toolCalls} tool calls — done.`)
}

// Only run main when executed directly (not when imported for tests)
const scriptPath = process.argv[1]
if (scriptPath && (scriptPath.endsWith('qa-repl.ts') || scriptPath.endsWith('qa-repl.js'))) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
