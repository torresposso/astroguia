import { describe, it, expect } from 'vitest'
import { renderAnalysis, renderReport } from '../render/index.js'
import type { RenderReportInput, ReferenceEntry } from '../render/renderReport.js'
import type { AnalysisSection, ProvenanceBlock } from '../types/index.js'

function makeSection(id: string, body: string, citations: string[] = []): AnalysisSection {
  return { id, body, citations }
}

const MOCK_PROVENANCE: ProvenanceBlock = {
  houseSystemRequested: 'placidus',
  houseSystemActual: 'placidus',
  birthStatus: 'exact',
}

describe('renderAnalysis', () => {
  it('renders known sections with correct titles', () => {
    const sections: AnalysisSection[] = [
      makeSection('chart-data', 'Chart data body'),
      makeSection('pluto', 'Pluto analysis body'),
      makeSection('nodal-axis', 'Nodal axis body'),
    ]
    const result = renderAnalysis(sections)
    expect(result['chart-data']).toBe('## Chart Data\n\nChart data body\n')
    expect(result['pluto']).toBe('## Pluto\n\nPluto analysis body\n')
    expect(result['nodal-axis']).toBe('## Nodal Axis\n\nNodal axis body\n')
  })

  it('uses section id as title for unknown sections', () => {
    const sections: AnalysisSection[] = [
      makeSection('custom-topic', 'Some custom body'),
    ]
    const result = renderAnalysis(sections)
    expect(result['custom-topic']).toBe('## custom-topic\n\nSome custom body\n')
  })

  it('handles empty body', () => {
    const sections: AnalysisSection[] = [makeSection('saturn', '')]
    const result = renderAnalysis(sections)
    expect(result['saturn']).toBe('## Saturn\n\n\n')
  })

  it('handles empty sections array', () => {
    const result = renderAnalysis([])
    expect(result).toEqual({})
  })

  it('preserves markdown formatting in body', () => {
    const body = '**bold** and _italic_\n\n- list item\n- another'
    const sections: AnalysisSection[] = [makeSection('water-houses', body)]
    const result = renderAnalysis(sections)
    expect(result['water-houses']).toContain('**bold**')
    expect(result['water-houses']).toContain('- list item')
  })

  it('renders all 8 known section titles', () => {
    const sections: AnalysisSection[] = [
      makeSection('chart-data', 'a'),
      makeSection('pluto', 'b'),
      makeSection('nodal-axis', 'c'),
      makeSection('saturn', 'd'),
      makeSection('tense-aspects', 'e'),
      makeSection('water-houses', 'f'),
      makeSection('timing', 'g'),
      makeSection('synthesis', 'h'),
    ]
    const result = renderAnalysis(sections)
    expect(result['chart-data']).toContain('## Chart Data')
    expect(result['pluto']).toContain('## Pluto')
    expect(result['nodal-axis']).toContain('## Nodal Axis')
    expect(result['saturn']).toContain('## Saturn')
    expect(result['tense-aspects']).toContain('## Tense Aspects')
    expect(result['water-houses']).toContain('## Water Houses')
    expect(result['timing']).toContain('## Timing')
    expect(result['synthesis']).toContain('## Synthesis')
  })
})

function makeInput(overrides: Partial<RenderReportInput> = {}): RenderReportInput {
  return {
    clientName: 'Alice',
    birth: {
      date: '1990-06-10',
      time: '14:30',
      city: 'Tampa',
      lat: 27.95,
      lon: -82.46,
      timezone: 'America/New_York',
    },
    houseSystem: 'placidus',
    generatedAt: '2026-07-17T12:00:00Z',
    modelAnalyze: 'deepseek-v4-pro',
    modelSynthesize: 'deepseek-v4',
    analysisSections: [
      makeSection('chart-data', 'Sun in Gemini.\n[id:placement:sun]', ['id:placement:sun']),
      makeSection('pluto', 'Pluto in Scorpio.\n[id:placement:pluto]', ['id:placement:pluto']),
      makeSection('nodal-axis', 'North Node in Capricorn.', []),
      makeSection('saturn', 'Saturn in Aquarius. [id:aspect:saturn]', ['id:aspect:saturn']),
      makeSection('tense-aspects', 'T-square involving Mars. [id:aspect:mars] and [pd:193]', [
        'id:aspect:mars',
        'pd:193',
      ]),
      makeSection('water-houses', 'Moon in 4th house. [id:placement:moon]', [
        'id:placement:moon',
      ]),
      makeSection('timing', 'Firdaria period active.', []),
    ],
    synthesisOpening: 'This is an opening narrative.',
    synthesisBody: 'Synthesis body text.\n[id:placement:sun] [id:placement:moon]',
    synthesisCitations: ['id:placement:sun', 'id:placement:moon'],
    provenance: MOCK_PROVENANCE,
    referenceMap: new Map<string, ReferenceEntry>([
      ['id:placement:sun', { text: 'Sun in Gemini', salience: 0.9, source: 'Caelus' }],
      ['id:placement:pluto', { text: 'Pluto in Scorpio', salience: 0.8, source: 'Caelus' }],
      ['id:placement:moon', { text: 'Moon in 4th house', salience: 0.7, source: 'Caelus' }],
      ['id:aspect:saturn', { text: 'Saturn square Mercury', salience: 0.6, source: 'Caelus' }],
      ['id:aspect:mars', { text: 'Mars opposition Jupiter', salience: 0.5, source: 'Caelus' }],
      ['pd:193', { text: 'PD passage about T-square', salience: 0.4, source: 'PD' }],
    ]),
    ...overrides,
  }
}

