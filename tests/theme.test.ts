import { describe, it, expect } from 'vitest'
import { ACCENTS, THEME_PRESETS, presetMatches, accentHex } from '../src/lib/theme'

describe('theme accents', () => {
  it('all accents are valid hex colors', () => {
    expect(Object.keys(ACCENTS).length).toBeGreaterThan(3)
    for (const a of Object.values(ACCENTS)) {
      expect(a.hex).toMatch(/^#[0-9a-f]{6}$/i)
      expect(a.soft).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
  it('falls back to red on unknown accent', () => {
    expect(accentHex('nope')).toBe(ACCENTS.red.hex)
  })
})

describe('theme presets', () => {
  it('every preset uses known accents and matches itself', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(3)
    for (const p of THEME_PRESETS) {
      expect(ACCENTS[p.theme.accent]).toBeDefined()
      expect(presetMatches(p, p.theme)).toBe(true)
    }
  })
  it('detects drift', () => {
    expect(presetMatches(THEME_PRESETS[0], { ...THEME_PRESETS[0].theme, compact: !THEME_PRESETS[0].theme.compact })).toBe(false)
  })
})
