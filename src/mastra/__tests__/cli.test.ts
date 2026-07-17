import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createClient } from '@libsql/client'
import type { Client } from '@libsql/client'
import {
  handleClientAdd,
  handleClientList,
  handleClientUpdate,
  handleClientRemove,
  handleReportList,
  handleReportShow,
  handleReportExport,
  type ClientFields,
} from '../cli.js'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

async function createTestDb(): Promise<Client> {
  const client = createClient({ url: ':memory:' })
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
  return client
}

const DEMO_FIELDS: ClientFields = {
  date: '1990-06-10',
  time: '14:30',
  lat: 40.7128,
  lon: -74.006,
  timezone: 'America/New_York',
  house_system: 'placidus',
}

describe('client add', () => {
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    db.close()
  })

  it('inserts a client row', async () => {
    await handleClientAdd(db, 'Alice', DEMO_FIELDS)
    const rs = await db.execute('SELECT * FROM clients WHERE name = ?', { args: ['Alice'] })
    expect(rs.rows).toHaveLength(1)
    expect(String(rs.rows[0].name)).toBe('Alice')
    expect(String(rs.rows[0].date)).toBe('1990-06-10')
    expect(rs.rows[0].lat).toBe(40.7128)
    expect(rs.rows[0].lon).toBe(-74.006)
    expect(String(rs.rows[0].house_system)).toBe('placidus')
  })

  it('fails when missing required fields', async () => {
    await expect(handleClientAdd(db, '', DEMO_FIELDS)).rejects.toThrow('Usage')
    await expect(handleClientAdd(db, 'Bob', { lat: 1, lon: 1 })).rejects.toThrow('Usage')
    await expect(handleClientAdd(db, 'Bob', { date: '2000-01-01', lon: 1 })).rejects.toThrow('Usage')
    await expect(handleClientAdd(db, 'Bob', { date: '2000-01-01', lat: 1 })).rejects.toThrow('Usage')
  })

  it('fails on invalid house system', async () => {
    await expect(
      handleClientAdd(db, 'Bad', { ...DEMO_FIELDS, house_system: 'invalid' }),
    ).rejects.toThrow('Invalid house system')
  })

  it('fails on duplicate name', async () => {
    await handleClientAdd(db, 'Alice', DEMO_FIELDS)
    await expect(handleClientAdd(db, 'Alice', DEMO_FIELDS)).rejects.toThrow()
  })
})

describe('client list', () => {
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    db.close()
  })

  it('prints "No clients found" when empty', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await handleClientList(db)
    expect(spy).toHaveBeenCalledWith('No clients found.')
    spy.mockRestore()
  })

  it('prints clients sorted by name', async () => {
    await handleClientAdd(db, 'Zara', DEMO_FIELDS)
    await handleClientAdd(db, 'Alice', DEMO_FIELDS)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await handleClientList(db)
    const calls = spy.mock.calls.map(c => String(c[0]))
    expect(calls[0]).toContain('Name')
    expect(calls[2]).toContain('Alice')
    expect(calls[3]).toContain('Zara')
    spy.mockRestore()
  })
})

describe('client update', () => {
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    db.close()
  })

  it('updates selected fields', async () => {
    await handleClientAdd(db, 'Alice', DEMO_FIELDS)
    await handleClientUpdate(db, 'Alice', { date: '1995-12-25', timezone: 'Europe/London' })
    const rs = await db.execute('SELECT * FROM clients WHERE name = ?', { args: ['Alice'] })
    expect(String(rs.rows[0].date)).toBe('1995-12-25')
    expect(String(rs.rows[0].timezone)).toBe('Europe/London')
    expect(rs.rows[0].lat).toBe(40.7128)
  })

  it('fails when no fields provided', async () => {
    await handleClientAdd(db, 'Alice', DEMO_FIELDS)
    await expect(handleClientUpdate(db, 'Alice', {})).rejects.toThrow('No fields to update')
  })

  it('fails when client does not exist', async () => {
    await expect(handleClientUpdate(db, 'Nemo', { date: '2000-01-01' })).rejects.toThrow('not found')
  })

  it('fails on invalid house system', async () => {
    await handleClientAdd(db, 'Alice', DEMO_FIELDS)
    await expect(
      handleClientUpdate(db, 'Alice', { house_system: 'bogus' }),
    ).rejects.toThrow('Invalid house system')
  })
})

