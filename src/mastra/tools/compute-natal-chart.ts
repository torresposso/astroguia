import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { Engine, interpretationContext } from 'caelus'
import { embeddedData } from 'caelus/data-embedded'
import { localToChart } from 'caelus-birth'

export const computeNatalChart = createTool({
  id: 'compute_natal_chart',
  description: 'Computes a natal astrology chart from birth date, time, and location. Call this when the user provides their birth data.',
  inputSchema: z.object({
    date: z.string().describe('Birth date in YYYY-MM-DD format, e.g. 1990-06-10'),
    time: z.string().describe('Birth time in HH:MM format (24-hour), e.g. 14:30'),
    lat: z.number().describe('Birth latitude (north positive, negative for south), e.g. 27.95 for Tampa'),
    lon: z.number().describe('Birth longitude (east positive, negative for west — Americas are negative), e.g. -82.46 for Tampa'),
    houseSystem: z.enum(['placidus', 'whole_sign', 'koch']).optional(),
  }),
  execute: async ({ date, time, lat, lon, houseSystem }) => {
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    const engine = new Engine(embeddedData)
    const result = localToChart({ year: y, month: m, day: d, hour: hh, minute: mm, lat, lon }, engine, houseSystem ?? 'placidus')
    const ctx = interpretationContext(result.chart)

    const bodies: Record<string, { lon: number; sign: string; signDeg: number; house: number | null; retrograde: boolean }> = {}
    for (const [key, body] of Object.entries(result.chart.bodies)) {
      if (!body) continue
      bodies[key] = {
        lon: Number(body.lon.toFixed(4)),
        sign: body.sign as string,
        signDeg: Number(body.signDeg.toFixed(4)),
        house: ((body as { house?: number }).house ?? null),
        retrograde: ((body as { retrograde?: boolean }).retrograde ?? false),
      }
    }

    return {
      status: result.status,
      zone: result.zone,
      offsetMinutes: result.offsetMinutes,
      dst: result.dst,
      angles: {
        asc: Number(result.chart.angles.asc.toFixed(4)),
        mc: Number(result.chart.angles.mc.toFixed(4)),
      },
      bodies,
      atoms: ctx.atoms.map((a: { id: string; kind?: string; text: string; salience?: number }) => ({
        id: a.id,
        kind: a.kind ?? '',
        text: a.text,
        salience: a.salience ?? 0,
      })),
    }
  },
})
