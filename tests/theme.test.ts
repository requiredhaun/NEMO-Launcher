import { describe, it, expect } from 'vitest'
import { ACCENTS, accentHex } from '../src/lib/theme'

describe('theme accents', () => {
  it('all accents are valid hex colors with readable text', () => {
    expect(Object.keys(ACCENTS).length).toBeGreaterThan(3)
    for (const a of Object.values(ACCENTS)) {
      expect(a.hex).toMatch(/^#[0-9a-f]{6}$/i)
      expect(a.soft).toMatch(/^#[0-9a-f]{6}$/i)
      expect(a.on).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
  it('falls back to red on unknown accent', () => {
    expect(accentHex('nope')).toBe(ACCENTS.red.hex)
  })
})
