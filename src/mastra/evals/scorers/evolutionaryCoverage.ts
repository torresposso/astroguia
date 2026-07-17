import { z } from 'zod/v4'
import { createScorer } from '@mastra/core/evals'

const EVOLUTIONARY_FACTORS = [
  'Pluto',
  'North Node',
  'South Node',
  'Saturn',
  'tense aspects',
  'water houses (4/8/12)',
  'timing (firdaria + profections + transits)',
  'dignities',
  'lunar phase',
  'synthesis',
] as const

const CoverageFactorSchema = z.object({
  name: z.string(),
  covered: z.boolean(),
  evidence: z.string().optional(),
})

const CoverageResultSchema = z.object({
  factors: z.array(CoverageFactorSchema),
  score: z.number().min(0).max(1),
  summary: z.string(),
})

const baseEvoScorer = createScorer({
  id: 'evolutionary-coverage',
  description:
    'Evaluates coverage of all 10 evolutionary astrology factors in generated output',
})

const preprocessedEvoScorer = baseEvoScorer.preprocess(({ run }) => {
  const output = run.output
  let text = ''
  if (typeof output === 'string') {
    text = output
  } else if (Array.isArray(output)) {
    text = output
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
  } else if (output && typeof output === 'object') {
    text = JSON.stringify(output, null, 2)
  }
  return { text, factors: EVOLUTIONARY_FACTORS.map((f) => f) }
})

const analyzedEvoScorer = preprocessedEvoScorer.analyze({
  description: 'Judge coverage of 10 evolutionary astrology factors',
  outputSchema: CoverageResultSchema,
    judge: {
      model: 'openai/gpt-5.5',
      instructions:
      'You are an exacting grader of evolutionary astrology content.\n\n' +
      'You receive the output of an astrological analysis tool. You must evaluate\n' +
      'coverage of exactly 10 evolutionary astrology factors:\n\n' +
      '1. Pluto — Is Pluto placed, sign, house, and evolutionary role discussed?\n' +
      '2. North Node — Is the North Node placement and evolutionary direction covered?\n' +
      '3. South Node — Is the South Node placement and karmic pattern covered?\n' +
      '4. Saturn — Is Saturn placement, structure, and maturation addressed?\n' +
      '5. Tense aspects — Are squares, oppositions, and other tense aspects analyzed?\n' +
      '6. Water houses 4/8/12 — Is there discussion of the 4th, 8th, and 12th houses?\n' +
      '7. Timing — Are firdaria, profections, and transits discussed?\n' +
      '8. Dignities — Are essential and accidental dignities evaluated?\n' +
      '9. Lunar phase — Is the natal lunar phase identified and interpreted?\n' +
      '10. Synthesis — Is there a synthesis that weaves all factors together?\n\n' +
      'For each factor, decide if it is COVERED (the output meaningfully addresses it)\n' +
      'or NOT covered. Return a score (0-1) = covered_count / 10.',
  },
  createPrompt: ({ results }) => {
    const { text } = results.preprocessStepResult
    return (
      'Evaluate the following astrological analysis output for coverage of the 10 evolutionary factors.\n\n' +
      'OUTPUT:\n' +
      text +
      '\n\n' +
      'For each of the 10 factors, determine if it is covered. Return a factors array\n' +
      'with name, covered (true/false), and optional evidence. Also return the overall\n' +
      'score (covered/10) and a brief summary.'
    )
  },
})

const scoredEvoScorer = analyzedEvoScorer.generateScore(({ results }) => {
  return results.analyzeStepResult.score
})

export const evolutionaryCoverageScorer = scoredEvoScorer.generateReason(
  ({ results }) => {
    const { factors, score, summary } = results.analyzeStepResult
    const covered = factors.filter((f) => f.covered).length
    const missing = factors
      .filter((f) => !f.covered)
      .map((f) => f.name)
    return `Covered ${covered}/10 factors (score: ${score.toFixed(2)}). Missing: ${missing.join(', ') || 'none'}. ${summary}`
  },
)
