import { z } from 'zod/v4'
import { createStep } from '@mastra/core/workflows'
import { Engine, interpretationContext, julianDay, isDayChart } from 'caelus'
import { embeddedData } from 'caelus/data-embedded'
import { firdaria } from 'caelus'
import { profectionAt } from 'caelus'
import { primaryDirections } from 'caelus'
import type { NatalInput, CollectedData, ProvenanceBlock } from '../types'

const NatalInputSchema = z.object({
  date: z.string(),
  time: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
  timezone: z.string().optional(),
  house_system: z.enum(['placidus', 'whole_sign', 'koch']).optional(),
})

const CollectedDataSchema = z.object({
  chartFacts: z.any(),
  firdaria: z.any(),
  profections: z.any(),
  provenance: z.object({
    houseSystemRequested: z.string(),
    houseSystemActual: z.string(),
    birthStatus: z.enum(['exact', 'approximate', 'unknown']),
  }),
})

function parseDate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m, day: d }
}

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number)
  return { hour: h, minute: m }
}

function getTimezoneOffsetMinutes(epochMs: number, timezone: string): number {
  const toParts = (tz: string) => {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    const parts = fmt.formatToParts(new Date(epochMs))
    const vals: Record<string, number> = {}
    for (const p of parts) {
      if (p.type !== 'literal') vals[p.type] = parseInt(p.value)
    }
    return vals
  }

  const utc = toParts('UTC')
  const tz = toParts(timezone)

  const utcMinutes = utc.hour * 60 + utc.minute
  const tzMinutes = tz.hour * 60 + tz.minute
  const dayDiff = (tz.day - utc.day) * 24 * 60

  let offset = tzMinutes - utcMinutes + dayDiff
  if (offset > 720) offset -= 1440
  if (offset < -720) offset += 1440

  return offset
}

function resolveUT(input: NatalInput): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const { year, month, day } = parseDate(input.date)
  const { hour, minute } = input.time
    ? parseTime(input.time)
    : { hour: 12, minute: 0 }

  if (!input.timezone) {
    return { year, month, day, hour, minute, second: 0 }
  }

  const epochMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offsetMin = getTimezoneOffsetMinutes(epochMs, input.timezone)
  const utcMs = epochMs - offsetMin * 60 * 1000
  const utcDate = new Date(utcMs)

  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
    hour: utcDate.getUTCHours(),
    minute: utcDate.getUTCMinutes(),
    second: utcDate.getUTCSeconds(),
  }
}

export const collectStep = createStep({
  id: 'collect',
  description:
    'Collects natal chart, firdaria, profections, and primary directions from Caelus. Zero LLM.',
  inputSchema: NatalInputSchema,
  outputSchema: CollectedDataSchema,
  execute: async ({ inputData }) => {
    const input = inputData as NatalInput
    const ut = resolveUT(input)
    const jd = julianDay(
      ut.year,
      ut.month,
      ut.day,
      ut.hour,
      ut.minute,
      ut.second,
    )

    const engine = new Engine(embeddedData)
    const houseSystemRequested = input.house_system ?? 'placidus'
    const lonEast = input.lon

    const chart = engine.chart(
      ut.year,
      ut.month,
      ut.day,
      ut.hour,
      ut.minute,
      ut.second,
      input.lat,
      lonEast,
      houseSystemRequested,
    )

    const day = isDayChart(engine, jd, input.lat, lonEast)

    const [chartFacts, firdariaData, profectionData, _directions] =
      await Promise.all([
        Promise.resolve(interpretationContext(chart)),
        Promise.resolve(firdaria(day, jd)),
        Promise.resolve(
          profectionAt(engine, jd, jd, input.lat, lonEast),
        ),
        Promise.resolve(
          primaryDirections(engine, jd, input.lat, lonEast),
        ),
      ])

    const birthStatus: ProvenanceBlock['birthStatus'] = input.time
      ? 'exact'
      : 'unknown'

    return {
      chartFacts,
      firdaria: firdariaData,
      profections: profectionData,
      provenance: {
        houseSystemRequested,
        houseSystemActual: chart.houseSystem,
        birthStatus,
      },
    } satisfies CollectedData
  },
})
