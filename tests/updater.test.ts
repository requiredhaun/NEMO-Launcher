import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

vi.mock('electron', () => ({ app: { getVersion: () => '1.0.1', getPath: () => path.join(os.tmpdir(), 'nemo-upd-test') }, shell: { openExternal: vi.fn() } }))

import { cmpVersions, pickSetupAsset, checkForUpdates, downloadUpdate } from '../electron/updater'

describe('cmpVersions', () => {
  it('v-prefix ignored', () => expect(cmpVersions('v1.0.1', '1.0.1')).toBe(0))
  it('patch bump detected', () => expect(cmpVersions('1.0.1', '1.0.2')).toBe(-1))
  it('no downgrade offer', () => expect(cmpVersions('1.0.2', '1.0.1')).toBe(1))
  it('minor/major compare numerically', () => {
    expect(cmpVersions('1.0.9', '1.0.10')).toBe(-1)
    expect(cmpVersions('1.9.0', '1.10.0')).toBe(-1)
  })
})

describe('pickSetupAsset', () => {
  const exes = [
    { name: 'NEMO-1.0.2-portable.exe', browser_download_url: 'http://t/portable' },
    { name: 'NEMO-Setup-1.0.2.exe', browser_download_url: 'http://t/setup' },
  ]
  it('prefers Setup exe', () => expect(pickSetupAsset(exes)).toBe('http://t/setup'))
  it('falls back to first exe', () => expect(pickSetupAsset([exes[0]])).toBe('http://t/portable'))
  it('empty when no exe', () => expect(pickSetupAsset([{ name: 'notes.txt' }])).toBe(''))
})

describe('checkForUpdates (mocked GitHub)', () => {
  it('available on newer tag', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ tag_name: 'v1.0.2', name: 'NEMO 1.0.2', body: 'notes', html_url: 'http://t/rel', assets: [{ name: 'NEMO-Setup-1.0.2.exe', browser_download_url: 'http://t/setup' }] }),
    })))
    const r = await checkForUpdates()
    expect(r.available).toBe(true)
    expect(r.latest).toBe('v1.0.2')
    expect(r.setupUrl).toBe('http://t/setup')
    vi.unstubAllGlobals()
  })
  it('not available on same version', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ tag_name: 'v1.0.1', assets: [] }),
    })))
    const r = await checkForUpdates()
    expect(r.available).toBe(false)
    vi.unstubAllGlobals()
  })
  it('no releases (404) means no update, not error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    const r = await checkForUpdates()
    expect(r.available).toBe(false)
    vi.unstubAllGlobals()
  })
})

describe('downloadUpdate', () => {
  const dir = path.join(os.tmpdir(), 'nemo-upd-test', 'cache', 'updates')
  it('writes file, reports progress, wipes stale exes', async () => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'NEMO-Setup-old.exe'), 'stale')
    const payload = Buffer.alloc(1024, 7)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(payload, { headers: { 'content-length': '1024' } })))
    const seen: number[] = []
    const file = await downloadUpdate('http://t/setup.exe', (done) => seen.push(done))
    expect(fs.readFileSync(file)).toEqual(payload)
    expect(fs.existsSync(path.join(dir, 'NEMO-Setup-old.exe'))).toBe(false)
    expect(seen[seen.length - 1]).toBe(1024)
    vi.unstubAllGlobals()
    fs.rmSync(path.join(os.tmpdir(), 'nemo-upd-test'), { recursive: true, force: true })
  })
  it('throws without url', async () => {
    await expect(downloadUpdate('')).rejects.toThrow()
  })
})
