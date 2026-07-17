import { createClient } from '@libsql/client'

const DB_URL = process.env.TURSO_DATABASE_URL ?? 'file:./mastra.db'
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN

export function getClient() {
  const config: { url: string; authToken?: string } = { url: DB_URL }
  if (DB_TOKEN) {
    config.authToken = DB_TOKEN
  }
  return createClient(config)
}

export async function initSchema() {
  const client = getClient()

  await client.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      name         TEXT PRIMARY KEY,
      date         TEXT NOT NULL,
      time         TEXT,
      lat          REAL NOT NULL,
      lon          REAL NOT NULL,
      timezone     TEXT,
      house_system TEXT DEFAULT 'placidus',
      created_at   TEXT NOT NULL
    )
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id              TEXT PRIMARY KEY,
      client          TEXT NOT NULL,
      generated_at    TEXT NOT NULL,
      target_date     TEXT,
      report_markdown TEXT NOT NULL,
      analysis_json   TEXT NOT NULL,
      collected_json  TEXT NOT NULL
    )
  `)

  await client.execute(`
    CREATE INDEX IF NOT EXISTS reports_client_date
    ON reports (client, generated_at DESC)
  `)
}
