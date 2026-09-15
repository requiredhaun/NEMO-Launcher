import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const RUNTIME_MANIFEST = 'https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96-52b9-4a55-9ccb-50c34d280dde/all.json'

export const COMPONENT_BY_MAJOR: Record<number, string> = {
  8: 'jre-legacy',
  16: 'java-runtime-alpha',
  17: 'java-runtime-beta',
  21: 'java-runtime-epsilon',
}

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

export async function ensureJavaRuntime(
  gameDir: string, major: number, onProgress?: (done: number, total: number, name: string) => void,
): Promise<string> {
  const component = COMPONENT_BY_MAJOR[major] || 'java-runtime-epsilon'
  const target = path.join(app.getPath('userData'), 'java', String(major))
  const exe = javaExecutable(target)
  if (fs.existsSync(exe)) return exe
  const res = await fetch(RUNTIME_MANIFEST)
  if (!res.ok) throw new Error(`Java runtime manifest: ${res.status}`)
  const body: any = await res.json()
  const entry = body?.[process.platform]?.[process.arch === 'x64' ? 'x64' : process.arch]?.[component]?.[0]
  if (!entry?.manifest?.url) throw new Error(`Рантайм Java ${major} не найден для этой платформы`)
  const man: any = await (await fetch(entry.manifest.url)).json()
  const files = Object.entries<any>(man.files || {}).filter(([, f]) => f.type === 'file' && f.downloads?.raw?.url)
  let done = 0
  for (const [rel, f] of files) {
    const dest = path.join(target, ...rel.split('/'))
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    const bin = Buffer.from(await (await fetch(f.downloads.raw.url)).arrayBuffer())
    fs.writeFileSync(dest, bin)
    if (f.executable) { try { fs.chmodSync(dest, 0o755) } catch { /* win */ } }
    done++
    onProgress?.(done, files.length, rel)
  }
  if (!fs.existsSync(exe)) throw new Error('Java скачалась, но бинарник не найден')
  return exe
}
