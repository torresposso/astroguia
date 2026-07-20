import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PersonRepository } from '../storage/persons';

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
