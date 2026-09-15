import { describe, it, expect } from 'vitest'
import { pickVersion } from '../electron/modrinth'

describe('modrinth pickVersion', () => {
  const vs: any[] = [
    { id: 'a', game_versions: ['1.20.1'], loaders: ['forge'], files: [], dependencies: [] },
    { id: 'b', game_versions: ['1.21.11'], loaders: ['fabric'], files: [], dependencies: [] },
  ]
  it('prefers exact game+loader match', () => {
    expect(pickVersion(vs, '1.21.11', 'fabric')?.id).toBe('b')
  })
  it('returns null instead of wrong jar when nothing matches', () => {
    expect(pickVersion(vs, '1.19', 'quilt')).toBeNull()
  })
  it('returns null on empty list', () => {
    expect(pickVersion([], '1.21.11', 'fabric')).toBeNull()
  })
})