describe('renderReport', () => {
  it('produces full markdown with 8 sections in fixed order', () => {
    const input = makeInput()
    const { markdown, missingCount } = renderReport(input)

    expect(missingCount).toBe(0)

    const sectionPositions = [
      'Chart Data',
      'Pluto',
      'Nodal Axis',
      'Saturn',
      'Tense Aspects',
      'Water Houses',
      'Timing',
      'Synthesis',
    ].map((title) => markdown.indexOf(`## ${title}`))

    for (let i = 1; i < sectionPositions.length; i++) {
      expect(sectionPositions[i]).toBeGreaterThan(sectionPositions[i - 1])
    }
  })

  it('includes YAML frontmatter with all fields', () => {
    const input = makeInput()
    const { markdown } = renderReport(input)

    expect(markdown).toContain('---')
    expect(markdown).toContain('client_name: "Alice"')
    expect(markdown).toContain('date: "1990-06-10"')
    expect(markdown).toContain('time: "14:30"')
    expect(markdown).toContain('city: "Tampa"')
    expect(markdown).toContain('lat: 27.95')
    expect(markdown).toContain('lon: -82.46')
    expect(markdown).toContain('timezone: "America/New_York"')
    expect(markdown).toContain('house_system: "placidus"')
    expect(markdown).toContain('generated_at: "2026-07-17T12:00:00Z"')
    expect(markdown).toContain('model_analyze: "deepseek-v4-pro"')
    expect(markdown).toContain('model_synthesize: "deepseek-v4"')
    expect(markdown).toContain('houseSystemRequested: "placidus"')
    expect(markdown).toContain('houseSystemActual: "placidus"')
    expect(markdown).toContain('birthStatus: "exact"')
  })

  it('includes reference table with sorted citations', () => {
    const input = makeInput()
    const { markdown } = renderReport(input)

    expect(markdown).toContain('## References')
    expect(markdown).toContain('| ID | Text | Salience | Source |')
    expect(markdown).toContain('| `id:aspect:mars` | Mars opposition Jupiter | 0.5 | Caelus |')
    expect(markdown).toContain('| `id:aspect:saturn` | Saturn square Mercury | 0.6 | Caelus |')
    expect(markdown).toContain('| `id:placement:moon` | Moon in 4th house | 0.7 | Caelus |')
    expect(markdown).toContain('| `id:placement:pluto` | Pluto in Scorpio | 0.8 | Caelus |')
    expect(markdown).toContain('| `id:placement:sun` | Sun in Gemini | 0.9 | Caelus |')
    expect(markdown).toContain('| `pd:193` | PD passage about T-square | 0.4 | PD |')

    const refIndex = markdown.indexOf('## References')
    const sortedRefs = markdown.slice(refIndex)
    const plutoIdx = sortedRefs.indexOf('id:placement:pluto')
    const sunIdx = sortedRefs.indexOf('id:placement:sun')
    expect(plutoIdx).toBeLessThan(sunIdx)
  })

  it('handles empty analysis sections array', () => {
    const input = makeInput({
      analysisSections: [],
      synthesisOpening: 'Opening.',
      synthesisBody: 'Body.',
      synthesisCitations: [],
    })
    const { markdown, missingCount } = renderReport(input)

    expect(missingCount).toBe(0)
    expect(markdown).toContain('# Astrological Report for Alice')
    expect(markdown).toContain('## Synthesis')
    expect(markdown).toContain('Opening.')
    expect(markdown).toContain('Body.')

    for (const sec of [
      'Chart Data',
      'Pluto',
      'Nodal Axis',
      'Saturn',
      'Tense Aspects',
      'Water Houses',
      'Timing',
    ]) {
      expect(markdown).not.toContain(`## ${sec}\n`)
    }
  })

  it('detects and counts missing citations', () => {
    const input = makeInput({
      analysisSections: [
        makeSection('chart-data', '[id:placement:sun] [id:nonexistent]', [
          'id:placement:sun',
          'id:nonexistent',
        ]),
      ],
      synthesisOpening: '',
      synthesisBody: '',
      synthesisCitations: [],
      referenceMap: new Map([
        ['id:placement:sun', { text: 'Sun in Gemini', salience: 0.9, source: 'Caelus' }],
      ]),
    })
    const { markdown, missingCount } = renderReport(input)

    expect(missingCount).toBe(1)
    expect(markdown).toContain('[⚠ missing: id:nonexistent]')
    expect(markdown).toContain('[id:placement:sun]')
    expect(markdown).not.toContain('[⚠ missing: id:placement:sun]')
  })

  it('replaces multiple missing citations with warning markers', () => {
    const input = makeInput({
      analysisSections: [
        makeSection(
          'saturn',
          '[id:missing1] and [pd:missing2] and [id:nope:three]',
          [],
        ),
      ],
      synthesisOpening: '',
      synthesisBody: '',
      synthesisCitations: [],
      referenceMap: new Map(),
    })
    const { markdown, missingCount } = renderReport(input)

    expect(missingCount).toBe(3)
    expect(markdown).toContain('[⚠ missing: id:missing1]')
    expect(markdown).toContain('[⚠ missing: pd:missing2]')
    expect(markdown).toContain('[⚠ missing: id:nope:three]')
  })

  it('handles all citations missing', () => {
    const input = makeInput({
      analysisSections: [
        makeSection('pluto', '[id:a] [id:b] [pd:c]', ['id:a', 'id:b', 'pd:c']),
      ],
      synthesisOpening: '',
      synthesisBody: '',
      synthesisCitations: [],
      referenceMap: new Map(),
    })
    const { markdown, missingCount } = renderReport(input)

    expect(missingCount).toBe(3)
    expect(markdown).toContain('[⚠ missing: id:a]')
    expect(markdown).toContain('[⚠ missing: id:b]')
    expect(markdown).toContain('[⚠ missing: pd:c]')

    expect(markdown).not.toContain('## References')
  })

  it('handles no citations at all', () => {
    const input = makeInput({
      analysisSections: [
        makeSection('timing', 'Just plain text. No citations here.', []),
      ],
      synthesisOpening: 'Opening.',
      synthesisBody: 'Synthesis without citations.',
      synthesisCitations: [],
      referenceMap: new Map(),
    })
    const { markdown, missingCount } = renderReport(input)

    expect(missingCount).toBe(0)
    expect(markdown).not.toContain('[⚠ missing:')
    expect(markdown).not.toContain('## References')
  })

  it('counts missing citations from synthesis body', () => {
    const input = makeInput({
      analysisSections: [],
      synthesisOpening: '',
      synthesisBody: '[id:missing_synth] text',
      synthesisCitations: [],
      referenceMap: new Map(),
    })
    const { markdown, missingCount } = renderReport(input)

    expect(missingCount).toBe(1)
    expect(markdown).toContain('[⚠ missing: id:missing_synth]')
  })

  it('returns zero missingCount when all citations resolve', () => {
    const input = makeInput()
    const { missingCount } = renderReport(input)
    expect(missingCount).toBe(0)
  })

  it('renders opening narrative before synthesis body', () => {
    const input = makeInput({
      analysisSections: [],
      synthesisOpening: 'FIRST PARAGRAPH',
      synthesisBody: 'SECOND PARAGRAPH',
      synthesisCitations: [],
    })
    const { markdown } = renderReport(input)

    const synthIdx = markdown.indexOf('## Synthesis')
    const firstIdx = markdown.indexOf('FIRST PARAGRAPH')
    const secondIdx = markdown.indexOf('SECOND PARAGRAPH')

    expect(synthIdx).toBeGreaterThan(0)
    expect(firstIdx).toBeGreaterThan(synthIdx)
    expect(secondIdx).toBeGreaterThan(firstIdx)
  })

  it('handles birth without time and timezone', () => {
    const input = makeInput({
      birth: {
        date: '1990-01-01',
        city: 'Unknown',
        lat: 0,
        lon: 0,
      },
    })
    const { markdown } = renderReport(input)

    expect(markdown).toContain('date: "1990-01-01"')
    expect(markdown).not.toContain('time:')
    expect(markdown).not.toContain('timezone:')
  })

  it('renders report title with client name', () => {
    const input = makeInput({ clientName: 'Bob' })
    const { markdown } = renderReport(input)
    expect(markdown).toContain('# Astrological Report for Bob')
  })

  it('omits sections from analysis that are not in the fixed 8-section order', () => {
    const input = makeInput({
      analysisSections: [
        makeSection('chart-data', 'Chart body'),
        makeSection('extra-topic', 'Extra body that should not appear'),
        makeSection('pluto', 'Pluto body'),
      ],
      synthesisBody: 'Synth body',
      synthesisCitations: [],
    })
    const { markdown } = renderReport(input)

    expect(markdown).toContain('## Chart Data')
    expect(markdown).toContain('## Pluto')
    expect(markdown).not.toContain('## extra-topic')
  })
})
