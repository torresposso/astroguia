import { createClient, type Client } from '@libsql/client';
import { getDbPath } from './config';

export interface Person {
  id: string;
  name: string;
  birth_date: string; // YYYY-MM-DD
  birth_time: string; // HH:MM
  birth_city: string;
  birth_lat: number;
  birth_lon: number;
  timezone: string;
  house_system?: string;
  notes?: string;
  created_at?: string;
}

export interface Consultation {
  id: string;
  person_id: string;
  type: 'natal' | 'transit' | 'synastry' | 'timelord' | 'returns' | 'rectification';
  thread_id?: string;
  date?: string;
  summary?: string;
}

function rowToPerson(row: Record<string, unknown>): Person {
  return {
    id: row.id as string,
    name: row.name as string,
    birth_date: row.birth_date as string,
    birth_time: row.birth_time as string,
    birth_city: row.birth_city as string,
    birth_lat: row.birth_lat as number,
    birth_lon: row.birth_lon as number,
    timezone: row.timezone as string,
    house_system: row.house_system as string,
    notes: row.notes as string,
    created_at: row.created_at as string,
  };
}

function rowToConsultation(row: Record<string, unknown>): Consultation {
  return {
    id: row.id as string,
    person_id: row.person_id as string,
    type: row.type as Consultation['type'],
    thread_id: row.thread_id as string,
    date: row.date as string,
    summary: row.summary as string,
  };
}

export class PersonRepository {
  private client: Client;
  private initialized = false;

  constructor(dbPath: string = getDbPath('persons.db')) {
    this.client = createClient({ url: dbPath });
  }

  async init() {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS persons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        birth_date TEXT NOT NULL,
        birth_time TEXT NOT NULL,
        birth_city TEXT NOT NULL,
        birth_lat REAL NOT NULL,
        birth_lon REAL NOT NULL,
        timezone TEXT NOT NULL,
        house_system TEXT DEFAULT 'placidus',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS consultations (
        id TEXT PRIMARY KEY,
        person_id TEXT NOT NULL REFERENCES persons(id),
        type TEXT NOT NULL,
        thread_id TEXT,
        date TEXT DEFAULT CURRENT_TIMESTAMP,
        summary TEXT DEFAULT ''
      )
    `);
    this.initialized = true;
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  async create(person: Omit<Person, 'id' | 'created_at'>): Promise<Person> {
    await this.ensureInitialized();
    const id = crypto.randomUUID();
    const house_system = person.house_system ?? 'placidus';
    const notes = person.notes ?? '';
    await this.client.execute({
      sql: `INSERT INTO persons (id, name, birth_date, birth_time, birth_city, birth_lat, birth_lon, timezone, house_system, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        person.name,
        person.birth_date,
        person.birth_time,
        person.birth_city,
        person.birth_lat,
        person.birth_lon,
        person.timezone,
        house_system,
        notes,
      ],
    });
    return {
      id,
      name: person.name,
      birth_date: person.birth_date,
      birth_time: person.birth_time,
      birth_city: person.birth_city,
      birth_lat: person.birth_lat,
      birth_lon: person.birth_lon,
      timezone: person.timezone,
      house_system,
      notes,
    };
  }

  async findById(id: string): Promise<Person | null> {
    await this.ensureInitialized();
    const res = await this.client.execute({
      sql: `SELECT * FROM persons WHERE id = ?`,
      args: [id],
    });
    if (res.rows.length === 0) return null;
    return rowToPerson(res.rows[0] as Record<string, unknown>);
  }

  async findByName(name: string): Promise<Person | null> {
    await this.ensureInitialized();
    const res = await this.client.execute({
      sql: `SELECT * FROM persons WHERE name LIKE ? LIMIT 1`,
      args: [`%${name}%`],
    });
    if (res.rows.length === 0) return null;
    return rowToPerson(res.rows[0] as Record<string, unknown>);
  }

  async list(): Promise<Person[]> {
    await this.ensureInitialized();
    const res = await this.client.execute(`SELECT * FROM persons ORDER BY created_at DESC`);
    return (res.rows as Record<string, unknown>[]).map(rowToPerson);
  }

  async update(id: string, person: Partial<Person>): Promise<Person> {
    await this.ensureInitialized();
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Person with id ${id} not found`);
    }

    const name = person.name ?? existing.name;
    const birth_date = person.birth_date ?? existing.birth_date;
    const birth_time = person.birth_time ?? existing.birth_time;
    const birth_city = person.birth_city ?? existing.birth_city;
    const birth_lat = person.birth_lat ?? existing.birth_lat;
    const birth_lon = person.birth_lon ?? existing.birth_lon;
    const timezone = person.timezone ?? existing.timezone;
    const house_system = person.house_system ?? existing.house_system ?? 'placidus';
    const notes = person.notes ?? existing.notes ?? '';

    await this.client.execute({
      sql: `UPDATE persons SET name = ?, birth_date = ?, birth_time = ?, birth_city = ?, birth_lat = ?, birth_lon = ?, timezone = ?, house_system = ?, notes = ? WHERE id = ?`,
      args: [name, birth_date, birth_time, birth_city, birth_lat, birth_lon, timezone, house_system, notes, id],
    });

    return {
      id,
      name,
      birth_date,
      birth_time,
      birth_city,
      birth_lat,
      birth_lon,
      timezone,
      house_system,
      notes,
    };
  }

  async saveConsultation(consultation: Omit<Consultation, 'id' | 'date'>): Promise<Consultation> {
    await this.ensureInitialized();
    const id = crypto.randomUUID();
    const thread_id = consultation.thread_id ?? '';
    const summary = consultation.summary ?? '';
    await this.client.execute({
      sql: `INSERT INTO consultations (id, person_id, type, thread_id, summary) VALUES (?, ?, ?, ?, ?)`,
      args: [id, consultation.person_id, consultation.type, thread_id, summary],
    });
    return {
      id,
      person_id: consultation.person_id,
      type: consultation.type,
      thread_id,
      summary,
    };
  }

  async listConsultations(personId: string): Promise<Consultation[]> {
    await this.ensureInitialized();
    const res = await this.client.execute({
      sql: `SELECT * FROM consultations WHERE person_id = ? ORDER BY date DESC`,
      args: [personId],
    });
    return (res.rows as Record<string, unknown>[]).map(rowToConsultation);
  }

  async close() {
    await this.client.close();
  }
}

export const db = new PersonRepository();
