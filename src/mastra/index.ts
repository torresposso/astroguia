import { Mastra } from '@mastra/core'
import { MastraCompositeStore } from '@mastra/core/storage'
import { LibSQLStore } from '@mastra/libsql'
import { DuckDBStore } from '@mastra/duckdb'
import {
  Observability,
  MastraStorageExporter,
  SensitiveDataFilter,
} from '@mastra/observability'
import { consultationAgent } from './agents/consultation-agent'

const storage = new MastraCompositeStore({
  id: 'composite-storage',
  default: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  domains: {
    observability: await new DuckDBStore().getStore('observability'),
  },
})

export const mastra = new Mastra({
  storage,
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'astroguia',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  agents: { consultationAgent },
})
