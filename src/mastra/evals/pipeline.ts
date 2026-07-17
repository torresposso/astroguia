import { evolutionaryCoverageScorer } from './scorers/evolutionaryCoverage'
import {
  gateEightSectionsPresent,
  gateCitationFormat,
  gateNoEmptyBodies,
  gateNoUnresolvedCitations,
  gateCalledChartFactsFirst,
  gateMaxTwoToolCalls,
} from './gates'

export { evolutionaryCoverageScorer }

export interface EvalConfig {
  evolutionaryCoverageRate: number
  evolutionaryCoverageThreshold: number
  gateThreshold: number
  concurrency: number
}

const DEFAULT_EVAL_CONFIG: EvalConfig = {
  evolutionaryCoverageRate: 1.0,
  evolutionaryCoverageThreshold: 0.5,
  gateThreshold: 1.0,
  concurrency: 3,
}

export function loadEvalConfig(overrides?: Partial<EvalConfig>): EvalConfig {
  return {
    evolutionaryCoverageRate: Number(
      process.env.EVAL_EVOLUTIONARY_COVERAGE_RATE ??
        overrides?.evolutionaryCoverageRate ??
        DEFAULT_EVAL_CONFIG.evolutionaryCoverageRate,
    ),
    evolutionaryCoverageThreshold: Number(
      process.env.EVAL_EVOLUTIONARY_COVERAGE_THRESHOLD ??
        overrides?.evolutionaryCoverageThreshold ??
        DEFAULT_EVAL_CONFIG.evolutionaryCoverageThreshold,
    ),
    gateThreshold: Number(
      process.env.EVAL_GATE_THRESHOLD ??
        overrides?.gateThreshold ??
        DEFAULT_EVAL_CONFIG.gateThreshold,
    ),
    concurrency: Number(
      process.env.EVAL_CONCURRENCY ??
        overrides?.concurrency ??
        DEFAULT_EVAL_CONFIG.concurrency,
    ),
  }
}

export const REPORT_GATES = [
  gateEightSectionsPresent,
  gateCitationFormat,
  gateNoEmptyBodies,
  gateNoUnresolvedCitations,
]

export const QA_GATES = [
  gateCalledChartFactsFirst,
  gateMaxTwoToolCalls,
  gateNoEmptyBodies,
]

export function isPass(verdict?: string): boolean {
  return verdict === 'passed'
}
