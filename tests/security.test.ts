import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/nema-test' } }))

import { forgeFull } from '../electron/versions'
import { safeDest, verifyHash } from '../electron/mrpack'

describe('forgeFull', () => {
  it('expands short build to full mc-build', () => {
    expect(forgeFull('1.20.1', '47.2.0')).toBe('1.20.1-47.2.0')
  })
  it('keeps full version as-is', () => {
    expect(forgeFull('1.20.1', '1.20.1-47.2.0')).toBe('1.20.1-47.2.0')
  })
  it('empty in empty out', () => {
    expect(forgeFull('1.20.1', '')).toBe('')
  })
})

describe('mrpack safeDest', () => {
  const root = process.platform === 'win32' ? 'C:\\game' : '/game'
  it('allows normal relative paths', () => {
    expect(safeDest(root, 'mods/a.jar').endsWith('a.jar')).toBe(true)
  })
  it('rejects zip-slip traversal', () => {
    expect(() => safeDest(root, '../../evil.exe')).toThrow()
    expect(() => safeDest(root, 'mods/../../evil.exe')).toThrow()
  })
})

describe('mrpack verifyHash', () => {
  it('passes matching sha1', () => {
    const buf = Buffer.from('hello')
    expect(() => verifyHash(buf, { sha1: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d' })).not.toThrow()
  })
  it('rejects mismatched hash', () => {
    expect(() => verifyHash(Buffer.from('hello'), { sha1: 'deadbeef' })).toThrow()
  })
  it('skips when no hashes', () => {
    expect(() => verifyHash(Buffer.from('x'))).not.toThrow()
  })
})
