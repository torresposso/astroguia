import { Workflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { computeAllChartsForPerson, db } from '../storage/persons'

const validateStep = createStep({
  id: 'validate',
  inputSchema: z.object({ personId: z.string() }),
  outputSchema: z.object({ personId: z.string() }),
  execute: async ({ inputData }) => {
    return { personId: inputData.personId }
  },
})

const computeStep = createStep({
  id: 'compute',
  inputSchema: z.object({ personId: z.string() }),
  outputSchema: z.object({ success: z.boolean(), computed_at: z.string() }),
  execute: async ({ inputData }) => {
    return await computeAllChartsForPerson(inputData.personId)
  },
})

export const computeAllCharts = new Workflow({
  id: 'compute-all-charts',
  inputSchema: z.object({ personId: z.string() }),
  outputSchema: z.object({ success: z.boolean(), computed_at: z.string() }),
})

computeAllCharts.then(validateStep).then(computeStep).commit()
