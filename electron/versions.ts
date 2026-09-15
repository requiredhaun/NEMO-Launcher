import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { app } from 'electron'

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const FABRIC_META = 'https://meta.fabricmc.net/v2'
const QUILT_META = 'https://meta.quiltmc.org/v3'
const FORGE_PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
const NEOFORGE_META = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'

export interface ManifestVersion { id: string; type: string; releaseTime: string; url?: string }
export interface ManifestInfo { latest: { release: string; snapshot: string }; versions: ManifestVersion[] }

let manifestCache: { at: number; data: ManifestInfo } | null = null

export async function getManifest(force = false): Promise<ManifestInfo> {
  const cacheFile = path.join(app.getPath('userData'), 'manifest.json')
  if (!force && manifestCache && Date.now() - manifestCache.at < 10 * 60 * 1000) return manifestCache.data
  try {
    const res = await fetch(MANIFEST_URL)
    if (!res.ok) throw new Error(`Mojang вернул ${res.status}`)
    const data = (await res.json()) as ManifestInfo
    manifestCache = { at: Date.now(), data }
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    fs.writeFileSync(cacheFile, JSON.stringify(data), 'utf-8')
    return data
  } catch (e) {
    if (manifestCache) return manifestCache.data
    try {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as ManifestInfo
    } catch { throw e }
  }
}

export function installedVersions(gameDir: string): Set<string> {
  const set = new Set<string>()
  try {
    for (const name of fs.readdirSync(path.join(gameDir, 'versions'))) {
      if (fs.existsSync(path.join(gameDir, 'versions', name, `${name}.json`))) set.add(name)
    }
  } catch { /* none */ }
  return set
}

export async function versionType(gameDir: string, id: string): Promise<string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(gameDir, 'versions', id, `${id}.json`), 'utf-8'))
    if (parsed?.type) return parsed.type
  } catch { /* fallthrough */ }
  const m = await getManifest()
  return m.versions.find((v) => v.id === id)?.type || 'release'
}

export async function getVanillaVersionJson(mcVersion: string, gameDir: string): Promise<any> {
  const local = path.join(gameDir, 'versions', mcVersion, `${mcVersion}.json`)
  try {
    return JSON.parse(fs.readFileSync(local, 'utf-8'))
  } catch { /* download */ }
  const manifest = await getManifest()
  const entry = manifest.versions.find((v) => v.id === mcVersion)
  if (!entry?.url) throw new Error(`Версия ${mcVersion} не найдена`)
  const res = await fetch(entry.url)
  if (!res.ok) throw new Error(`version.json ${mcVersion}: ${res.status}`)
  const json = await res.json()
  fs.mkdirSync(path.dirname(local), { recursive: true })
  fs.writeFileSync(local, JSON.stringify(json), 'utf-8')
  return json
}

