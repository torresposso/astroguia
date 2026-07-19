import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { openMeteoGeocoder } from 'caelus-birth/geocode'

export const geocodeCity = createTool({
  id: 'geocode_city',
  description: 'Resolves a city or place name to geographic coordinates (latitude, longitude) and timezone. Call this when the user provides a city name instead of raw coordinates.',
  inputSchema: z.object({
    city: z.string().describe('City or place name to geocode, e.g. "Tampa, Florida" or "Buenos Aires, Argentina"'),
  }),
  execute: async ({ city }) => {
    const results = await openMeteoGeocoder.search(city)
    return {
      query: city,
      results: results.map(r => ({
        name: r.name,
        lat: r.lat,
        lon: r.lon,
        timezone: r.timezone ?? null,
        country: r.country ?? null,
        admin1: r.admin1 ?? null,
      })),
    }
  },
})
