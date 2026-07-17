import { createScorer } from '@mastra/core/evals'
import { validateAnalysis } from '../workflows/analyze'

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

const CITATION_RE = /^\[(id|pd):[^\]]+\]$/

function extractAnalysisSections(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output: any,
): Array<{ id: string; body: string; citations: string[] }> {
  if (output && typeof output === 'object') {
    const sections = output.sections ?? output?.analysis?.sections
    if (Array.isArray(sections)) return sections
  }
  return []
}

function extractOutputText(output: unknown): string {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    return output
      .map((m) => {
        if (typeof m === 'string') return m
        if (m && typeof m === 'object') {
          const c = (m as Record<string, unknown>).content
          return typeof c === 'string' ? c : JSON.stringify(m)
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  if (output && typeof output === 'object') {
    return JSON.stringify(output, null, 2)
  }
  return String(output ?? '')
}

/**
 * Gate: 8 required sections must all be present in the analysis output.
 */
export const gateEightSectionsPresent = createScorer({
  id: 'gate-eight-sections',
  description: 'Verify all 8 required analysis sections are present',
}).generateScore(({ run }) => {
  const sections = extractAnalysisSections(run.output)
  const present = new Set(sections.map((s) => s.id))
  const missing = ANALYSIS_SECTION_IDS.filter((id) => !present.has(id))
  return missing.length === 0 ? 1 : 0
})

/**
 * Gate: all citations must match the [id:...] or [pd:...] format.
 */
export const gateCitationFormat = createScorer({
  id: 'gate-citation-format',
  description: 'Verify all citations match [id:...] or [pd:...] format',
}).generateScore(({ run }) => {
  const sections = extractAnalysisSections(run.output)
  const allCitations = sections.flatMap((s) => s.citations)
  if (allCitations.length === 0) return 1
  const bad = allCitations.filter((c) => !CITATION_RE.test(c))
  return bad.length === 0 ? 1 : 0
})

/**
 * Gate: no section body should be empty or whitespace-only.
 */
export const gateNoEmptyBodies = createScorer({
  id: 'gate-no-empty-bodies',
  description: 'Verify no section body is empty or whitespace-only',
}).generateScore(({ run }) => {
  const sections = extractAnalysisSections(run.output)
  if (sections.length === 0) {
    const text = extractOutputText(run.output)
    if (text.trim().length === 0) return 0
    return 1
  }
  const empty = sections.filter((s) => !s.body?.trim())
  return empty.length === 0 ? 1 : 0
})

/**
 * Gate: all [id:...] citations must have a non-empty key after the prefix.
 */
export const gateNoUnresolvedCitations = createScorer({
  id: 'gate-no-unresolved-citations',
  description: 'Verify no citation references are empty or malformed',
}).generateScore(({ run }) => {
  const sections = extractAnalysisSections(run.output)
  if (sections.length === 0) return 0
  const allCitations = sections.flatMap((s) => s.citations)
  const unresolved = allCitations.filter((c) => {
    const m = CITATION_RE.exec(c)
    if (!m) return true
    const key = c.replace(/^\[(id|pd):/, '').replace(/\]$/, '')
    return key.trim().length === 0
  })
  return unresolved.length === 0 ? 1 : 0
})

/**
 * Gate: Q&A agent must call chart_facts as the first tool.
 */
export const gateCalledChartFactsFirst = createScorer({
  id: 'gate-called-chart-facts-first',
  description: 'Verify the agent called chart_facts as its first tool',
}).generateScore(({ run }) => {
  const output = run.output
  if (!Array.isArray(output)) return 0
  for (const msg of output) {
    if (msg?.role !== 'assistant') continue
    const content = msg.content
    if (!content?.parts) continue
    for (const part of content.parts) {
      if (part.type === 'tool-invocation') {
        return part.toolName === 'chart_facts' ? 1 : 0
      }
    }
  }
  return 0
})

/**
 * Gate: max 2 tool calls (chart_facts + at most 1 drill-down).
 */
export const gateMaxTwoToolCalls = createScorer({
  id: 'gate-max-two-tool-calls',
  description: 'Verify agent made at most 2 tool calls',
}).generateScore(({ run }) => {
  const output = run.output
  if (!Array.isArray(output)) return 0
  let count = 0
  for (const msg of output) {
    if (msg?.role !== 'assistant') continue
    const content = msg.content
    if (!content?.parts) continue
    for (const part of content.parts) {
      if (part.type === 'tool-invocation') count++
    }
  }
  return count <= 2 ? 1 : 0
})
