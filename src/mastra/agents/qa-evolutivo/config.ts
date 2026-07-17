import { agentConfig } from '@mastra/core/agent'

export default agentConfig({
  model: 'openai/gpt-5.5',
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
