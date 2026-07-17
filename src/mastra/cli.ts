import type { Client } from '@libsql/client'
import { writeFile } from 'node:fs/promises'
import { getLibSQLClient, initSchema } from './db/schema.js'

function parseArgs(args: string[]): { positionals: string[]; flags: Record<string, string | boolean> } {
  const positionals: string[] = []
  const flags: Record<string, string | boolean> = {}
  let i = 0
  while (i < args.length) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        flags[key] = args[i + 1]
        i += 2
      } else {
        flags[key] = true
        i += 1
      }
    } else {
      positionals.push(args[i])
      i += 1
    }
  }
  return { positionals, flags }
}

export interface ClientFields {
  date?: string
  time?: string
  lat?: number
  lon?: number
  timezone?: string
  house_system?: string
}

const VALID_HOUSE_SYSTEMS = ['placidus', 'whole_sign', 'koch']

// ---- Client handlers ----

export async function handleClientAdd(client: Client, name: string, fields: ClientFields): Promise<void> {
  if (!name || !fields.date || fields.lat === undefined || fields.lon === undefined) {
    throw new Error('Usage: astroguia client add <name> --date <date> --lat <lat> --lon <lon> [--time <time>] [--timezone <tz>] [--house-system <hs>]')
  }
  if (fields.house_system && !VALID_HOUSE_SYSTEMS.includes(fields.house_system)) {
    throw new Error(`Invalid house system: ${fields.house_system}. Valid: ${VALID_HOUSE_SYSTEMS.join(', ')}`)
  }
  const now = new Date().toISOString()
  await client.execute({
    sql: `INSERT INTO clients (name, date, time, lat, lon, timezone, house_system, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [name, fields.date, fields.time ?? null, fields.lat, fields.lon, fields.timezone ?? null, fields.house_system ?? 'placidus', now],
  })
  console.log(`Client "${name}" added.`)
}

export async function handleClientList(client: Client): Promise<void> {
  const rs = await client.execute('SELECT name, date, time, lat, lon, timezone, house_system, created_at FROM clients ORDER BY name')
  if (rs.rows.length === 0) {
    console.log('No clients found.')
    return
  }
  const headers = ['Name', 'Date', 'Time', 'Lat', 'Lon', 'Timezone', 'House System', 'Created']
  const data = rs.rows.map(r => [
    String(r.name),
    String(r.date),
    r.time !== null ? String(r.time) : '',
    String(r.lat),
    String(r.lon),
    r.timezone !== null ? String(r.timezone) : '',
    r.house_system !== null ? String(r.house_system) : '',
    String(r.created_at),
  ])
  const widths = headers.map((h, i) => Math.max(h.length, ...data.map(d => String(d[i]).length)))
  const pad = (s: string, w: number) => s.padEnd(w)
  console.log(headers.map((h, i) => pad(h, widths[i])).join(' | '))
  console.log(widths.map(w => '-'.repeat(w)).join('-+-'))
  for (const row of data) {
    console.log(row.map((v, i) => pad(String(v), widths[i])).join(' | '))
  }
}

export async function handleClientUpdate(client: Client, name: string, fields: ClientFields): Promise<void> {
  if (!name) {
    throw new Error('Usage: astroguia client update <name> [--date <date>] [--time <time>] [--lat <lat>] [--lon <lon>] [--timezone <tz>] [--house-system <hs>]')
  }
  const setClauses: string[] = []
  const args: unknown[] = []

  if (fields.date !== undefined) { setClauses.push('date = ?'); args.push(fields.date) }
  if (fields.time !== undefined) { setClauses.push('time = ?'); args.push(fields.time) }
  if (fields.lat !== undefined) { setClauses.push('lat = ?'); args.push(fields.lat) }
  if (fields.lon !== undefined) { setClauses.push('lon = ?'); args.push(fields.lon) }
  if (fields.timezone !== undefined) { setClauses.push('timezone = ?'); args.push(fields.timezone) }
  if (fields.house_system !== undefined) {
    if (!VALID_HOUSE_SYSTEMS.includes(fields.house_system)) {
      throw new Error(`Invalid house system: ${fields.house_system}. Valid: ${VALID_HOUSE_SYSTEMS.join(', ')}`)
    }
    setClauses.push('house_system = ?')
    args.push(fields.house_system)
  }

  if (setClauses.length === 0) {
    throw new Error('No fields to update. Provide at least one flag.')
  }

  args.push(name)
  const result = await client.execute({
    sql: `UPDATE clients SET ${setClauses.join(', ')} WHERE name = ?`,
    args,
  })
  if (result.rowsAffected === 0) {
    throw new Error(`Client "${name}" not found.`)
  }
  console.log(`Client "${name}" updated.`)
}

export async function handleClientRemove(client: Client, name: string, force: boolean): Promise<void> {
  if (!name) {
    throw new Error('Usage: astroguia client remove <name> [--force]')
  }

  const reportCheck = await client.execute({
    sql: 'SELECT COUNT(*) as cnt FROM reports WHERE client = ?',
    args: [name],
  })
  const reportCount = Number(reportCheck.rows[0].cnt)

  if (reportCount > 0 && !force) {
    throw new Error(`Client "${name}" has ${reportCount} report(s). Use --force to delete anyway.`)
  }

  const result = await client.execute({
    sql: 'DELETE FROM clients WHERE name = ?',
    args: [name],
  })
  if (result.rowsAffected === 0) {
    throw new Error(`Client "${name}" not found.`)
  }
  console.log(`Client "${name}" removed.`)
}

// ---- Report handlers ----

export async function handleReportList(client: Client, clientName: string): Promise<void> {
  if (!clientName) {
    throw new Error('Usage: astroguia report list --client <name>')
  }
  const rs = await client.execute({
    sql: 'SELECT id, generated_at FROM reports WHERE client = ? ORDER BY generated_at DESC',
    args: [clientName],
  })
  if (rs.rows.length === 0) {
    console.log(`No reports found for client "${clientName}".`)
    return
  }
  for (const row of rs.rows) {
    console.log(`${String(row.id)}\t${String(row.generated_at)}`)
  }
}

export async function handleReportShow(client: Client, id: string): Promise<void> {
  if (!id) {
    throw new Error('Usage: astroguia report show <id>')
  }
  const rs = await client.execute({
    sql: 'SELECT report_markdown FROM reports WHERE id = ?',
    args: [id],
  })
  if (rs.rows.length === 0) {
    throw new Error(`Report "${id}" not found.`)
  }
  console.log(String(rs.rows[0].report_markdown))
}

export async function handleReportExport(client: Client, id: string, outputPath?: string): Promise<string> {
  if (!id) {
    throw new Error('Usage: astroguia report export <id> [<path>]')
  }
  const rs = await client.execute({
    sql: 'SELECT report_markdown, client, COALESCE(target_date, generated_at) as date FROM reports WHERE id = ?',
    args: [id],
  })
  if (rs.rows.length === 0) {
    throw new Error(`Report "${id}" not found.`)
  }
  const row = rs.rows[0]
  const path = outputPath ?? `./${String(row.client)}-${String(row.date).slice(0, 10)}.md`
  await writeFile(path, String(row.report_markdown), 'utf-8')
  console.log(path)
  return path
}

// ---- Main entry ----

async function main() {
  const [, , subcommand, subsubcommand, ...rest] = process.argv

  if (!subcommand) {
    console.error('Usage: astroguia <client|report> ...')
    process.exit(1)
  }

  const client = getLibSQLClient()
  await initSchema()
  const { positionals, flags } = parseArgs(rest)

  try {
    switch (subcommand) {
      case 'client': {
        switch (subsubcommand) {
          case 'add':
            await handleClientAdd(client, positionals[0] ?? '', {
              date: typeof flags.date === 'string' ? flags.date : undefined,
              time: typeof flags.time === 'string' ? flags.time : undefined,
              lat: typeof flags.lat === 'string' ? Number(flags.lat) : undefined,
              lon: typeof flags.lon === 'string' ? Number(flags.lon) : undefined,
              timezone: typeof flags.timezone === 'string' ? flags.timezone : undefined,
              house_system: typeof flags.house_system === 'string' ? flags.house_system : undefined,
            })
            break
          case 'list':
            await handleClientList(client)
            break
          case 'update':
            await handleClientUpdate(client, positionals[0] ?? '', {
              date: typeof flags.date === 'string' ? flags.date : undefined,
              time: typeof flags.time === 'string' ? flags.time : undefined,
              lat: typeof flags.lat === 'string' ? Number(flags.lat) : undefined,
              lon: typeof flags.lon === 'string' ? Number(flags.lon) : undefined,
              timezone: typeof flags.timezone === 'string' ? flags.timezone : undefined,
              house_system: typeof flags.house_system === 'string' ? flags.house_system : undefined,
            })
            break
          case 'remove':
            await handleClientRemove(client, positionals[0] ?? '', flags.force === true)
            break
          default:
            console.error('Unknown client subcommand. Use: add, list, update, remove')
            process.exit(1)
        }
        break
      }
      case 'report': {
        switch (subsubcommand) {
          case 'list':
            await handleReportList(client, typeof flags.client === 'string' ? flags.client : '')
            break
          case 'show':
            await handleReportShow(client, positionals[0] ?? '')
            break
          case 'export':
            await handleReportExport(client, positionals[0] ?? '', positionals[1])
            break
          default:
            console.error('Unknown report subcommand. Use: list, show, export')
            process.exit(1)
        }
        break
      }
      default:
        console.error('Usage: astroguia <client|report> ...')
        process.exit(1)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    process.exit(1)
  } finally {
    client.close()
  }
}

if (!process.env.VITEST) {
  main()
}
