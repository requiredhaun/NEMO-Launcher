import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ensureSharedDirs } from './versions'
import { tl } from './i18n'

export type Loader = 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'

export interface Instance {
  id: string
  name: string
  mcVersion: string
  loader: Loader
  loaderVersion: string
  versionId: string
  ramMB: number
  gameDir: string
  createdAt: number
}

export function instanceDir(userData: string, id: string): string {
  return path.join(userData, 'instances', id)
}

export function readInstance(gameDir: string): Instance | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(gameDir, 'instance.json'), 'utf-8')) as Instance
  } catch {
    return null
  }
}

export function writeInstance(inst: Instance): void {
  fs.mkdirSync(inst.gameDir, { recursive: true })
  fs.writeFileSync(path.join(inst.gameDir, 'instance.json'), JSON.stringify(inst, null, 2), 'utf-8')
}

export function createInstance(userData: string, name: string, mcVersion: string): Instance {
  const clean = name.trim().slice(0, 32) || 'Instance'
  const id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`
  const inst: Instance = {
    id, name: clean, mcVersion, loader: 'vanilla', loaderVersion: '',
    versionId: mcVersion, ramMB: 4096,
    gameDir: instanceDir(userData, id), createdAt: Date.now(),
  }
  writeInstance(inst)
  try {
    ensureSharedDirs(userData, inst.gameDir)
  } catch { /* создастся при запуске */ }
  return inst
}

export function listInstances(userData: string): Instance[] {
  const dir = path.join(userData, 'instances')
  const out: Instance[] = []
  try {
    for (const id of fs.readdirSync(dir)) {
      const inst = readInstance(path.join(dir, id))
      if (inst) out.push(inst)
    }
  } catch { /* empty */ }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

export function deleteInstance(userData: string, inst: Instance): void {
  // guard: трём только внутри <userData>/instances, никогда произвольные пути
  const root = path.normalize(path.join(userData, 'instances') + path.sep)
  const target = path.normalize(inst.gameDir)
  if (target !== path.normalize(path.join(userData, 'instances')) && !target.startsWith(root)) {
    throw new Error(tl('inst.outside'))
  }
  fs.rmSync(inst.gameDir, { recursive: true, force: true })
}
