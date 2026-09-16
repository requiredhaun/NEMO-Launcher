import fs from 'node:fs'
import crypto from 'node:crypto'
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
  if (!lib.url || !lib.name) return lib // странная запись — оставляем как есть, не роняем мерж
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

/**
 * Установщики Forge/NeoForge пишут json с inheritsFrom и БЕЗ downloads —
 * MLC такое не запускает (падает на downloads.client.url).
 * Сливаем цепочку наследования в плоский запускаемый json, как ванильный
 * лаунчер. Идемпотентно: повторный вызов ничего не меняет.
 */
export async function mergeInherits(gameDir: string, id: string): Promise<void> {
  const file = path.join(gameDir, 'versions', id, `${id}.json`)
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'))
  if (!json?.inheritsFrom) return
  const parent = await getVanillaVersionJson(json.inheritsFrom, gameDir)
  const merged = mergeProfile(parent, json)
  merged.id = id
  saveVersion(gameDir, id, merged)
}

/**
 * MLC пропускает докачку jar, если файл просто существует, — оборванный
 * jar (622КБ вместо 26МБ) навсегда ломает запуск с ClassNotFound.
 * Проверяем размер/sha1 из version.json; битый удаляем чтобы MLC скачал заново.
 */
export function verifyClientJar(gameDir: string, versionId: string): { ok: boolean; repaired: boolean } {
  const dir = path.join(gameDir, 'versions', versionId)
  let json: any
  try {
    json = JSON.parse(fs.readFileSync(path.join(dir, `${versionId}.json`), 'utf-8'))
  } catch {
    return { ok: false, repaired: false }
  }
  const dl = json?.downloads?.client
  const jar = path.join(dir, `${versionId}.jar`)
  if (!fs.existsSync(jar)) return { ok: !!dl, repaired: false }
  if (!dl) return { ok: true, repaired: false }
  try {
    const st = fs.statSync(jar)
    if (dl.size && st.size !== dl.size) {
      fs.unlinkSync(jar)
      return { ok: true, repaired: true }
    }
    if (dl.sha1) {
      const sum = crypto.createHash('sha1').update(fs.readFileSync(jar)).digest('hex')
      if (sum !== String(dl.sha1).toLowerCase()) {
        fs.unlinkSync(jar)
        return { ok: true, repaired: true }
      }
    }
  } catch {
    return { ok: false, repaired: false }
  }
  return { ok: true, repaired: false }
}

export async function fabricLoaders(): Promise<{ version: string; stable: boolean }[]> {
  const res = await fetch(`${FABRIC_META}/versions/loader`)
  if (!res.ok) throw new Error(`Fabric meta: ${res.status}`)
  return (await res.json()) as any
}

/** Загрузчики Fabric именно под этот MC (для проверки поддержки). */
export async function fabricLoadersFor(mc: string): Promise<string[]> {
  const res = await fetch(`${FABRIC_META}/versions/loader/${encodeURIComponent(mc)}`)
  if (!res.ok) throw new Error(`Fabric нет для ${mc}`)
  const arr: any[] = await res.json()
  return arr.map((x) => x?.loader?.version || x?.version).filter(Boolean)
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
  for (const [mc, v] of byMc) {
    const full = v.recommended || v.latest || ''
    // promos отдают короткий билд ("47.2.0"), установщику нужен полный ("1.20.1-47.2.0")
    out[mc] = full.includes('-') ? full : (full ? `${mc}-${full}` : '')
  }
  return out
}

/** Нормализовать версию Forge к полной форме "mc-build". Экспортирована для тестов. */
export function forgeFull(mc: string, v: string): string {
  const t = v.trim()
  if (!t) return ''
  return t.includes('-') ? t : `${mc}-${t}`
}

/**
 * MC -> префикс версий NeoForge.
 * Старая схема Mojang: "1.21.1" -> "21.1." ; новая: "26.2" -> "26.2.".
 */
