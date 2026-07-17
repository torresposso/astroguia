import { describe, it, expect } from 'vitest'
import { Engine, interpretationContext, julianDay } from 'caelus'
import { embeddedData } from 'caelus/data-embedded'
import { firdaria } from 'caelus'
import { profectionAt } from 'caelus'
import { primaryDirections } from 'caelus'
import { collectStep } from '../workflows/collect'

const BASE_FIXTURE = {
  date: '1990-06-10',
  time: '14:30',
  lat: 27.95,
  lon: -82.46,
  house_system: 'placidus' as const,
}

function makeContext(input: Record<string, unknown>) {
  return {
    inputData: input,
    runId: 'test-run-1',
    workflowId: 'test-workflow',
    mastra: {} as never,
    requestContext: {} as never,
    state: {} as never,
    setState: async () => {},
    retryCount: 0,
    getInitData: () => ({}),
    getStepResult: () => ({}),
    suspend: async () => ({} as never),
    bail: () => ({} as never),
    abort: () => {},
    engine: {} as never,
    abortSignal: new AbortController().signal,
    writer: {} as never,
    validateSchemas: false,
  }
}

describe('collect step', () => {
  it('produces a CollectedData object for a normal natal chart', async () => {
    const result = await collectStep.execute(makeContext(BASE_FIXTURE))

    expect(result).toBeDefined()
    expect(result.chartFacts).toBeDefined()
    expect(result.firdaria).toBeDefined()
    expect(result.profections).toBeDefined()

    const ctx = result.chartFacts as ReturnType<typeof interpretationContext>
    expect(ctx.atoms.length).toBeGreaterThan(0)
    expect(ctx.jdUt).toBeGreaterThan(2400000)

    const fird = result.firdaria as ReturnType<typeof firdaria>
    expect(fird.length).toBeGreaterThan(0)
    expect(fird[0].lord).toBeDefined()

    const prof = result.profections as ReturnType<typeof profectionAt>
    expect(prof.annual).toBeDefined()
    expect(prof.annual.lord).toBeDefined()

    expect(result.provenance.houseSystemRequested).toBe('placidus')
    expect(result.provenance.houseSystemActual).toBe('placidus')
    expect(result.provenance.birthStatus).toBe('exact')
  })

  it('defaults to placidus when house_system is omitted', async () => {
    const { house_system: _, ...noHouse } = BASE_FIXTURE
    const result = await collectStep.execute(makeContext(noHouse))

    expect(result.provenance.houseSystemRequested).toBe('placidus')
    expect(result.provenance.houseSystemActual).toBe('placidus')
  })

  it('uses whole_sign when requested', async () => {
    const result = await collectStep.execute(
      makeContext({ ...BASE_FIXTURE, house_system: 'whole_sign' }),
    )

    expect(result.provenance.houseSystemRequested).toBe('whole_sign')
    expect(result.provenance.houseSystemActual).toBe('whole_sign')
  })

  it('handles missing birth time (noon default, birthStatus unknown)', async () => {
    const { time: _, ...noTime } = BASE_FIXTURE
    const result = await collectStep.execute(makeContext(noTime))

    expect(result.chartFacts).toBeDefined()
    expect(result.firdaria).toBeDefined()
    expect(result.profections).toBeDefined()
    expect(result.provenance.birthStatus).toBe('unknown')

    // The chart should still compute — noon ascendant will be approximate
    const ctx = result.chartFacts as ReturnType<typeof interpretationContext>
    expect(ctx.atoms.length).toBeGreaterThan(0)
  })

  it('converts timezone from America/Bogota to UT correctly', async () => {
    // America/Bogota is UTC-5
    // Local noon (12:00) Bogota → 17:00 UT
    const result = await collectStep.execute(
      makeContext({
        date: '1990-06-10',
        time: '12:00',
        lat: 4.71,
        lon: -74.07,
        timezone: 'America/Bogota',
      }),
    )

    expect(result.provenance.birthStatus).toBe('exact')

    const ctx = result.chartFacts as ReturnType<typeof interpretationContext>
    // Verify the JD corresponds to ~17:00 UT on 1990-06-10
    const expectedJd = julianDay(1990, 6, 10, 17, 0, 0)
    const deltaDays = Math.abs(ctx.jdUt - expectedJd)
    expect(deltaDays).toBeLessThan(0.01) // within ~14 minutes
  })

  it('computes expected JD for timezone Asia/Tokyo (UTC+9)', async () => {
    // Asia/Tokyo is UTC+9
    // Local midnight (00:00) Tokyo → 15:00 UT previous day
    const result = await collectStep.execute(
      makeContext({
        date: '1990-06-10',
        time: '00:00',
        lat: 35.68,
        lon: 139.76,
        timezone: 'Asia/Tokyo',
      }),
    )

    const ctx = result.chartFacts as ReturnType<typeof interpretationContext>
    // Should resolve to ~1990-06-09 15:00 UT
    const expectedJd = julianDay(1990, 6, 9, 15, 0, 0)
    const deltaDays = Math.abs(ctx.jdUt - expectedJd)
    expect(deltaDays).toBeLessThan(0.01)
  })

  it('treats time as UT when no timezone is provided', async () => {
    const result = await collectStep.execute(
      makeContext({
        date: '1990-06-10',
        time: '12:00',
        lat: 4.71,
        lon: -74.07,
      }),
    )

    const ctx = result.chartFacts as ReturnType<typeof interpretationContext>
    const expectedJd = julianDay(1990, 6, 10, 12, 0, 0)
    const deltaDays = Math.abs(ctx.jdUt - expectedJd)
    expect(deltaDays).toBeLessThan(0.001)
  })

  it('falls back to whole_sign above the polar circle', async () => {
    // Svalbard, Norway ~78°N — well above the Arctic Circle
    // Placidus/Koch are undefined at these latitudes and fall back to whole_sign
    const result = await collectStep.execute(
      makeContext({
        date: '1990-06-10',
        time: '12:00',
        lat: 78.22,
        lon: 15.65,
        house_system: 'placidus',
      }),
    )

    expect(result.provenance.houseSystemRequested).toBe('placidus')
    expect(result.provenance.houseSystemActual).toBe('whole_sign')
  })

  it('passes koch through when within normal latitudes', async () => {
    const result = await collectStep.execute(
      makeContext({ ...BASE_FIXTURE, house_system: 'koch' }),
    )

    expect(result.provenance.houseSystemRequested).toBe('koch')
    expect(result.provenance.houseSystemActual).toBe('koch')
  })

  it('calls primaryDirections internally (computed, not in output)', async () => {
    // Just verify the step does NOT throw; primaryDirections is computed
    // deterministically as a side-effect call inside Promise.all
    const result = await collectStep.execute(makeContext(BASE_FIXTURE))
    expect(result).toBeDefined()
  })

  it('returns consistent firdaria timeline with known day chart', () => {
    const engine = new Engine(embeddedData)
    // The fixture at noon is a day chart (Sun above horizon at that time/lat)
    const jd = julianDay(1990, 6, 10, 14, 30, 0)
    const fird = firdaria(true, jd)

    // Day chart starts with Sun
    expect(fird[0].lord).toBe('sun')
    // There should be 9 major periods (7 planets + 2 nodes)
    expect(fird.length).toBe(9)
  })

  it('returns profections with annual and monthly at birth', () => {
    const engine = new Engine(embeddedData)
    const jd = julianDay(1990, 6, 10, 14, 30, 0)
    const prof = profectionAt(engine, jd, jd, 27.95, -82.46)

    expect(prof.age_years).toBe(0)
    expect(prof.month).toBeGreaterThanOrEqual(1)
    expect(prof.annual.lord).toBeDefined()
    expect(prof.monthly.lord).toBeDefined()
  })

  it('returns primaryDirections array with direction entries', () => {
    const engine = new Engine(embeddedData)
    const jd = julianDay(1990, 6, 10, 14, 30, 0)
    const dirs = primaryDirections(engine, jd, 27.95, -82.46)

    expect(dirs.length).toBeGreaterThan(0)
    expect(dirs[0].body).toBeDefined()
    expect(typeof dirs[0].arc).toBe('number')
  })
})
