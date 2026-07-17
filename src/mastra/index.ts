import { Mastra } from '@mastra/core/mastra'
import { PinoLogger } from '@mastra/loggers'
import { LibSQLStore } from '@mastra/libsql'
import { DuckDBStore } from '@mastra/duckdb'
import { MastraCompositeStore } from '@mastra/core/storage'
import {
  Observability,
  MastraStorageExporter,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability'
import { initSchema } from './db/schema'

const storage = new MastraCompositeStore({
  id: 'composite-storage',
  default: new LibSQLStore({
    id: 'mastra-storage',
    url: process.env.TURSO_DATABASE_URL ?? 'file:./mastra.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  domains: {
    observability: await new DuckDBStore().getStore('observability'),
  },
})

try {
  await initSchema()
} catch (err) {
  console.warn('DB schema init failed (non-fatal):', err)
}

export const mastra = new Mastra({
  storage,
  logger: new PinoLogger({
    name: 'astroguia',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'astroguia',
        exporters: [
          new MastraStorageExporter(),
          new MastraPlatformExporter(),
        ],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
})
