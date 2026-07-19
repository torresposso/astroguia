import crypto from 'crypto'
import { z } from 'zod/v4'
import { createStep } from '@mastra/core/workflows'
import { Agent } from '@mastra/core/agent'
import type { CollectedData, Analysis, AnalysisSection, SynthesisOutput } from '../types'
import { renderReport } from '../render/index.js'
import { getLibSQLClient } from '../db/schema'
import type { ReferenceEntry } from '../render/renderReport.js'

export const SynthesisOutputSchema = z.object({
  openingNarrative: z.string(),
  synthesisBody: z.string(),
  synthesisCitations: z.array(z.string()),
})

const AnalysisSectionSchema = z.object({
  id: z.string(),
  body: z.string(),
  citations: z.array(z.string()),
})

const CITATION_RE = /\[(id|pd):[^\]]+\]/g

export function countCitations(markdown: string): number {
  const matches = markdown.match(CITATION_RE)
  return matches ? matches.length : 0
}

function buildReferenceMap(collected: CollectedData): Map<string, ReferenceEntry> {
  const map = new Map<string, ReferenceEntry>()
  const chartFacts = collected.chartFacts as
    | { atoms?: Array<{ id: string; data: unknown }> }
    | undefined
  if (chartFacts?.atoms) {
    for (const atom of chartFacts.atoms) {
      map.set(`id:${atom.id}`, {
        text:
          typeof atom.data === 'string'
            ? atom.data
            : JSON.stringify(atom.data).slice(0, 200),
        salience: 0.5,
        source: 'Caelus',
      })
    }
  }
  return map
}

function buildPrompt(synthesisSection: AnalysisSection): {
  system: string
  prompt: string
} {
  const system =
    'You are an expert astrologer. You synthesize natal chart analyses into a polished final report section. Your output must be structurally constrained to exactly three fields: openingNarrative, synthesisBody, and synthesisCitations.'

  const prompt = [
    'Below is the synthesis section from a prior 8-section astrological analysis.',
    '',
    'SYNTHESIS BODY:',
    synthesisSection.body,
    '',
    'CITATIONS:',
    synthesisSection.citations.join('\n') || '(none)',
    '',
    'Your task:',
    '1. Review the synthesis body for internal consistency. Fix any contradictions or unsupported claims. Do NOT introduce new astrological data.',
    '2. Produce an **opening narrative** — a warm, engaging one-paragraph introduction welcoming the client to their astrological report. Write in second person ("you", "your chart").',
    '3. Return the refined **synthesis body** — your internally-consistent version of the synthesis.',
    '4. Return the **synthesis citations** array — use only [id:...] or [pd:...] format.',
  ].join('\n')

  return { system, prompt }
}

export const synthesizeStep = createStep({
  id: 'synthesize',
  description:
    'Second LLM call: synthesizes the analysis synthesis section into a full report, renders markdown, and persists to the reports table.',
  inputSchema: z.object({
    clientName: z.string(),
    date: z.string(),
    time: z.string().optional(),
    city: z.string(),
    lat: z.number(),
    lon: z.number(),
    timezone: z.string().optional(),
    chartFacts: z.any(),
    firdaria: z.any(),
    profections: z.any(),
    provenance: z.object({
      houseSystemRequested: z.string(),
      houseSystemActual: z.string(),
      birthStatus: z.enum(['exact', 'approximate', 'unknown']),
    }),
    sections: z.array(AnalysisSectionSchema),
  }),
  outputSchema: SynthesisOutputSchema,
  execute: async ({ inputData }) => {
    const collected: CollectedData = {
      chartFacts: inputData.chartFacts,
      firdaria: inputData.firdaria,
      profections: inputData.profections,
      provenance: inputData.provenance as CollectedData['provenance'],
    }

    const sections = inputData.sections as AnalysisSection[]
    const analysis: Analysis = { sections }

    const synthesisSection = sections.find((s) => s.id === 'synthesis')
    if (!synthesisSection) {
      throw new Error('No synthesis section found in analysis sections')
    }

    const { system, prompt } = buildPrompt(synthesisSection)

    const agent = new Agent({
      id: 'synthesize-step-agent',
      name: 'Synthesize Step Agent',
      instructions: system,
      model: 'deepseek-v4-pro',
      maxRetries: 2,
    })

    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: SynthesisOutputSchema,
      },
      modelSettings: {
        temperature: 0.3,
      },
    })

    const synthesis = response.object as SynthesisOutput

    const generatedAt = new Date().toISOString()
    const referenceMap = buildReferenceMap(collected)

    const renderInput = {
      clientName: inputData.clientName as string,
      birth: {
        date: inputData.date as string,
        time: inputData.time as string | undefined,
        city: inputData.city as string,
        lat: inputData.lat as number,
        lon: inputData.lon as number,
        timezone: inputData.timezone as string | undefined,
      },
      houseSystem: collected.provenance.houseSystemActual,
      generatedAt,
      modelAnalyze: 'deepseek-v4-pro',
      modelSynthesize: 'deepseek-v4-pro',
      analysisSections: analysis.sections,
      synthesisOpening: synthesis.openingNarrative,
      synthesisBody: synthesis.synthesisBody,
      synthesisCitations: synthesis.synthesisCitations,
      provenance: collected.provenance,
      referenceMap,
    }

    const { markdown, missingCount } = renderReport(renderInput)

    const reportId = crypto.randomUUID()
    const wordCount = markdown.split(/\s+/).length
    const sectionCount = 8
    const citationCount = countCitations(markdown)

    const client = getLibSQLClient()
    await client.execute({
      sql: `INSERT INTO reports (id, client, generated_at, target_date, report_markdown, analysis_json, collected_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        reportId,
        inputData.clientName as string,
        generatedAt,
        null,
        markdown,
        JSON.stringify(analysis),
        JSON.stringify(collected),
      ],
    })

    console.log(
      `Report ${reportId} | ${inputData.clientName} | ${generatedAt} | words=${wordCount} sections=${sectionCount} citations=${citationCount} unresolved=${missingCount}`,
    )

    if (missingCount > 0) {
      console.warn(
        `WARNING: ${missingCount} unresolved citation(s) in report ${reportId}`,
      )
    }

    return synthesis
  },
})
