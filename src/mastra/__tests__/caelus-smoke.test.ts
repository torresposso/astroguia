import { describe, it, expect } from 'vitest'
import { Engine, interpretationContext, julianDay } from 'caelus'
import { embeddedData } from 'caelus/data-embedded'

const FIXTURE = {
  year: 1990,
  month: 6,
  day: 10,
  hour: 14,
  minute: 30,
  second: 0,
  lat: 27.95,
  lonEast: -82.46,
  houseSystem: 'placidus' as const,
}

describe('Caelus smoke test', () => {
  it('instantiates Engine without errors', () => {
    const engine = new Engine(embeddedData)
    expect(engine).toBeDefined()
  })

  it('computes a natal chart for a known fixture', () => {
    const engine = new Engine(embeddedData)
    const chart = engine.chart(
      FIXTURE.year,
      FIXTURE.month,
      FIXTURE.day,
      FIXTURE.hour,
      FIXTURE.minute,
      FIXTURE.second,
      FIXTURE.lat,
      FIXTURE.lonEast,
      FIXTURE.houseSystem,
    )

    expect(chart.bodies).toBeDefined()
    expect(chart.bodies.sun).toBeDefined()
    expect(typeof chart.bodies.sun.lon).toBe('number')
    expect(chart.angles.asc).toBeDefined()
  })

  it('produces an InterpretationContext with atoms', () => {
    const engine = new Engine(embeddedData)
    const chart = engine.chart(
      FIXTURE.year,
      FIXTURE.month,
      FIXTURE.day,
      FIXTURE.hour,
      FIXTURE.minute,
      FIXTURE.second,
      FIXTURE.lat,
      FIXTURE.lonEast,
      FIXTURE.houseSystem,
    )

    const ctx = interpretationContext(chart)
    expect(ctx.atoms).toBeDefined()
    expect(ctx.atoms.length).toBeGreaterThan(0)

    const sunPlacement = ctx.atoms.find(
      (a) => a.kind === 'placement' && a.id.includes('sun'),
    )
    expect(sunPlacement).toBeDefined()
    expect(sunPlacement!.text).toBeDefined()
  })

  it('julianDay returns a valid JD for the fixture', () => {
    const jd = julianDay(
      FIXTURE.year,
      FIXTURE.month,
      FIXTURE.day,
      FIXTURE.hour,
      FIXTURE.minute,
      FIXTURE.second,
    )
    expect(jd).toBeGreaterThan(2400000)
    expect(jd).toBeLessThan(2500000)
    expect(Number.isFinite(jd)).toBe(true)
  })
})
