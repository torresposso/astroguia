import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';
import { db } from '../storage/persons';

export const savePerson = createTool({
  id: 'save_person',
  description: 'Creates a new person profile or updates an existing one with their birth data.',
  inputSchema: z.object({
    id: z.string().optional().describe('ID of the person to update (omit to create a new person)'),
    name: z.string().describe('Full name of the person'),
    birth_date: z.string().describe('Birth date in YYYY-MM-DD format, e.g. "1990-06-10"'),
    birth_time: z.string().describe('Birth time in HH:MM format (24-hour), e.g. "14:30"'),
    birth_city: z.string().describe('Birth city name, e.g. "Miami, FL"'),
    birth_lat: z.number().describe('Latitude of birth location'),
    birth_lon: z.number().describe('Longitude of birth location'),
    timezone: z.string().describe('IANA timezone name of the birth location, e.g. "America/New_York"'),
    house_system: z.string().optional().default('placidus').describe('Astrological house system, defaults to placidus'),
    notes: z.string().optional().describe('Optional notes about the person'),
  }),
  execute: async (input) => {
    let person;
    if (input.id) {
      person = await db.update(input.id, {
        name: input.name,
        birth_date: input.birth_date,
        birth_time: input.birth_time,
        birth_city: input.birth_city,
        birth_lat: input.birth_lat,
        birth_lon: input.birth_lon,
        timezone: input.timezone,
        house_system: input.house_system,
        notes: input.notes,
      });
    } else {
      person = await db.create({
        name: input.name,
        birth_date: input.birth_date,
        birth_time: input.birth_time,
        birth_city: input.birth_city,
        birth_lat: input.birth_lat,
        birth_lon: input.birth_lon,
        timezone: input.timezone,
        house_system: input.house_system,
        notes: input.notes,
      });
    }

    return {
      success: true,
      person,
    };
  },
});
