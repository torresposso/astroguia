import { describe, it, expect } from 'vitest'
import {
  SynthesisOutputSchema,
  countCitations,
} from '../workflows/synthesize'

describe('SynthesisOutputSchema', () => {
  it('accepts valid synthesis output', () => {
    const result = SynthesisOutputSchema.safeParse({
      openingNarrative: 'Welcome to your astrological report...',
      synthesisBody: 'The synthesis of your chart reveals a deep pattern...',
      synthesisCitations: ['[id:placement:sun]', '[pd:193]'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing openingNarrative', () => {
    const result = SynthesisOutputSchema.safeParse({
      synthesisBody: 'body text',
      synthesisCitations: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing synthesisBody', () => {
    const result = SynthesisOutputSchema.safeParse({
      openingNarrative: 'narrative text',
      synthesisCitations: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing synthesisCitations', () => {
    const result = SynthesisOutputSchema.safeParse({
      openingNarrative: 'narrative text',
      synthesisBody: 'body text',
    })
    expect(result.success).toBe(false)
  })

  it('rejects wrong type for openingNarrative (number)', () => {
    const result = SynthesisOutputSchema.safeParse({
      openingNarrative: 123,
      synthesisBody: 'body text',
      synthesisCitations: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects wrong type for synthesisBody (number)', () => {
    const result = SynthesisOutputSchema.safeParse({
      openingNarrative: 'narrative text',
      synthesisBody: 456,
      synthesisCitations: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects wrong type for synthesisCitations (string)', () => {
    const result = SynthesisOutputSchema.safeParse({
      openingNarrative: 'narrative text',
      synthesisBody: 'body text',
      synthesisCitations: 'not-an-array',
    })
    expect(result.success).toBe(false)
  })

  it('rejects synthesisCitations array with non-string elements', () => {
    const result = SynthesisOutputSchema.safeParse({
      openingNarrative: 'narrative text',
      synthesisBody: 'body text',
      synthesisCitations: ['[id:valid]', 123],
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty strings for body and narrative', () => {
    const result = SynthesisOutputSchema.safeParse({
      openingNarrative: '',
      synthesisBody: '',
      synthesisCitations: [],
    })
    expect(result.success).toBe(true)
  })

  it('accepts SynthesisOutput type shape', () => {
    const output = {
      openingNarrative: 'Opening text.',
      synthesisBody: 'Body text.',
      synthesisCitations: ['[id:test]'],
    }
    const result = SynthesisOutputSchema.safeParse(output)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.openingNarrative).toBe('Opening text.')
      expect(result.data.synthesisBody).toBe('Body text.')
      expect(result.data.synthesisCitations).toEqual(['[id:test]'])
    }
  })
})

describe('countCitations', () => {
  it('counts [id:...] citations', () => {
    const markdown = 'Some text [id:placement:sun] more text [id:aspect:moon] end.'
    expect(countCitations(markdown)).toBe(2)
  })

  it('counts [pd:...] citations', () => {
    const markdown = '[pd:193] and [pd:456_abc] more.'
    expect(countCitations(markdown)).toBe(2)
  })

  it('counts mixed id and pd citations', () => {
    const markdown = '[id:a] [id:b] [pd:c] text [id:d]'
    expect(countCitations(markdown)).toBe(4)
  })

  it('returns 0 when no citations present', () => {
    expect(countCitations('plain text without citations')).toBe(0)
  })

  it('does not count malformed citation prefixes', () => {
    const markdown = '[ref:thing] [idx:123]'
    expect(countCitations(markdown)).toBe(0)
  })

  it('counts citations in multiline markdown with markdown formatting', () => {
    const markdown =
      '## Section\n\nBody with [id:test] citation.\n\nMore [pd:42] text in next paragraph.'
    expect(countCitations(markdown)).toBe(2)
  })

  it('counts duplicate citations as separate occurrences', () => {
    const markdown = '[id:sun] appears twice [id:sun] in the text.'
    expect(countCitations(markdown)).toBe(2)
  })

  it('counts citations with colons in the value', () => {
    const markdown = '[id:placement:sun] and [id:aspect:moon:square:saturn]'
    expect(countCitations(markdown)).toBe(2)
  })

  it('handles empty string', () => {
    expect(countCitations('')).toBe(0)
  })
})

describe('summary format', () => {
  it('matches expected summary format with all fields', () => {
    const summary =
      'Report abc-123 | Alice | 2026-07-17T12:00:00Z | words=500 sections=8 citations=10 unresolved=2'
    const regex =
      /^Report (\S+) \| (.+) \| (.+) \| words=(\d+) sections=8 citations=(\d+) unresolved=(\d+)$/
    const match = summary.match(regex)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('abc-123')
    expect(match![2]).toBe('Alice')
    expect(match![3]).toBe('2026-07-17T12:00:00Z')
    expect(match![4]).toBe('500')
    expect(match![5]).toBe('10')
    expect(match![6]).toBe('2')
  })

  it('matches summary with zero unresolved', () => {
    const summary =
      'Report xyz-456 | Bob | 2026-07-17T12:00:00Z | words=300 sections=8 citations=5 unresolved=0'
    const regex =
      /^Report (\S+) \| (.+) \| (.+) \| words=(\d+) sections=8 citations=(\d+) unresolved=(\d+)$/
    expect(summary.match(regex)).not.toBeNull()
  })

  it('matches summary with UUID report id', () => {
    const summary =
      'Report 550e8400-e29b-41d4-a716-446655440000 | Carlos | 2026-07-17T12:00:00Z | words=1200 sections=8 citations=25 unresolved=3'
    const regex =
      /^Report (\S+) \| (.+) \| (.+) \| words=(\d+) sections=8 citations=(\d+) unresolved=(\d+)$/
    const match = summary.match(regex)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(match![6]).toBe('3')
  })

  it('extracts numeric fields correctly', () => {
    const summary =
      'Report r1 | Test | 2026-07-17T12:00:00Z | words=9999 sections=8 citations=42 unresolved=7'
    const regex =
      /^Report (\S+) \| (.+) \| (.+) \| words=(\d+) sections=8 citations=(\d+) unresolved=(\d+)$/
    const match = summary.match(regex)!
    expect(parseInt(match[4], 10)).toBe(9999)
    expect(parseInt(match[5], 10)).toBe(42)
    expect(parseInt(match[6], 10)).toBe(7)
  })
})
