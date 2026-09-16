import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { listMods, toggleMod, addModFile, listWorlds, listContent, deleteContent } from '../electron/mods'
import { contentSubdir } from '../electron/modrinth'

function tmpGame(): string {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-mods-'))
  fs.mkdirSync(path.join(ud, 'mods'), { recursive: true })
  return ud
}

describe('local mods', () => {
  it('toggle off and on renames file both ways', () => {
    const g = tmpGame()
    fs.writeFileSync(path.join(g, 'mods', 'sodium.jar'), 'x')
    expect(listMods(g).map((m) => [m.name, m.enabled])).toEqual([['sodium.jar', true]])
    expect(toggleMod(g, 'sodium.jar')).toBe(false)
    expect(listMods(g).map((m) => [m.name, m.enabled])).toEqual([['sodium.jar', false]])
    expect(toggleMod(g, 'sodium.jar.disabled')).toBe(true)
    expect(listMods(g).map((m) => [m.name, m.enabled])).toEqual([['sodium.jar', true]])
    fs.rmSync(g, { recursive: true, force: true })
  })

  it('rejects non-jar toggle', () => {
    const g = tmpGame()
    fs.writeFileSync(path.join(g, 'mods', 'readme.txt'), 'x')
    expect(() => toggleMod(g, 'readme.txt')).toThrow()
    expect(listMods(g)).toEqual([])
    fs.rmSync(g, { recursive: true, force: true })
  })

  it('addModFile copies jar, rejects others', () => {
    const g = tmpGame()
    const src = path.join(g, 'dl.jar')
    fs.writeFileSync(src, 'data')
    expect(addModFile(g, src)).toBe('dl.jar')
    const bad = path.join(g, 'x.txt')
    fs.writeFileSync(bad, 'x')
    expect(() => addModFile(g, bad)).toThrow()
    fs.rmSync(g, { recursive: true, force: true })
  })

  it('empty worlds when no saves', () => {
    const g = tmpGame()
    expect(listWorlds(g)).toEqual([])
    fs.rmSync(g, { recursive: true, force: true })
  })

  it('contentSubdir maps kinds to folders', () => {
    expect(contentSubdir('mod')).toBe('mods')
    expect(contentSubdir('shader')).toBe('shaderpacks')
    expect(contentSubdir('resourcepack')).toBe('resourcepacks')
    expect(contentSubdir('modpack' as any)).toBe('mods')
  })

  it('list/delete shaderpacks content', () => {
    const g = tmpGame()
    const dir = path.join(g, 'shaderpacks')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'bliss.zip'), 'zipdata')
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'nope')
    expect(listContent(g, 'shaderpacks')).toEqual([{ name: 'bliss.zip', size: 7 }])
    deleteContent(g, 'shaderpacks', 'bliss.zip')
    expect(listContent(g, 'shaderpacks')).toEqual([])
    fs.rmSync(g, { recursive: true, force: true })
  })

  it('rejects path traversal in sub', () => {
    const g = tmpGame()
    expect(listContent(g, '../other')).toEqual([])
    fs.rmSync(g, { recursive: true, force: true })
  })
})
