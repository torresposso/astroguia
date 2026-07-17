import type { AnalysisSection, ProvenanceBlock } from '../types/index.js'

const SECTION_ORDER: Array<{ id: string; title: string }> = [
  { id: 'chart-data', title: 'Chart Data' },
  { id: 'pluto', title: 'Pluto' },
  { id: 'nodal-axis', title: 'Nodal Axis' },
  { id: 'saturn', title: 'Saturn' },
  { id: 'tense-aspects', title: 'Tense Aspects' },
  { id: 'water-houses', title: 'Water Houses' },
  { id: 'timing', title: 'Timing' },
  { id: 'synthesis', title: 'Synthesis' },
]

export interface ReferenceEntry {
  text: string
  salience: number
  source: string
}

export interface RenderReportInput {
  clientName: string
  birth: {
    date: string
    time?: string
    city: string
    lat: number
    lon: number
    timezone?: string
  }
  houseSystem: string
  generatedAt: string
  modelAnalyze: string
  modelSynthesize: string
  analysisSections: AnalysisSection[]
  synthesisOpening: string
  synthesisBody: string
  synthesisCitations: string[]
  provenance: ProvenanceBlock
  referenceMap: Map<string, ReferenceEntry>
}

export interface RenderReportOutput {
  markdown: string
  missingCount: number
}

const CITATION_RE = /\[(id|pd):([^\]]+)\]/g

function sourceLabel(prefix: string): string {
  return prefix === 'id' ? 'Caelus' : 'PD'
}

function processCitations(
  body: string,
  referenceMap: Map<string, ReferenceEntry>,
): { text: string; found: Set<string>; missing: string[] } {
  const found = new Set<string>()
  const missing: string[] = []

  const processed = body.replace(CITATION_RE, (match, prefix: string, key: string) => {
    const fullKey = `${prefix}:${key}`
    if (referenceMap.has(fullKey)) {
      found.add(fullKey)
      return match
    }
    missing.push(fullKey)
    return `[⚠ missing: ${fullKey}]`
  })

  return { text: processed, found, missing }
}

function buildYaml(input: RenderReportInput): string {
  const b = input.birth
  const lines = [
    '---',
    `client_name: ${JSON.stringify(input.clientName)}`,
    'birth:',
    `  date: ${JSON.stringify(b.date)}`,
  ]
  if (b.time !== undefined) {
    lines.push(`  time: ${JSON.stringify(b.time)}`)
  }
  lines.push(
    `  city: ${JSON.stringify(b.city)}`,
    `  lat: ${b.lat}`,
    `  lon: ${b.lon}`,
  )
  if (b.timezone !== undefined) {
    lines.push(`  timezone: ${JSON.stringify(b.timezone)}`)
  }
  lines.push(
    `house_system: ${JSON.stringify(input.houseSystem)}`,
    `generated_at: ${JSON.stringify(input.generatedAt)}`,
    `model_analyze: ${JSON.stringify(input.modelAnalyze)}`,
    `model_synthesize: ${JSON.stringify(input.modelSynthesize)}`,
    'provenance:',
    `  houseSystemRequested: ${JSON.stringify(input.provenance.houseSystemRequested)}`,
    `  houseSystemActual: ${JSON.stringify(input.provenance.houseSystemActual)}`,
    `  birthStatus: ${JSON.stringify(input.provenance.birthStatus)}`,
    '---',
  )
  return lines.join('\n') + '\n'
}

function buildSectionMarkdown(id: string, title: string, body: string): string {
  return `## ${title}\n\n${body}\n`
}

function buildReferenceTable(
  citationKeys: Set<string>,
  referenceMap: Map<string, ReferenceEntry>,
): string {
  const resolved = [...citationKeys].filter((key) => referenceMap.has(key)).sort()
  if (resolved.length === 0) return ''

  const rows = resolved.map((key) => {
    const entry = referenceMap.get(key)!
    const prefix = key.startsWith('id:') ? 'id' : key.startsWith('pd:') ? 'pd' : ''
    const source = entry.source || sourceLabel(prefix)
    const salience = entry.salience.toFixed(1)
    return `| \`${key}\` | ${entry.text} | ${salience} | ${source} |`
  })

  const header = '| ID | Text | Salience | Source |\n|----|------|----------|--------|'
  return `## References\n\n${header}\n${rows.join('\n')}\n`
}

export function renderReport(input: RenderReportInput): RenderReportOutput {
  const allMissing: string[] = []
  const allFound = new Set<string>()

  const sectionBodies = new Map<string, string>()

  for (const s of input.analysisSections) {
    const { text, found, missing } = processCitations(s.body, input.referenceMap)
    sectionBodies.set(s.id, text)
    for (const f of found) allFound.add(f)
    allMissing.push(...missing)
  }
  for (const c of input.analysisSections.flatMap((s) => s.citations)) {
    allFound.add(c)
  }

  const synthBody = [input.synthesisOpening, input.synthesisBody]
    .filter(Boolean)
    .join('\n\n')
  const { text: processedSynth, found: synthFound, missing: synthMissing } =
    processCitations(synthBody, input.referenceMap)
  for (const f of synthFound) allFound.add(f)
  allMissing.push(...synthMissing)
  for (const c of input.synthesisCitations) {
    allFound.add(c)
  }

  const sectionMap = new Map(input.analysisSections.map((s) => [s.id, s]))
  let markdown = buildYaml(input) + '\n'

  markdown += `# Astrological Report for ${input.clientName}\n\n`

  for (const sec of SECTION_ORDER) {
    if (sec.id === 'synthesis') {
      markdown += buildSectionMarkdown(sec.id, sec.title, processedSynth) + '\n'
    } else {
      const body = sectionBodies.get(sec.id)
      if (body !== undefined) {
        markdown += buildSectionMarkdown(sec.id, sec.title, body) + '\n'
      }
    }
  }

  markdown += buildReferenceTable(allFound, input.referenceMap)

  return { markdown, missingCount: allMissing.length }
}
