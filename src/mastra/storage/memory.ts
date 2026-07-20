import { LibSQLStore } from '@mastra/libsql';
import { getDbPath } from './config';

/**
 * Shared LibSQL storage instance for all agent Memory backends.
 *
 * Using a single instance avoids SQLite write-lock contention that can
 * occur when multiple LibSQLStore instances connect to the same database
 * file from the same process.
 */
export const memoryStorage = new LibSQLStore({
  id: 'agent-memory',
  url: getDbPath('memory.db'),
});
