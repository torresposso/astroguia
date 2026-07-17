import { describe, it, expect } from 'vitest'
import {
  AnalysisSectionSchema,
  AnalysisSchema,
  quickCheckSectionPresence,
  quickCheckCitationFormat,
  validateAnalysis,
  readCorpusFile,
} from '../workflows/analyze'
import type { AnalysisSection, Analysis } from '../types'

function makeSection(
  id: string,
  body = 'test body',
  citations: string[] = [],
): AnalysisSection {
  return { id, body, citations }
}

describe('AnalysisSectionSchema', () => {
  it('accepts a valid analysis section', () => {
    const result = AnalysisSectionSchema.safeParse({
      id: 'pluto',
      body: 'Pluto in Scorpio.',
      citations: ['id:placement:pluto'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = AnalysisSectionSchema.safeParse({ id: 'pluto' })
    expect(result.success).toBe(false)
  })

  it('rejects wrong type for body', () => {
    const result = AnalysisSectionSchema.safeParse({
      id: 'pluto',
      body: 123,
      citations: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects wrong type for citations', () => {
    const result = AnalysisSectionSchema.safeParse({
      id: 'pluto',
      body: 'text',
      citations: 'not-an-array',
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty citations array', () => {
    const result = AnalysisSectionSchema.safeParse({
      id: 'nodal-axis',
      body: 'North Node analysis.',
      citations: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('AnalysisSchema', () => {
  it('accepts exactly 8 valid sections', () => {
    const sections = [
      'chart-data',
      'pluto',
      'nodal-axis',
      'saturn',
      'tense-aspects',
      'water-houses',
      'timing',
      'synthesis',
    ].map((id) => makeSection(id, `${id} body`, [`id:${id}`]))

    const result = AnalysisSchema.safeParse({ sections })
    expect(result.success).toBe(true)
  })

  it('rejects fewer than 8 sections', () => {
    const sections = [makeSection('pluto', 'body')]
    const result = AnalysisSchema.safeParse({ sections })
    expect(result.success).toBe(false)
  })

  it('rejects more than 8 sections', () => {
    const sections = Array.from({ length: 10 }, (_, i) =>
      makeSection(`section-${i}`, 'body'),
    )
    const result = AnalysisSchema.safeParse({ sections })
    expect(result.success).toBe(false)
  })

  it('rejects empty sections array', () => {
    const result = AnalysisSchema.safeParse({ sections: [] })
    expect(result.success).toBe(false)
  })

  it('rejects invalid section shape (missing id)', () => {
    const sections = Array.from({ length: 8 }, (_, i) => ({
      body: 'body',
      citations: [],
    }))
    const result = AnalysisSchema.safeParse({ sections })
    expect(result.success).toBe(false)
  })

  it('accepts Analysis type shape', () => {
    const analysis: Analysis = {
      sections: [
        'chart-data',
        'pluto',
        'nodal-axis',
        'saturn',
        'tense-aspects',
        'water-houses',
        'timing',
        'synthesis',
      ].map((id) => ({ id, body: `${id} body`, citations: [] })),
    }
    const result = AnalysisSchema.safeParse(analysis)
    expect(result.success).toBe(true)
  })
})

describe('quickCheckSectionPresence', () => {
  it('returns empty array when all 8 sections are present', () => {
    const sections = [
      'chart-data',
      'pluto',
      'nodal-axis',
      'saturn',
      'tense-aspects',
      'water-houses',
      'timing',
      'synthesis',
    ].map((id) => makeSection(id))
    expect(quickCheckSectionPresence(sections)).toEqual([])
  })

  it('returns missing sections when some are absent', () => {
    const sections = [
      makeSection('pluto'),
      makeSection('saturn'),
      makeSection('timing'),
    ]
    const missing = quickCheckSectionPresence(sections)
    expect(missing.sort()).toEqual(
      [
        'chart-data',
        'nodal-axis',
        'tense-aspects',
        'water-houses',
        'synthesis',
      ].sort(),
    )
  })

  it('returns all 8 when given empty array', () => {
    expect(quickCheckSectionPresence([])).toHaveLength(8)
  })

  it('returns empty for exactly all 8 in any order', () => {
    const shuffled = [
      makeSection('synthesis'),
      makeSection('timing'),
      makeSection('water-houses'),
      makeSection('tense-aspects'),
      makeSection('saturn'),
      makeSection('nodal-axis'),
      makeSection('pluto'),
      makeSection('chart-data'),
    ]
    expect(quickCheckSectionPresence(shuffled)).toEqual([])
  })

  it('ignores extra sections beyond the 8 required', () => {
    const sections = [
      'chart-data',
      'pluto',
      'nodal-axis',
      'saturn',
      'tense-aspects',
      'water-houses',
      'timing',
      'synthesis',
      'extra-section',
    ].map((id) => makeSection(id))
    expect(quickCheckSectionPresence(sections)).toEqual([])
  })
})

describe('quickCheckCitationFormat', () => {
  it('accepts valid [id:...] citations', () => {
    const sections = [
      makeSection('pluto', 'body', ['[id:placement:pluto]', '[id:aspect:pluto]']),
    ]
    expect(quickCheckCitationFormat(sections)).toEqual([])
  })

  it('accepts valid [pd:...] citations', () => {
    const sections = [
      makeSection('saturn', 'body', ['[pd:193]', '[pd:456_abc]']),
    ]
    expect(quickCheckCitationFormat(sections)).toEqual([])
  })

  it('rejects citations without brackets', () => {
    const sections = [makeSection('pluto', 'body', ['id:thing'])]
    expect(quickCheckCitationFormat(sections)).toEqual(['id:thing'])
  })

  it('rejects citations with wrong prefix', () => {
    const sections = [
      makeSection('pluto', 'body', ['[ref:thing]', '[idx:123]']),
    ]
    expect(quickCheckCitationFormat(sections)).toEqual([
      '[ref:thing]',
      '[idx:123]',
    ])
  })

  it('rejects empty citation strings', () => {
    const sections = [makeSection('pluto', 'body', [''])]
    expect(quickCheckCitationFormat(sections)).toEqual([''])
  })

  it('rejects bare brackets', () => {
    const sections = [makeSection('pluto', 'body', ['[]'])]
    expect(quickCheckCitationFormat(sections)).toEqual(['[]'])
  })

  it('rejects brackets with colon but no prefix', () => {
    const sections = [makeSection('pluto', 'body', ['[:something]'])]
    expect(quickCheckCitationFormat(sections)).toEqual(['[:something]'])
  })

  it('handles mixed valid and invalid', () => {
    const sections = [
      makeSection('pluto', 'body', ['[id:valid]', 'invalid', '[pd:ok]']),
    ]
    expect(quickCheckCitationFormat(sections)).toEqual(['invalid'])
  })

  it('returns empty for empty citations array', () => {
    const sections = [makeSection('pluto', 'body', [])]
    expect(quickCheckCitationFormat(sections)).toEqual([])
  })

  it('handles multiple sections', () => {
    const sections = [
      makeSection('pluto', 'body', ['[id:good]']),
      makeSection('saturn', 'body', ['bad', '[pd:good]']),
      makeSection('nodal-axis', 'body', []),
    ]
    expect(quickCheckCitationFormat(sections)).toEqual(['bad'])
  })
})

describe('validateAnalysis', () => {
  it('passes when 8 sections present and all citations valid', () => {
    const sections = [
      'chart-data',
      'pluto',
      'nodal-axis',
      'saturn',
      'tense-aspects',
      'water-houses',
      'timing',
      'synthesis',
    ].map((id) => makeSection(id, 'body', ['[id:test]']))
    expect(validateAnalysis(sections)).toEqual({
      passes: true,
      missingSections: [],
      badCitations: [],
    })
  })

  it('fails when sections missing and citations invalid', () => {
    const sections = [
      makeSection('pluto', 'body', ['bad-citation']),
    ]
    expect(validateAnalysis(sections)).toEqual({
      passes: false,
      missingSections: expect.arrayContaining(['chart-data']),
      badCitations: ['bad-citation'],
    })
  })

  it('fails when only missing sections', () => {
    const sections = [
      makeSection('chart-data', 'body', ['[id:a]']),
      makeSection('pluto', 'body', ['[pd:b]']),
    ]
    const result = validateAnalysis(sections)
    expect(result.passes).toBe(false)
    expect(result.missingSections).toHaveLength(6)
    expect(result.badCitations).toEqual([])
  })

  it('fails when only bad citations', () => {
    const sections = [
      'chart-data',
      'pluto',
      'nodal-axis',
      'saturn',
      'tense-aspects',
      'water-houses',
      'timing',
      'synthesis',
    ].map((id) => makeSection(id, 'body', ['just-a-string']))
    const result = validateAnalysis(sections)
    expect(result.passes).toBe(false)
    expect(result.missingSections).toEqual([])
    expect(result.badCitations).toHaveLength(8)
  })
})

describe('readCorpusFile', () => {
  it('returns empty string for nonexistent corpus file', () => {
    const result = readCorpusFile('nonexistent-section-id')
    expect(result).toBe('')
  })

  it('returns empty string for empty id', () => {
    const result = readCorpusFile('')
    expect(result).toBe('')
  })
})