export function neoPrefix(mc: string): string {
  const parts = mc.split('.')
  const base = parts[0] === '1' ? parts.slice(1) : parts
  const mm = base.length >= 2 ? base.slice(0, 2).join('.') : `${base[0] || ''}.0`
  return mm + '.'
}

export async function neoforgeVersions(mc: string): Promise<string[]> {
  const res = await fetch(NEOFORGE_META)
  if (!res.ok) throw new Error(`NeoForge meta: ${res.status}`)
  const body: any = await res.json()
  const versions: string[] = body?.versions || []
  const prefix = neoPrefix(mc)
  const matched = versions.filter((v) => v.startsWith(prefix))
  if (!matched.length) return []
  const stable = matched.filter((v) => !v.includes('beta'))
  return (stable.length ? stable : matched).slice(-20).reverse()
}

/**
 * Найти id установленной версии среди папок versions/ по паре mc+full.
 * Точное совпадение (mc и билд) вместо первого попавшегося *-forge-*.
 */
export function matchInstalledVersion(dirs: string[], mc: string, full: string): string | null {
  const cands = dirs.filter((d) => d !== mc)
  const build = full.includes('-') ? full.split('-').slice(1).join('-') : full
  if (build) {
    // NeoForge кладёт "neoforge-21.1.250" (без mc), Forge — "1.20.1-forge-47.2.0"
    const exact = cands.find((d) => d.includes(mc) && d.includes(build))
    if (exact) return exact
    const byBuild = cands.find((d) => d.includes(build))
    if (byBuild) return byBuild
  }
  return cands.find((d) => d.includes(mc) && /forge|neoforge|fabric|quilt/i.test(d)) || null
}

export type LoaderSupport = Record<string, { supported: boolean; versions: string[] }>

