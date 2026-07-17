import { runEvals } from '@mastra/core/evals'
import type { ScorerEntry } from '@mastra/core/evals'
import { Agent } from '@mastra/core/agent'
import { mastra } from '../index'
import { REPORT_FIXTURES } from './datasets/report-fixtures'
import { QA_FIXTURES } from './datasets/qa-fixtures'
import {
  loadEvalConfig,
  REPORT_GATES,
  QA_GATES,
  evolutionaryCoverageScorer,
  isPass,
} from './pipeline'

const config = loadEvalConfig()

async function main(): Promise<boolean> {
  const report = { passed: 0, failed: 0, skipped: 0 }
  const failures: string[] = []

  // ── Report evals ────────────────────────────────────────────────
  console.log(
    `\n=== Report Evals (${REPORT_FIXTURES.length} fixtures, gateThreshold=${config.gateThreshold}, coverageRate=${config.evolutionaryCoverageRate}) ===`,
  )

  const reportAgent = new Agent({
    id: 'eval-runner-agent',
    name: 'Eval Runner Agent',
    instructions: 'You run evaluations on astrological report output.',
    model: 'openai/gpt-5.5',
  })

  const reportData = REPORT_FIXTURES.map((f) => ({
    input: JSON.stringify(f.input),
  }))

  const scorerEntries: ScorerEntry[] = []
  if (config.evolutionaryCoverageRate > 0) {
    scorerEntries.push({
      scorer: evolutionaryCoverageScorer,
      threshold: config.evolutionaryCoverageThreshold,
    })
  }

  try {
    const reportResult = await runEvals({
      data: reportData,
      gates: REPORT_GATES,
      scorers: scorerEntries,
      target: reportAgent,
      concurrency: config.concurrency,
    })

    for (const g of reportResult.gateResults ?? []) {
      if (g.passed) {
        report.passed++
        console.log(`  ✓ gate ${g.id} passed (score=${g.score})`)
      } else {
        report.failed++
        const msg = `gate ${g.id} FAILED (score=${g.score})`
        failures.push(msg)
        console.error(`  ✗ ${msg}`)
      }
    }

    for (const t of reportResult.thresholdResults ?? []) {
      if (t.passed) {
        report.passed++
        console.log(`  ✓ scorer ${t.id} passed (avg=${t.averageScore})`)
      } else {
        report.failed++
        const msg = `scorer ${t.id} FAILED (avg=${t.averageScore}, threshold=${t.threshold})`
        failures.push(msg)
        console.error(`  ✗ ${msg}`)
      }
    }

    if (reportResult.verdict) {
      if (isPass(reportResult.verdict)) {
        console.log(`  ✓ Report evals: ${reportResult.verdict}`)
      } else {
        console.error(`  ✗ Report evals: ${reportResult.verdict}`)
      }
    }
  } catch (err) {
    report.failed++
    failures.push(`Report evals threw: ${err}`)
    console.error(`  ✗ Report evals error: ${err}`)
  }

  // ── Q&A evals ───────────────────────────────────────────────────
  console.log(
    `\n=== Q&A Evals (${QA_FIXTURES.length} fixtures, gateThreshold=${config.gateThreshold}) ===`,
  )

  const qaData = QA_FIXTURES.map((f) => ({
    input: f.question,
  }))

  try {
    const qaResult = await runEvals({
      data: qaData,
      gates: QA_GATES,
      target: reportAgent,
      concurrency: config.concurrency,
    })

    for (const g of qaResult.gateResults ?? []) {
      if (g.passed) {
        report.passed++
        console.log(`  ✓ gate ${g.id} passed (score=${g.score})`)
      } else {
        report.failed++
        const msg = `gate ${g.id} FAILED (score=${g.score})`
        failures.push(msg)
        console.error(`  ✗ ${msg}`)
      }
    }

    if (qaResult.verdict) {
      if (isPass(qaResult.verdict)) {
        console.log(`  ✓ Q&A evals: ${qaResult.verdict}`)
      } else {
        console.error(`  ✗ Q&A evals: ${qaResult.verdict}`)
      }
    }
  } catch (err) {
    report.failed++
    failures.push(`Q&A evals threw: ${err}`)
    console.error(`  ✗ Q&A evals error: ${err}`)
  }

  // ── Summary ─────────────────────────────────────────────────────
  console.log(
    `\n=== Summary: ${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped ===`,
  )

  if (failures.length > 0) {
    console.error('\nFailures:')
    for (const f of failures) {
      console.error(`  ${f}`)
    }
  }

  const overallOk = report.failed === 0
  return overallOk
}

main()
  .then((ok) => {
    if (!ok) {
      console.error('\n❌ CI evals failed — exiting with code 1')
      process.exit(1)
    }
    console.log('\n✅ CI evals passed')
    process.exit(0)
  })
  .catch((err) => {
    console.error('\n❌ CI evals crashed:', err)
    process.exit(1)
  })
