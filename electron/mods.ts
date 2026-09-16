import fs from 'node:fs'
import path from 'node:path'
import { tl } from './i18n'

export interface LocalMod { name: string; file: string; size: number; enabled: boolean }
export interface ContentFile { name: string; size: number }

const ARCHIVE_EXTS = ['.zip', '.jar']

/** Файлы контент-папки (шейдеры, текстурпаки): только архивы. */
export function listContent(gameDir: string, sub: string): ContentFile[] {
  const dir = path.join(gameDir, path.basename(sub))
  try {
    return fs.readdirSync(dir)
      .filter((f) => ARCHIVE_EXTS.some((e) => f.toLowerCase().endsWith(e)))
      .map((f) => ({ name: f, size: fs.statSync(path.join(dir, f)).size }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  } catch { return [] }
}

export function deleteContent(gameDir: string, sub: string, file: string): void {
  fs.unlinkSync(path.join(gameDir, path.basename(sub), path.basename(file)))
}
export interface WorldInfo { name: string; size: number; mtime: number }

const JAR = '.jar'
const OFF = '.jar.disabled'

function isOff(f: string): boolean { return f.toLowerCase().endsWith(OFF) }
function isOn(f: string): boolean { const l = f.toLowerCase(); return l.endsWith(JAR) && !isOff(f) }

export function modsDir(gameDir: string): string {
  return path.join(gameDir, 'mods')
}

/** Все моды сборки: .jar = включён, .jar.disabled = выключен. */
export function listMods(gameDir: string): LocalMod[] {
  try {
    return fs.readdirSync(modsDir(gameDir))
      .filter((f) => isOn(f) || isOff(f))
      .map((f) => {
        const enabled = !isOff(f)
        const st = fs.statSync(path.join(modsDir(gameDir), f))
        return { name: enabled ? f : f.slice(0, -'.disabled'.length), file: f, size: st.size, enabled }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  } catch { return [] }
}

/** Переключить мод. Возвращает новое состояние enabled. */
export function toggleMod(gameDir: string, file: string): boolean {
  const base = path.basename(file)
  const dir = modsDir(gameDir)
  if (isOff(base)) {
    const next = base.slice(0, -'.disabled'.length)
    fs.renameSync(path.join(dir, base), path.join(dir, next))
    return true
  }
  if (isOn(base)) {
    fs.renameSync(path.join(dir, base), path.join(dir, base + '.disabled'))
    return false
  }
  throw new Error(tl('mods.notMod', { f: base }))
}

export function deleteMod(gameDir: string, file: string): void {
  fs.unlinkSync(path.join(modsDir(gameDir), path.basename(file)))
}

/** Скопировать .jar в моды сборки. Возвращает имя файла. */
export function addModFile(gameDir: string, src: string): string {
  const name = path.basename(src)
  if (!isOn(name)) {
    throw new Error(tl('mods.needJar', { f: name }))
  }
  const buf = fs.readFileSync(src)
  if (!buf.length) throw new Error(tl('mods.empty', { f: name }))
  fs.mkdirSync(modsDir(gameDir), { recursive: true })
  fs.writeFileSync(path.join(modsDir(gameDir), name), buf)
  return name
}

function dirSize(dir: string, depth = 0): number {
  if (depth > 6) return 0
  let size = 0
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      try {
        if (e.isDirectory()) size += dirSize(p, depth + 1)
        else size += fs.statSync(p).size
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return size
}

/** Миры сборки: папки в saves/ с размером. */
export function listWorlds(gameDir: string): WorldInfo[] {
  const dir = path.join(gameDir, 'saves')
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const p = path.join(dir, e.name)
        let mtime = 0
        try { mtime = fs.statSync(p).mtimeMs } catch { /* ignore */ }
        return { name: e.name, size: dirSize(p), mtime }
      })
      .sort((a, b) => b.mtime - a.mtime)
  } catch { return [] }
}
