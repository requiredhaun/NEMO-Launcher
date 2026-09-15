import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/nemo-test' } }))

import { forgeFull } from '../electron/versions'
import { safeDest, verifyHash, pool } from '../electron/mrpack'

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

describe('pool', () => {
  it('runs all items and keeps order', async () => {
    const out = await pool([1, 2, 3, 4, 5], 2, async (x) => x * 10)
    expect(out).toEqual([10, 20, 30, 40, 50])
  })
  it('limits concurrency', async () => {
    let live = 0
    let max = 0
    await pool([1, 2, 3, 4, 5, 6], 2, async (x) => {
      live++
      max = Math.max(max, live)
      await new Promise((r) => setTimeout(r, 5))
      live--
      return x
    })
    expect(max).toBeLessThanOrEqual(2)
  })
})
