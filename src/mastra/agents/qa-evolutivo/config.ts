import { agentConfig } from '@mastra/core/agent'

export default agentConfig({
  model: 'opencode/hy3-free',
  defaultOptions: {
    activeTools: [
      'chart_facts',
      'natal_chart',
      'transits',
      'aspect_patterns',
      'firdaria',
      'profections',
      'dignities',
      'sky_events',
      'chart_signature',
      'returns',
      'progressions',
      'find_aspect_dates',
      'cosmic_weather',
      'releasing',
    ],
  },
})
