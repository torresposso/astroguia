import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';
import { db } from '../storage/persons';

export const listPersons = createTool({
  id: 'list_persons',
  description: 'Lists all registered persons with their basic birth details and IDs.',
  inputSchema: z.object({}),
  execute: async () => {
    const persons = await db.list();
    return {
      success: true,
      persons: persons.map(p => ({
        id: p.id,
        name: p.name,
        birth_date: p.birth_date,
        birth_time: p.birth_time,
        birth_city: p.birth_city,
      })),
    };
  },
});
