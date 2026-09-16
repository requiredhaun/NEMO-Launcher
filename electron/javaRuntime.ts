import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { tl } from './i18n'

/**
 * Корень манифестов Java runtime Mojang.
 * ВАЖНО: это НЕ version_manifest и НЕ фиксированный навсегда URL —
 * Mojang периодически ротирует SHA-каталог (старый ...b55 протух с BlobNotFound,
 * вариант с дефисами ...52b9-4a55... не существовал никогда). Держим два хоста:
 * piston-meta основной, launchermeta запасной.
 */
const RUNTIME_ROOTS = [
  'https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json',
  'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json',
]

/** Компонент рантайма по major-версии Java — как объявляет сам Mojang в version.json
 * (проверено: 1.16.5→jre-legacy, 1.17.1→alpha, 1.19/1.20→gamma, 1.21→delta). */
export const COMPONENT_BY_MAJOR: Record<number, string> = {
  8: 'jre-legacy',
  16: 'java-runtime-alpha',
  17: 'java-runtime-gamma',
  21: 'java-runtime-delta',
}

const FALLBACK_COMPONENTS = ['java-runtime-delta', 'java-runtime-gamma', 'java-runtime-epsilon', 'java-runtime-beta', 'java-runtime-alpha', 'jre-legacy']

export function parseJavaMajor(version: string): number {
  const m = version.match(/^(?:1\.)?(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

export function javaExecutable(dir: string): string {
  return process.platform === 'win32' ? path.join(dir, 'bin', 'java.exe') : path.join(dir, 'bin', 'java')
}

export function majorForMc(mcVersion: string): number {
  const [maj, min] = mcVersion.split('.').map(Number)
  if (maj !== 1 || Number.isNaN(min)) return 21
  if (min <= 16) return 8
  if (min <= 17) return 16
  if (min <= 20) return 17
  return 21
}

/**
 * Ключ платформы в корне манифестов. Осторожно: это НЕ process.platform —
 * там лежат 'windows-x64', 'linux', 'mac-os' и т.д. (поэтому старый код
 * с body['win32'] всегда получал undefined).
 * Чистая функция — для тестов можно подсунуть platform/arch.
 */
export function runtimePlatformKey(platform = process.platform, arch = process.arch): string | null {
  if (platform === 'win32') return arch === 'arm64' ? 'windows-arm64' : arch === 'x64' ? 'windows-x64' : 'windows-x86'
  if (platform === 'darwin') return arch === 'arm64' ? 'mac-os-arm64' : 'mac-os'
  if (platform === 'linux') return arch === 'ia32' ? 'linux-i386' : 'linux'
  return null
}

/** Порядок перебора компонентов: хинт из version.json первый, потом маппинг, потом остальные. */
export function resolveComponents(major: number, hint = ''): string[] {
  const out: string[] = []
  for (const c of [hint, COMPONENT_BY_MAJOR[major] || '', ...FALLBACK_COMPONENTS]) {
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(tl('java.rootFail', { status: res.status }))
  return res.json()
}

export async function ensureJavaRuntime(
  gameDir: string, major: number, onProgress?: (done: number, total: number, name: string) => void,
  componentHint = '',
): Promise<string> {
  const target = path.join(app.getPath('userData'), 'java', String(major))
  const exe = javaExecutable(target)
  if (fs.existsSync(exe)) return exe
  const platKey = runtimePlatformKey()
  if (!platKey) throw new Error(tl('java.noRuntime', { major, have: '—' }))
  let body: any = null
  let lastErr: any = null
  for (const root of RUNTIME_ROOTS) {
    try { body = await fetchJson(root); break } catch (e) { lastErr = e }
  }
  if (!body) throw lastErr
  const plat = body?.[platKey] || {}
  let entry: any = null
  for (const comp of resolveComponents(major, componentHint)) {
    const cand = plat?.[comp]?.[0]
    if (cand?.manifest?.url) { entry = cand; break }
  }
  if (!entry) throw new Error(tl('java.noRuntime', { major, have: Object.keys(plat).join(', ') || '—' }))
  const man: any = await fetchJson(entry.manifest.url)
  const files = Object.entries<any>(man.files || {}).filter(([, f]) => f.type === 'file' && f.downloads?.raw?.url)
  let done = 0
  for (const [rel, f] of files) {
    const dest = path.join(target, ...rel.split('/'))
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    const fr = await fetch(f.downloads.raw.url)
    if (!fr.ok) throw new Error(tl('java.fileFail', { url: rel, status: fr.status }))
    fs.writeFileSync(dest, Buffer.from(await fr.arrayBuffer()))
    if (f.executable) { try { fs.chmodSync(dest, 0o755) } catch { /* win */ } }
    done++
    onProgress?.(done, files.length, rel)
  }
  if (!fs.existsSync(exe)) throw new Error(tl('java.dlOkNoBin'))
  return exe
}
