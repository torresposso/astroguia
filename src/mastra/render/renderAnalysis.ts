import type { AnalysisSection } from '../types/index.js'

const SECTION_TITLES: Record<string, string> = {
  'chart-data': 'Chart Data',
  pluto: 'Pluto',
  'nodal-axis': 'Nodal Axis',
  saturn: 'Saturn',
  'tense-aspects': 'Tense Aspects',
  'water-houses': 'Water Houses',
  timing: 'Timing',
  synthesis: 'Synthesis',
}

export function renderAnalysis(
  sections: AnalysisSection[],
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const section of sections) {
    const title = SECTION_TITLES[section.id] ?? section.id
    result[section.id] = `## ${title}\n\n${section.body}\n`
  }
  return result
}
