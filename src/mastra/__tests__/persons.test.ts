import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PersonRepository, CHART_DATA_TOOLS } from '../storage/persons';

describe('PersonRepository', () => {
  let db: PersonRepository;

  beforeEach(async () => {
    // Use an in-memory LibSQL instance for testing
    db = new PersonRepository('file::memory:');
    await db.init();
  });

  afterEach(async () => {
    await db.close();
  });

  it('should create and retrieve a person', async () => {
    const created = await db.create({
      name: 'John Doe',
      birth_date: '1990-01-01',
      birth_time: '12:00',
      birth_city: 'New York',
      birth_lat: 40.7128,
      birth_lon: -74.006,
      timezone: 'America/New_York',
      house_system: 'placidus',
      notes: 'Test person',
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('John Doe');

    const found = await db.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('John Doe');
    expect(found?.birth_lat).toBe(40.7128);
  });

  it('should update a person', async () => {
    const created = await db.create({
      name: 'Jane Doe',
      birth_date: '1995-05-05',
      birth_time: '08:30',
      birth_city: 'London',
      birth_lat: 51.5074,
      birth_lon: -0.1278,
      timezone: 'Europe/London',
    });

    const updated = await db.update(created.id, {
      name: 'Jane Smith',
      notes: 'Updated note',
    });

    expect(updated.name).toBe('Jane Smith');
    expect(updated.notes).toBe('Updated note');
    expect(updated.birth_city).toBe('London'); // Unchanged field
  });

  it('should search by name', async () => {
    await db.create({
      name: 'Alice Cooper',
      birth_date: '1980-03-15',
      birth_time: '15:45',
      birth_city: 'Detroit',
      birth_lat: 42.3314,
      birth_lon: -83.0458,
      timezone: 'America/Detroit',
    });

    const found = await db.findByName('Alice');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Alice Cooper');

    const notFound = await db.findByName('Bob');
    expect(notFound).toBeNull();
  });

  it('should save and load chart_data', async () => {
    const person = await db.create({
      name: 'Chart Test',
      birth_date: '1985-07-20',
      birth_time: '14:30',
      birth_city: 'Miami',
      birth_lat: 25.76,
      birth_lon: -80.19,
      timezone: 'America/New_York',
    });

    const results = {
      chart_facts: { sun: { sign: 'Cancer' } },
      dasha: { current: 'Venus' },
    };

    await db.saveChartData(person.id, results);
    const loaded = await db.loadChartData(person.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.chart_facts).toEqual({ sun: { sign: 'Cancer' } });
    expect(loaded?.dasha).toEqual({ current: 'Venus' });
  });

  it('should return null when no chart_data exists', async () => {
    const person = await db.create({
      name: 'No Chart',
      birth_date: '1990-01-01',
      birth_time: '12:00',
      birth_city: 'Tampa',
      birth_lat: 27.95,
      birth_lon: -82.46,
      timezone: 'America/New_York',
    });

    const loaded = await db.loadChartData(person.id);
    expect(loaded).toBeNull();
  });

  it('should invalidate chart_data on update', async () => {
    const person = await db.create({
      name: 'Invalidate Test',
      birth_date: '1990-06-10',
      birth_time: '14:30',
      birth_city: 'Tampa',
      birth_lat: 27.95,
      birth_lon: -82.46,
      timezone: 'America/New_York',
    });

    await db.saveChartData(person.id, { chart_facts: { data: 'test' } });
    expect(await db.loadChartData(person.id)).not.toBeNull();

    // Update should invalidate chart_data if birth data changes
    await db.update(person.id, { birth_date: '1991-06-10' });
    expect(await db.loadChartData(person.id)).toBeNull();
  });

  it('should create and list consultations', async () => {
    const person = await db.create({
      name: 'Bob Ross',
      birth_date: '1942-10-29',
      birth_time: '10:00',
      birth_city: 'Daytona Beach',
      birth_lat: 29.2108,
      birth_lon: -81.0228,
      timezone: 'America/New_York',
    });

    const consultation = await db.saveConsultation({
      person_id: person.id,
      type: 'natal',
      thread_id: 'thread-123',
      summary: 'Natal interpretation',
    });

    expect(consultation.id).toBeDefined();

    const consultations = await db.listConsultations(person.id);
    expect(consultations).toHaveLength(1);
    expect(consultations[0].type).toBe('natal');
    expect(consultations[0].thread_id).toBe('thread-123');
  });
});
