import { readFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod/v4'
import { createStep } from '@mastra/core/workflows'
import { Agent } from '@mastra/core/agent'
import type { CollectedData, AnalysisSection, Analysis } from '../types'

const ANALYSIS_SECTION_IDS = [
  'chart-data',
  'pluto',
  'nodal-axis',
  'saturn',
  'tense-aspects',
  'water-houses',
  'timing',
  'synthesis',
] as const

export const AnalysisSectionSchema = z.object({
  id: z.string(),
  body: z.string(),
  citations: z.array(z.string()),
})

export const AnalysisSchema = z.object({
  sections: z.array(AnalysisSectionSchema).length(8),
})

const CITATION_RE = /^\[(id|pd):[^\]]+\]$/

export function quickCheckSectionPresence(
  sections: AnalysisSection[],
): string[] {
  const present = new Set(sections.map((s) => s.id))
  return ANALYSIS_SECTION_IDS.filter((id) => !present.has(id))
}

export function quickCheckCitationFormat(
  sections: AnalysisSection[],
): string[] {
  return sections.flatMap((s) =>
    s.citations.filter((c) => !CITATION_RE.test(c)),
  )
}

export function validateAnalysis(sections: AnalysisSection[]): {
  passes: boolean
  missingSections: string[]
  badCitations: string[]
} {
  const missingSections = quickCheckSectionPresence(sections)
  const badCitations = quickCheckCitationFormat(sections)
  return {
    passes: missingSections.length === 0 && badCitations.length === 0,
    missingSections,
    badCitations,
  }
}

export function readCorpusFile(sectionId: string): string {
  const corpusPath = join(
    process.cwd(),
    'docs',
    'corpus-evolutivo',
    `${sectionId}.txt`,
  )
  try {
    return readFileSync(corpusPath, 'utf-8')
  } catch {
    return ''
  }
}

const SECTION_DATA_EXTRACTORS: Record<
  string,
  (data: CollectedData) => unknown
> = {
  'chart-data': (data) => data.chartFacts,
  pluto: (data) => data.chartFacts,
  'nodal-axis': (data) => data.firdaria,
  saturn: (data) => data.profections,
  'tense-aspects': (data) => data.chartFacts,
  'water-houses': (data) => data.chartFacts,
  timing: (data) => ({ firdaria: data.firdaria, profections: data.profections }),
  synthesis: () => null,
}

function buildSectionBlock(
  sectionId: string,
  data: CollectedData,
): string {
  const extractor = SECTION_DATA_EXTRACTORS[sectionId]
  const atoms = extractor ? extractor(data) : null
  const dataJson = atoms !== null ? JSON.stringify(atoms, null, 2) : ''

  const corpus = readCorpusFile(sectionId)

  let block = `### ${sectionId}\n\n**CollectedData atoms:**\n\`\`\`json\n${dataJson}\n\`\`\``

  if (corpus) {
    block += `\n\n**Evolutionary Corpus (context only — do NOT cite this):**\n<corpus>\n${corpus}\n</corpus>`
  } else {
    block += `\n\n<!-- Evolutionary corpus for ${sectionId} not found. Placeholder: \`docs/corpus-evolutivo/${sectionId}.txt\` will be created by another ticket. -->`
  }

  return block
}

function buildPrompt(data: CollectedData): { system: string; prompt: string } {
  const system = `You are an expert astrologer. You produce a structured astrological analysis consisting of exactly 8 sections.

Rules:
1. Each section must have an "id" field matching one of: ${ANALYSIS_SECTION_IDS.join(', ')}.
2. Each section must have a "body" field with detailed astrological analysis in markdown.
3. Each section must have a "citations" array. Citations MUST use the format [id:...] or [pd:...] only. Each citation references a specific data point from the Provided CollectedData atoms.
4. The CORPUS blocks are evolutionary context for your reasoning only. NEVER cite the corpus. Only cite data atoms using [id:...] or [pd:...].
5. The "synthesis" section must synthesize findings from ALL other sections. It must not introduce new data. It must reference the conclusions of other sections.`

  const sectionBlocks = ANALYSIS_SECTION_IDS.map((id) =>
    buildSectionBlock(id, data),
  )

  const prompt = [
    'Analyze the following natal chart data and produce EXACTLY 8 sections of analysis.',
    '',
    'For each section return:',
    '- **id**: one of the 8 predefined section identifiers',
    '- **body**: comprehensive astrological analysis in markdown format',
    '- **citations**: array of [id:...] or [pd:...] references',
    '',
    sectionBlocks.join('\n\n'),
  ].join('\n')

  return { system, prompt }
}

export const analyzeStep = createStep({
  id: 'analyze',
  description:
    'Calls generateObject (via Agent.generate) against AnalysisSchema with maxRetries: 2. Per-section evolutionary corpus injected as context blocks.',
  inputSchema: z.object({
    chartFacts: z.any(),
    firdaria: z.any(),
    profections: z.any(),
    provenance: z.object({
      houseSystemRequested: z.string(),
      houseSystemActual: z.string(),
      birthStatus: z.enum(['exact', 'approximate', 'unknown']),
    }),
  }),
  outputSchema: AnalysisSchema,
  execute: async ({ inputData }) => {
    const data = inputData as CollectedData
    const { system, prompt } = buildPrompt(data)

    const agent = new Agent({
      id: 'analyze-step-agent',
      name: 'Analyze Step Agent',
      instructions: system,
      model: 'deepseek-v4-pro',
      maxRetries: 2,
    })

    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema: AnalysisSchema,
      },
      modelSettings: {
        temperature: 0.3,
      },
    })

    const result = response.object as Analysis

    const quickCheck = validateAnalysis(result.sections)
    if (!quickCheck.passes) {
      throw new Error(
        `Analysis quick checks failed: missing sections=[${quickCheck.missingSections.join(', ')}], bad citations=[${quickCheck.badCitations.join(', ')}]`,
      )
    }

    return result
  },
})
