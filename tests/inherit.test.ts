import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/nemo-test' } }))

import { mergeInherits, verifyClientJar } from '../electron/versions'

function gameWith(parentId: string, parent: any, childId: string, child: any): string {
  const g = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-merge-'))
  const pv = path.join(g, 'versions', parentId)
  const cv = path.join(g, 'versions', childId)
  fs.mkdirSync(pv, { recursive: true })
  fs.mkdirSync(cv, { recursive: true })
  fs.writeFileSync(path.join(pv, `${parentId}.json`), JSON.stringify(parent))
  fs.writeFileSync(path.join(cv, `${childId}.json`), JSON.stringify(child))
  return g
}

const PARENT = {
  id: '1.21.1', type: 'release', mainClass: 'net.minecraft.client.main.Main',
  assetIndex: { id: '1.21.1' },
  downloads: { client: { url: 'https://x/client.jar' } },
  libraries: [{ name: 'vanilla:lib:1', downloads: { artifact: { path: 'p', url: 'https://x/p' } } }],
  arguments: { game: ['--vanilla'], jvm: ['-X'] },
}

describe('mergeInherits (forge/neoforge installer json)', () => {
  it('merges installer json without downloads into launchable json', async () => {
    const child = {
      id: 'neoforge-21.1.250', inheritsFrom: '1.21.1',
      mainClass: 'cpw.mods.bootstraplauncher.BootstrapLauncher',
      libraries: [
        { name: 'net.neoforged:loader:1', downloads: { artifact: { path: 'q', url: 'https://x/q' } } },
        { name: 'odd:lib:1' }, // без downloads и без url — не должно ронять мерж
      ],
      arguments: { game: ['--launchTarget', 'forgeclient'], jvm: [] },
    }
    const g = gameWith('1.21.1', PARENT, 'neoforge-21.1.250', child)
    await mergeInherits(g, 'neoforge-21.1.250')
    const merged = JSON.parse(fs.readFileSync(path.join(g, 'versions', 'neoforge-21.1.250', 'neoforge-21.1.250.json'), 'utf-8'))
    expect(merged.downloads.client.url).toBe('https://x/client.jar')
    expect(merged.mainClass).toBe('cpw.mods.bootstraplauncher.BootstrapLauncher')
    expect(merged.inheritsFrom).toBeUndefined()
    expect(merged.arguments.game).toEqual(['--vanilla', '--launchTarget', 'forgeclient'])
    expect(merged.libraries.length).toBe(3)
    fs.rmSync(g, { recursive: true, force: true })
  })

  it('leaves json without inheritsFrom untouched', async () => {
    const g = gameWith('1.21.1', PARENT, '1.21.1b', { ...PARENT, id: '1.21.1b' })
    const before = fs.readFileSync(path.join(g, 'versions', '1.21.1b', '1.21.1b.json'), 'utf-8')
    await mergeInherits(g, '1.21.1b')
    expect(fs.readFileSync(path.join(g, 'versions', '1.21.1b', '1.21.1b.json'), 'utf-8')).toBe(before)
    fs.rmSync(g, { recursive: true, force: true })
  })
})

describe('verifyClientJar', () => {
  function gameWithJar(size: number | null, dl: any): string {
    const g = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-jar-'))
    const dir = path.join(g, 'versions', 'v')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'v.json'), JSON.stringify({ downloads: { client: dl } }))
    if (size != null) fs.writeFileSync(path.join(dir, 'v.jar'), Buffer.alloc(size, 7))
    return g
  }

  it('ok when size matches', () => {
    const g = gameWithJar(100, { url: 'https://x', size: 100 })
    expect(verifyClientJar(g, 'v')).toEqual({ ok: true, repaired: false })
    fs.rmSync(g, { recursive: true, force: true })
  })

  it('deletes truncated jar so MLC re-downloads', () => {
    const g = gameWithJar(10, { url: 'https://x', size: 100 })
    expect(verifyClientJar(g, 'v')).toEqual({ ok: true, repaired: true })
    expect(fs.existsSync(path.join(g, 'versions', 'v', 'v.jar'))).toBe(false)
    fs.rmSync(g, { recursive: true, force: true })
  })

  it('checks sha1 when no size given', () => {
    const buf = Buffer.from('hello-mc')
    const sha1 = crypto.createHash('sha1').update(buf).digest('hex')
    const g = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-jar-'))
    const dir = path.join(g, 'versions', 'v')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'v.json'), JSON.stringify({ downloads: { client: { url: 'https://x', sha1 } } }))
    fs.writeFileSync(path.join(dir, 'v.jar'), buf)
    expect(verifyClientJar(g, 'v')).toEqual({ ok: true, repaired: false })
    fs.writeFileSync(path.join(dir, 'v.jar'), Buffer.from('corrupt!'))
    expect(verifyClientJar(g, 'v')).toEqual({ ok: true, repaired: true })
    fs.rmSync(g, { recursive: true, force: true })
  })
})
