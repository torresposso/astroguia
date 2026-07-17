import { describe, it, expect, vi } from 'vitest'
import { Engine, SIGNS } from 'caelus'
import { embeddedData } from 'caelus/data-embedded'
import {
  isExitInput,
  promptFormat,
  computeSunSignGlyph,
  resolveUT,
  formatNatalContext,
} from '../qa-repl.js'

// ---------------------------------------------------------------------------
// isExitInput
// ---------------------------------------------------------------------------

describe('isExitInput', () => {
  it('matches exit', () => {
    expect(isExitInput('exit')).toBe(true)
  })

  it('matches quit', () => {
    expect(isExitInput('quit')).toBe(true)
  })

  it('matches :q', () => {
    expect(isExitInput(':q')).toBe(true)
  })

  it('matches with surrounding whitespace', () => {
    expect(isExitInput('  exit  ')).toBe(true)
  })

  it('rejects regular input', () => {
    expect(isExitInput('What is my sun sign?')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isExitInput('')).toBe(false)
  })

  it('rejects Ctrl-D character', () => {
    // Ctrl-D (0x04) is not an exit command — handled via readline 'close'
    expect(isExitInput('\x04')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// promptFormat
// ---------------------------------------------------------------------------

describe('promptFormat', () => {
  it('formats prompt with glyph', () => {
    expect(promptFormat('maria', ' \u2651')).toBe('[maria \u2651] > ')
  })

  it('formats prompt without glyph', () => {
    expect(promptFormat('maria', '')).toBe('[maria] > ')
  })

  it('formats prompt with different sign', () => {
    expect(promptFormat('juan', ' \u2648')).toBe('[juan \u2648] > ')
  })
})

// ---------------------------------------------------------------------------
// resolveUT
// ---------------------------------------------------------------------------

describe('resolveUT', () => {
  it('returns local time unchanged when no timezone', () => {
    const result = resolveUT({
      date: '1990-06-10',
      time: '14:30',
      lat: 27.95,
      lon: -82.46,
    })
    expect(result.year).toBe(1990)
    expect(result.month).toBe(6)
    expect(result.day).toBe(10)
    expect(result.hour).toBe(14)
    expect(result.minute).toBe(30)
    expect(result.second).toBe(0)
  })

  it('defaults to noon when no time', () => {
    const result = resolveUT({
      date: '1990-06-10',
      lat: 27.95,
      lon: -82.46,
    })
    expect(result.hour).toBe(12)
    expect(result.minute).toBe(0)
  })

  it('converts timezone to UTC', () => {
    // America/New_York is UTC-5 (standard) or UTC-4 (daylight)
    const result = resolveUT({
      date: '1990-06-10',
      time: '14:30',
      lat: 27.95,
      lon: -82.46,
      timezone: 'America/New_York',
    })
    // June 10, 1990: EDT = UTC-4, so 14:30 EDT = 18:30 UTC
    expect(result.year).toBe(1990)
    expect(result.month).toBe(6)
    expect(result.day).toBe(10)
    expect(result.hour).toBe(18)
    expect(result.minute).toBe(30)
  })

  it('handles date rollover with timezone', () => {
    const result = resolveUT({
      date: '1990-06-10',
      time: '02:00',
      lat: 27.95,
      lon: -82.46,
      timezone: 'Europe/Madrid',
    })
    // June 10 02:00 CEST = June 10 00:00 UTC
    expect(result.year).toBe(1990)
    expect(result.month).toBe(6)
    expect(result.day).toBe(10)
    expect(result.hour).toBe(0)
    expect(result.minute).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeSunSignGlyph
// ---------------------------------------------------------------------------

describe('computeSunSignGlyph', () => {
  const FIXTURE: Parameters<typeof computeSunSignGlyph>[0] = {
    date: '1990-06-10',
    time: '14:30',
    lat: 27.95,
    lon: -82.46,
    house_system: 'placidus',
  }

  it('returns a valid Unicode glyph', () => {
    const glyph = computeSunSignGlyph(FIXTURE)
    expect(glyph).toBeTruthy()
    expect(glyph).toHaveLength(1)
    expect('\u2648\u2649\u264A\u264B\u264C\u264D\u264E\u264F\u2650\u2651\u2652\u2653').toContain(glyph!)
  })

  it('returns Gemini glyph for June 10 1990', () => {
    const glyph = computeSunSignGlyph(FIXTURE)
    expect(glyph).toBe('\u264A') // ♊ Gemini
  })

  it('returns Aries glyph for April 1', () => {
    const glyph = computeSunSignGlyph({
      date: '1990-04-01',
      time: '12:00',
      lat: 40.0,
      lon: -3.0,
    })
    expect(glyph).toBe('\u2648') // ♈ Aries
  })

  it('returns Capricorn glyph for January 5', () => {
    const glyph = computeSunSignGlyph({
      date: '1990-01-05',
      time: '12:00',
      lat: 40.0,
      lon: -3.0,
    })
    expect(glyph).toBe('\u2651') // ♑ Capricorn
  })

  it('uses noon default when time is missing', () => {
    const glyphWithTime = computeSunSignGlyph(FIXTURE)
    const glyphNoTime = computeSunSignGlyph({
      date: '1990-06-10',
      lat: 27.95,
      lon: -82.46,
    })
    // Sun sign should be the same regardless of time
    expect(glyphNoTime).toBe(glyphWithTime)
  })

  it('handles timezone conversion correctly', () => {
    // 2:30 AM in Madrid = 00:30 UTC, still June 10
    const glyph = computeSunSignGlyph({
      date: '1990-06-10',
      time: '02:30',
      lat: 40.0,
      lon: -3.0,
      timezone: 'Europe/Madrid',
    })
    expect(glyph).toBe('\u264A') // ♊ Gemini (still same day)
  })
})

// ---------------------------------------------------------------------------
// formatNatalContext
// ---------------------------------------------------------------------------

describe('formatNatalContext', () => {
  it('formats basic natal context', () => {
    const ctx = formatNatalContext('maria', {
      date: '1990-06-10',
      lat: 27.95,
      lon: -82.46,
    })
    expect(ctx).toContain('Client maria')
    expect(ctx).toContain('date=1990-06-10')
    expect(ctx).toContain('lat=27.95')
    expect(ctx).toContain('lon=-82.46')
    expect(ctx).toContain('house_system=placidus')
  })

  it('includes time and timezone when present', () => {
    const ctx = formatNatalContext('juan', {
      date: '1990-06-10',
      time: '14:30',
      lat: 27.95,
      lon: -82.46,
      timezone: 'America/New_York',
    })
    expect(ctx).toContain('time=14:30')
    expect(ctx).toContain('timezone=America/New_York')
  })

  it('uses custom house system', () => {
    const ctx = formatNatalContext('maria', {
      date: '1990-06-10',
      lat: 27.95,
      lon: -82.46,
      house_system: 'whole_sign',
    })
    expect(ctx).toContain('house_system=whole_sign')
  })
})