describe('client remove', () => {
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    db.close()
  })

  it('removes a client with no reports', async () => {
    await handleClientAdd(db, 'Alice', DEMO_FIELDS)
    await handleClientRemove(db, 'Alice', false)
    const rs = await db.execute('SELECT * FROM clients')
    expect(rs.rows).toHaveLength(0)
  })

  it('fails when client not found', async () => {
    await expect(handleClientRemove(db, 'Nemo', true)).rejects.toThrow('not found')
  })

  it('refuses removal without --force when reports exist', async () => {
    await handleClientAdd(db, 'Alice', DEMO_FIELDS)
    await db.execute({
      sql: `INSERT INTO reports (id, client, generated_at, report_markdown, analysis_json, collected_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['r1', 'Alice', '2024-01-01T00:00:00Z', '# Report', '{}', '{}'],
    })
    await expect(handleClientRemove(db, 'Alice', false)).rejects.toThrow('Use --force')
    const rs = await db.execute('SELECT * FROM clients')
    expect(rs.rows).toHaveLength(1)
  })

  it('removes with --force even when reports exist', async () => {
    await handleClientAdd(db, 'Alice', DEMO_FIELDS)
    await db.execute({
      sql: `INSERT INTO reports (id, client, generated_at, report_markdown, analysis_json, collected_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['r1', 'Alice', '2024-01-01T00:00:00Z', '# Report', '{}', '{}'],
    })
    await handleClientRemove(db, 'Alice', true)
    const rs = await db.execute('SELECT * FROM clients')
    expect(rs.rows).toHaveLength(0)
  })
})

describe('report list', () => {
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    db.close()
  })

  it('fails without --client', async () => {
    await expect(handleReportList(db, '')).rejects.toThrow('Usage')
  })

  it('prints "no reports" when none exist', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await handleReportList(db, 'Alice')
    expect(spy).toHaveBeenCalledWith('No reports found for client "Alice".')
    spy.mockRestore()
  })

  it('lists reports for a client', async () => {
    await db.execute({
      sql: `INSERT INTO reports (id, client, generated_at, report_markdown, analysis_json, collected_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['r1', 'Alice', '2024-06-01T12:00:00Z', '# R1', '{}', '{}'],
    })
    await db.execute({
      sql: `INSERT INTO reports (id, client, generated_at, report_markdown, analysis_json, collected_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['r2', 'Alice', '2024-06-02T12:00:00Z', '# R2', '{}', '{}'],
    })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await handleReportList(db, 'Alice')
    expect(spy).toHaveBeenCalledTimes(2)
    expect(String(spy.mock.calls[0][0])).toContain('r2')
    expect(String(spy.mock.calls[1][0])).toContain('r1')
    spy.mockRestore()
  })
})

describe('report show', () => {
  let db: Client

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    db.close()
  })

  it('prints report markdown to stdout', async () => {
    await db.execute({
      sql: `INSERT INTO reports (id, client, generated_at, report_markdown, analysis_json, collected_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['r1', 'Alice', '2024-06-01T12:00:00Z', '# Hello Report', '{}', '{}'],
    })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await handleReportShow(db, 'r1')
    expect(spy).toHaveBeenCalledWith('# Hello Report')
    spy.mockRestore()
  })

  it('fails on missing report', async () => {
    await expect(handleReportShow(db, 'nonexistent')).rejects.toThrow('not found')
  })
})

describe('report export', () => {
  let db: Client
  let tmpDir: string

  beforeEach(async () => {
    db = await createTestDb()
    tmpDir = join(tmpdir(), 'cli-test-' + randomUUID())
    await mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    db.close()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('exports to default path', async () => {
    await db.execute({
      sql: `INSERT INTO reports (id, client, generated_at, target_date, report_markdown, analysis_json, collected_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: ['r1', 'Alice', '2024-06-01T12:00:00Z', '2024-06-01', '# Exported', '{}', '{}'],
    })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await handleReportExport(db, 'r1')
    expect(result).toMatch(/Alice-2024-06-01\.md$/)
    expect(spy).toHaveBeenCalledWith(result)
    spy.mockRestore()
  })

  it('exports to custom path', async () => {
    const customPath = join(tmpDir, 'custom.md')
    await db.execute({
      sql: `INSERT INTO reports (id, client, generated_at, report_markdown, analysis_json, collected_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['r2', 'Bob', '2024-06-01T12:00:00Z', '# Custom', '{}', '{}'],
    })
    const result = await handleReportExport(db, 'r2', customPath)
    expect(result).toBe(customPath)
  })

  it('fails on missing report', async () => {
    await expect(handleReportExport(db, 'nonexistent')).rejects.toThrow('not found')
  })
})