/** Одним запросом: какие загрузчики есть под MC и их версии. */
export async function loaderSupport(mc: string): Promise<LoaderSupport> {
  const out: LoaderSupport = {
    vanilla: { supported: true, versions: [] },
    fabric: { supported: false, versions: [] },
    quilt: { supported: false, versions: [] },
    forge: { supported: false, versions: [] },
    neoforge: { supported: false, versions: [] },
  }
  const [fabric, quilt, promos, neo] = await Promise.allSettled([
    fabricLoadersFor(mc),
    quiltLoaders(mc),
    forgePromos(),
    neoforgeVersions(mc),
  ])
  if (fabric.status === 'fulfilled' && fabric.value.length) {
    out.fabric = { supported: true, versions: fabric.value.slice(0, 10) }
  }
  if (quilt.status === 'fulfilled' && quilt.value.length) {
    out.quilt = { supported: true, versions: quilt.value.slice(0, 10) }
  }
  if (promos.status === 'fulfilled' && promos.value[mc]) {
    out.forge = { supported: true, versions: [promos.value[mc]] }
  }
  if (neo.status === 'fulfilled' && neo.value.length) {
    out.neoforge = { supported: true, versions: neo.value }
  }
  return out
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

/**
 * MLC 3.18.2 полностью игнорирует versionJson.arguments.jvm — а там у
 * Forge/NeoForge лежат -p, --add-modules, --add-opens без которых
 * BootstrapLauncher падает. Достаём их сами для customArgs.
 * -cp и ${classpath} пропускаем — их генерирует сам MLC.
 */
export interface JvmCtx { gameDir: string; versionId: string; sep: string }

function jvmRuleAllows(rules: any[]): boolean {
  let allowed = false
  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
  for (const r of rules || []) {
    if (r.os && r.os.name && r.os.name !== os) continue
    if (r.os && r.os.arch && r.os.arch !== process.arch) continue
    if (r.features) continue // фичи лаунчера (custom_resolution и т.п.) — не поддерживаем
    allowed = r.action === 'allow'
  }
  return allowed
}

function substJvm(s: string, ctx: JvmCtx): string {
  return s
    .split('${library_directory}').join(path.join(ctx.gameDir, 'libraries'))
    .split('${classpath_separator}').join(ctx.sep)
    .split('${version_name}').join(ctx.versionId)
    .split('${natives_directory}').join(path.join(ctx.gameDir, 'natives', ctx.versionId))
    .split('${launcher_name}').join('NEMO')
    .split('${launcher_version}').join('0.1')
    .split('${classpath}').join('')
    .split('${assets_root}').join(path.join(ctx.gameDir, 'assets'))
    .split('${game_directory}').join(ctx.gameDir)
}

export function jvmArgsFromJson(json: any, ctx: JvmCtx): string[] {
  const list: any[] = json?.arguments?.jvm || []
  const out: string[] = []
  for (const entry of list) {
    const values: string[] =
      typeof entry === 'string' ? [entry] : jvmRuleAllows(entry.rules || []) ? [].concat(entry.value || []) : []
    for (const v of values) {
      if (v === '-cp' || v === '${classpath}') continue
      const s = substJvm(v, ctx)
      if (s) out.push(s)
    }
  }
  return out
}

/**
 * Общие assets/libraries на все сборки (как у Theseus/AstralRinth):
 * иначе каждая сборка заново качает ~500МБ. Реализация — junction'ы,
 * MLC их не замечает. Реальные папки с данными не трогаем.
 */
export const SHARED_DIRS = ['assets', 'libraries'] as const

export function sharedDir(userData: string, name: string): string {
  return path.join(userData, 'shared', name)
}

export function ensureSharedDirs(userData: string, gameDir: string): void {
  for (const name of SHARED_DIRS) {
    const target = sharedDir(userData, name)
    fs.mkdirSync(target, { recursive: true })
    const link = path.join(gameDir, name)
    try {
      const st = fs.lstatSync(link)
      if (st.isSymbolicLink()) {
        try {
          if (fs.realpathSync(link) === fs.realpathSync(target)) continue
        } catch { /* битая ссылка — пересоздаём */ }
        fs.unlinkSync(link)
      } else {
        continue // реальная папка с данными — не трогаем
      }
    } catch { /* нет — создаём */ }
    fs.mkdirSync(gameDir, { recursive: true })
    if (process.platform === 'win32') fs.symlinkSync(target, link, 'junction')
    else fs.symlinkSync(target, link, 'dir')
  }
}

/**
 * Установщики Forge/NeoForge отказываются работать в пустой папке:
 * "There is no minecraft launcher profile ... run the launcher first!"
 * Создаём минимальный launcher_profiles.json, как делает Theseus.
 * Существующий файл никогда не трогаем.
 */
export function ensureLauncherProfile(gameDir: string): void {
  const file = path.join(gameDir, 'launcher_profiles.json')
  if (fs.existsSync(file)) return
  fs.mkdirSync(gameDir, { recursive: true })
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        profiles: {},
        settings: {
          enableSnapshots: false,
          enableAdvanced: false,
          keepLauncherOpen: false,
          showGameLog: false,
          showMenu: false,
          soundOn: false,
        },
        version: 3,
      },
      null,
      2,
    ),
    'utf-8',
  )
}

let installerProc: import('node:child_process').ChildProcess | null = null

export function cancelInstaller(): void {
  try { installerProc?.kill() } catch { /* ignore */ }
  installerProc = null
}

export function runModdedInstaller(jar: string, gameDir: string, javaPath: string, onLog: (l: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(javaPath, ['-jar', jar, '--installClient', gameDir], { cwd: gameDir, windowsHide: true })
    installerProc = proc
    let err = ''
    proc.stdout.on('data', (d) => onLog(String(d)))
    proc.stderr.on('data', (d) => { err = String(d); onLog(String(d)) })
    proc.on('error', reject)
    proc.on('close', (code) => {
      installerProc = null
      if (code === 0) resolve()
      else if (code == null) {
        const e: any = new Error('Установка отменена')
        e.cancelled = true
        reject(e)
      } else reject(new Error(`Установщик завершился с кодом ${code}. ${err.slice(-300)}`))
    })
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
