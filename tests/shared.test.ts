import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/nemo-test' } }))

import { ensureSharedDirs, sharedDir, mergeInherits } from '../electron/versions'

function userData(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-shared-'))
}

describe('ensureSharedDirs', () => {
  it('creates junctions for assets and libraries', () => {
    const ud = userData()
    const gameDir = path.join(ud, 'instances', 'abc')
    fs.mkdirSync(gameDir, { recursive: true })
    ensureSharedDirs(ud, gameDir)
    for (const d of ['assets', 'libraries']) {
      const st = fs.lstatSync(path.join(gameDir, d))
      expect(st.isSymbolicLink()).toBe(true)
      expect(fs.realpathSync(path.join(gameDir, d))).toBe(fs.realpathSync(path.join(ud, 'shared', d)))
    }
    // файл, записанный через инстанс, виден в shared
    fs.writeFileSync(path.join(gameDir, 'assets', 'probe.txt'), 'x')
    expect(fs.readFileSync(path.join(ud, 'shared', 'assets', 'probe.txt'), 'utf-8')).toBe('x')
    fs.rmSync(ud, { recursive: true, force: true })
  })

  it('does not touch real dirs with user data', () => {
    const ud = userData()
    const gameDir = path.join(ud, 'instances', 'abc')
    const real = path.join(gameDir, 'assets')
    fs.mkdirSync(real, { recursive: true })
    fs.writeFileSync(path.join(real, 'keep.txt'), 'mine')
    ensureSharedDirs(ud, gameDir)
    expect(fs.lstatSync(real).isSymbolicLink()).toBe(false)
    expect(fs.readFileSync(path.join(real, 'keep.txt'), 'utf-8')).toBe('mine')
    fs.rmSync(ud, { recursive: true, force: true })
  })

  it('sharedDir helper', () => {
    expect(sharedDir('/ud', 'assets')).toBe(path.join('/ud', 'shared', 'assets'))
  })
})

describe('mergeInherits stability', () => {
  it('does not rewrite identical file', async () => {
    const g = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-merge-'))
    const parent = {
      id: '1.21.1', type: 'release', mainClass: 'net.Main',
      downloads: { client: { url: 'https://x' } }, libraries: [], arguments: { game: [], jvm: [] },
    }
    const pv = path.join(g, 'versions', '1.21.1')
    const cv = path.join(g, 'versions', 'm')
    fs.mkdirSync(pv, { recursive: true })
    fs.mkdirSync(cv, { recursive: true })
    fs.writeFileSync(path.join(pv, '1.21.1.json'), JSON.stringify(parent))
    fs.writeFileSync(path.join(cv, 'm.json'), JSON.stringify({ id: 'm', inheritsFrom: '1.21.1', mainClass: 'fm.Main', libraries: [], arguments: { game: ['--x'], jvm: [] } }))
    await mergeInherits(g, 'm')
    const after1 = fs.statSync(path.join(cv, 'm.json')).mtimeMs
    await new Promise((r) => setTimeout(r, 20))
    await mergeInherits(g, 'm')
    const after2 = fs.statSync(path.join(cv, 'm.json')).mtimeMs
    expect(after2).toBe(after1)
    fs.rmSync(g, { recursive: true, force: true })
  })
})
