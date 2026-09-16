import { describe, it, expect } from 'vitest'
import { elySkinUrl } from '../src/lib/avatar'

describe('elySkinUrl', () => {
  it('builds skinsystem url', () => {
    expect(elySkinUrl('Notch')).toBe('https://skinsystem.ely.by/skins/Notch.png')
  })
  it('encodes nick', () => {
    expect(elySkinUrl('a b')).toBe('https://skinsystem.ely.by/skins/a%20b.png')
  })
})
