import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';
import { db } from '../storage/persons';

export const loadPerson = createTool({
  id: 'load_person',
  description: 'Loads a person\'s astrological profile and birth data by name or ID. Use this to select a person for the current session.',
  inputSchema: z.object({
    id: z.string().optional().describe('Unique ID of the person'),
    name: z.string().optional().describe('Name or partial name of the person to search for'),
  }),
  execute: async ({ id, name }) => {
    if (!id && !name) {
      throw new Error('Must provide either id or name to load a person');
    }

    let person = null;
    if (id) {
      person = await db.findById(id);
    } else if (name) {
      person = await db.findByName(name);
    }

    if (!person) {
      return {
        success: false,
        error: `Person not found${id ? ` with ID: ${id}` : ` with name: ${name}`}`,
      };
    }

    return {
      success: true,
      person,
    };
  },
});