function mavenArtifact(name: string): string {
  const [group, artifact, version, classifier] = name.split(':')
  const file = classifier ? `${artifact}-${version}-${classifier}.jar` : `${artifact}-${version}.jar`
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${file}`
}

function toMojangLib(lib: any): any {
  if (lib.downloads?.artifact?.url) return lib
  const p = mavenArtifact(lib.name)
  return { name: lib.name, downloads: { artifact: { path: p, url: `${String(lib.url).replace(/\/$/, '')}/${p}` } } }
}

function mergeProfile(vanilla: any, profile: any): any {
  const merged: any = { ...vanilla }
  merged.id = profile.id
  merged.mainClass = profile.mainClass
  merged.libraries = [...(vanilla.libraries || []), ...(profile.libraries || []).map(toMojangLib)]
  const v = vanilla.arguments || { game: [], jvm: [] }
  const f = profile.arguments || { game: [], jvm: [] }
  merged.arguments = { game: [...(v.game || []), ...(f.game || [])], jvm: [...(v.jvm || []), ...(f.jvm || [])] }
  delete merged.inheritsFrom
  return merged
}

function saveVersion(gameDir: string, id: string, json: any): void {
  const dir = path.join(gameDir, 'versions', id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(json, null, 2), 'utf-8')
}

export async function fabricLoaders(): Promise<{ version: string; stable: boolean }[]> {
  const res = await fetch(`${FABRIC_META}/versions/loader`)
  if (!res.ok) throw new Error(`Fabric meta: ${res.status}`)
  return (await res.json()) as any
}

export async function installFabric(mc: string, loader: string, gameDir: string): Promise<{ id: string }> {
  const res = await fetch(`${FABRIC_META}/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(loader)}/profile/json`)
  if (!res.ok) throw new Error(`Fabric профиль ${mc}+${loader} не найден`)
  const profile = await res.json()
  const merged = mergeProfile(await getVanillaVersionJson(mc, gameDir), profile)
  saveVersion(gameDir, profile.id, merged)
  return { id: profile.id }
}

export async function quiltLoaders(mc: string): Promise<string[]> {
  const res = await fetch(`${QUILT_META}/versions/loader/${encodeURIComponent(mc)}`)
  if (!res.ok) throw new Error(`Quilt meta: ${res.status}`)
  const arr: any[] = await res.json()
  return arr.map((x) => x.loader?.version).filter(Boolean)
}

export async function installQuilt(mc: string, loader: string, gameDir: string): Promise<{ id: string }> {
  const res = await fetch(`${QUILT_META}/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(loader)}/profile/json`)
  if (!res.ok) throw new Error(`Quilt профиль ${mc}+${loader} не найден`)
  const profile = await res.json()
  const merged = mergeProfile(await getVanillaVersionJson(mc, gameDir), profile)
  saveVersion(gameDir, profile.id, merged)
  return { id: profile.id }
}

export async function forgePromos(): Promise<Record<string, string>> {
  const res = await fetch(FORGE_PROMOS)
  if (!res.ok) throw new Error(`Forge: ${res.status}`)
  const promos = (await res.json() as any)?.promos || {}
  const byMc = new Map<string, { recommended?: string; latest?: string }>()
  for (const k of Object.keys(promos)) {
    const m = k.match(/^(.*)-(recommended|latest)$/)
    if (!m) continue
    if (!byMc.has(m[1])) byMc.set(m[1], {})
    byMc.get(m[1])![m[2] as 'recommended' | 'latest'] = promos[k]
  }
  const out: Record<string, string> = {}
  for (const [mc, v] of byMc) out[mc] = v.recommended || v.latest || ''
  return out
}

export async function neoforgeVersions(mc: string): Promise<string[]> {
  const res = await fetch(NEOFORGE_META)
  if (!res.ok) throw new Error(`NeoForge meta: ${res.status}`)
  const body: any = await res.json()
  const versions: string[] = body?.versions || []
  // NeoForge версии вида 21.1.123 — мажор минора совпадает с MC (21.1 = 1.21.1)
  const want = mc.split('.').slice(1).join('.')
  return versions.filter((v) => v.startsWith(want + '.') || v === want).slice(-20).reverse()
}

async function downloadInstaller(url: string, name: string): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'cache')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, name)
  if (fs.existsSync(file)) return file
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Скачивание установщика: ${res.status}`)
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return file
}

export function runModdedInstaller(jar: string, gameDir: string, javaPath: string, onLog: (l: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(javaPath, ['-jar', jar, '--installClient', gameDir], { cwd: gameDir, windowsHide: true })
    let err = ''
    proc.stdout.on('data', (d) => onLog(String(d)))
    proc.stderr.on('data', (d) => { err = String(d); onLog(String(d)) })
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Установщик завершился с кодом ${code}. ${err.slice(-300)}`))))
  })
}

export async function downloadForgeInstaller(full: string): Promise<string> {
  return downloadInstaller(
    `https://maven.minecraftforge.net/net/minecraftforge/forge/${full}/forge-${full}-installer.jar`,
    `forge-${full}-installer.jar`,
  )
}

export async function downloadNeoForgeInstaller(version: string): Promise<string> {
  return downloadInstaller(
    `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`,
    `neoforge-${version}-installer.jar`,
  )
}

export async function detectJava(explicitPath: string): Promise<{ path: string; version: string } | null> {
  const candidates = explicitPath ? [explicitPath] : (process.platform === 'win32' ? ['java.exe', 'javaw.exe'] : ['java'])
  for (const cmd of candidates) {
    const info = await new Promise<{ path: string; version: string } | null>((resolve) => {
      const p = spawn(cmd, ['-version'], { windowsHide: true })
      let out = ''
      const timer = setTimeout(() => { p.kill(); resolve(null) }, 8000)
      p.stderr.on('data', (d) => (out += String(d)))
      p.stdout.on('data', (d) => (out += String(d)))
      p.on('error', () => { clearTimeout(timer); resolve(null) })
      p.on('close', () => {
        clearTimeout(timer)
        const m = out.match(/version "([^"]+)"/)
        resolve(m ? { path: cmd, version: m[1] } : null)
      })
    })
    if (info) return info
  }
  return null
}
