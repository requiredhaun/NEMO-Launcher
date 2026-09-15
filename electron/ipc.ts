import { ipcMain, dialog, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { getMainWindow } from './main'
import { getConfig, updateConfig, totalRamMB, recommendedRamMB, defaultGameDir, type LauncherConfig } from './settings'
import { createInstance, listInstances, deleteInstance, readInstance, writeInstance, type Instance } from './instances'
import { elyEnsureValid, elyLogin, elyLogout, loadSession } from './auth'
import {
  getManifest, installedVersions, fabricLoaders, installFabric, quiltLoaders, installQuilt,
  forgePromos, forgeFull, downloadForgeInstaller, downloadNeoForgeInstaller, neoforgeVersions,
  matchInstalledVersion, loaderSupport, runModdedInstaller, detectJava, ensureLauncherProfile, mergeInherits,
} from './versions'
import { launchGame } from './launcher'
import { FLAG_PRESETS } from './flags'
import { ensureJavaRuntime, parseJavaMajor, majorForMc } from './javaRuntime'
import { searchProjects, projectVersions, pickVersion, downloadUrl, MOD_CATEGORIES, type ModVersion } from './modrinth'
import { planDests, safeDest, writeFileChecked, pool } from './mrpack'
import { listMods, toggleMod, deleteMod, addModFile, listWorlds } from './mods'
import { rpcIdle, rpcLaunching, rpcPlaying, rpcClear } from './rpc'

type Handler = (payload: any) => Promise<unknown> | unknown

function userData(): string { return app.getPath('userData') }

/**
 * Java для запуска установщиков Forge/NeoForge: нужна 17+.
 * Системная не подходит или её нет — качаем рантайм Mojang, как для игры.
 */
async function installerJava(gameDir: string, mc: string, send: (l: string) => void): Promise<string> {
  const cfg = getConfig()
  const detected = await detectJava(cfg.javaPath)
  if (detected && parseJavaMajor(detected.version) >= 17) {
    return cfg.javaPath || detected.path
  }
  const need = Math.max(17, majorForMc(mc))
  send(`Системная Java не подходит для установщика — качаю Java ${need}…`)
  return ensureJavaRuntime(gameDir, need, (done, total, name) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.webContents.send('launch:progress', { type: 'java', kind: `Java ${need}`, name, task: done, total })
  })
}

function resolveInstance(payload: any): Instance {
  const cfg = getConfig()
  const id = String(payload?.instanceId || cfg.selectedInstanceId || '')
  const inst = id ? readInstance(path.join(userData(), 'instances', id)) : null
  if (inst) return inst
  // fallback: legacy single gameDir as virtual instance
  return {
    id: 'legacy', name: 'Legacy', mcVersion: cfg.version || '1.21.11',
    loader: 'vanilla', loaderVersion: '', versionId: cfg.version || '1.21.11',
    ramMB: cfg.ramMB, gameDir: cfg.gameDir, createdAt: 0,
  }
}

async function ensureVersionJson(versionId: string, gameDir: string): Promise<any> {
  const local = path.join(gameDir, 'versions', versionId, `${versionId}.json`)
  try { return JSON.parse(fs.readFileSync(local, 'utf-8')) } catch { /* download */ }
  const manifest = await getManifest()
  const entry = manifest.versions.find((v) => v.id === versionId)
  if (!entry?.url) throw new Error(`Версия ${versionId} не найдена`)
  const res = await fetch(entry.url)
  if (!res.ok) throw new Error(`version.json: ${res.status}`)
  const json = await res.json()
  fs.mkdirSync(path.dirname(local), { recursive: true })
  fs.writeFileSync(local, JSON.stringify(json), 'utf-8')
  return json
}

async function installModVersion(v: ModVersion, modsDir: string, installed: string[], visited: Set<string>): Promise<void> {
  if (visited.has(v.id)) return
  visited.add(v.id)
  const file = v.files.find((f) => f.primary) || v.files[0]
  if (!file?.url) throw new Error('Файл версии не найден')
  const target = path.join(modsDir, path.basename(file.filename))
  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, await downloadUrl(file.url))
    installed.push(file.filename)
  }
  for (const dep of v.dependencies || []) {
    if (dep.dependency_type !== 'required' || !dep.project_id || visited.has(dep.project_id)) continue
    visited.add(dep.project_id)
    try {
      const cands = await projectVersions(dep.project_id, v.game_versions[0], v.loaders[0])
      if (cands[0]) await installModVersion(cands[0], modsDir, installed, visited)
    } catch { /* optional */ }
  }
}

const handlers: Record<string, Handler> = {
  'config:get': () => getConfig(),
  'config:set': (p) => {
    const patch = { ...(p as Partial<LauncherConfig>) }
    if (patch.ramMB != null) patch.ramMB = Math.min(16384, Math.max(512, Math.floor(Number(patch.ramMB) || 4096)))
    if (patch.gameWidth != null) patch.gameWidth = Math.min(7680, Math.max(320, Math.floor(Number(patch.gameWidth) || 1280)))
    if (patch.gameHeight != null) patch.gameHeight = Math.min(4320, Math.max(240, Math.floor(Number(patch.gameHeight) || 720)))
    return updateConfig(patch)
  },
  'config:flagPresets': () => FLAG_PRESETS,
  'system:info': () => ({ totalRamMB: totalRamMB(), recommendedRamMB: recommendedRamMB(), platform: process.platform, userData: userData() }),

  'instances:list': () => listInstances(userData()),
  'instances:create': (p) => {
    const inst = createInstance(userData(), String(p?.name || 'Instance'), String(p?.mc || '1.21.11'))
    updateConfig({ selectedInstanceId: inst.id })
    return inst
  },
  'instances:select': (p) => updateConfig({ selectedInstanceId: String(p?.id || '') }),
  'instances:remove': (p) => {
    const inst = readInstance(path.join(userData(), 'instances', String(p?.id || '')))
    if (inst) deleteInstance(userData(), inst)
    return listInstances(userData())
  },
  'instances:update': (p) => {
    const inst = readInstance(path.join(userData(), 'instances', String(p?.id || '')))
    if (!inst) throw new Error('Инстанс не найден')
    // whitelist: id/gameDir/createdAt менять через IPC нельзя — иначе инстанс теряется
    const patch = (p?.patch || {}) as Partial<Instance>
    const next: Instance = {
      ...inst,
      ...(patch.name != null ? { name: String(patch.name).slice(0, 32) } : {}),
      ...(patch.mcVersion != null ? { mcVersion: String(patch.mcVersion) } : {}),
      ...(patch.loader != null ? { loader: patch.loader } : {}),
      ...(patch.loaderVersion != null ? { loaderVersion: String(patch.loaderVersion) } : {}),
      ...(patch.versionId != null ? { versionId: String(patch.versionId) } : {}),
      ...(patch.ramMB != null ? { ramMB: Math.min(16384, Math.max(512, Math.floor(Number(patch.ramMB)))) } : {}),
    }
    writeInstance(next)
    return next
  },

  'auth:state': async () => {
    const cfg = getConfig()
    if (cfg.authMode === 'ely') {
      const s = await elyEnsureValid()
      if (s) return { mode: 'ely', nick: s.profile.name }
      updateConfig({ authMode: 'offline' })
    }
    return { mode: 'offline' as const, nick: getConfig().nick }
  },
  'auth:offline': (p) => {
    const nick = String(p?.nick || '').trim()
    if (!/^[A-Za-z0-9_]{1,16}$/.test(nick)) throw new Error('Ник: 1–16 символов, латиница/цифры/_')
    updateConfig({ nick, authMode: 'offline' })
    return { mode: 'offline' as const, nick }
  },
  'auth:elyLogin': async (p) => {
    const s = await elyLogin(String(p?.login || ''), String(p?.password || ''))
    updateConfig({ nick: s.profile.name, authMode: 'ely' })
    return { mode: 'ely' as const, nick: s.profile.name }
  },
  'auth:elyLogout': async () => { await elyLogout(); updateConfig({ authMode: 'offline' }); return { mode: 'offline' as const } },

  'versions:manifest': async (p) => {
    const inst = resolveInstance(p)
    const m = await getManifest(!!p?.force)
    const installed = installedVersions(inst.gameDir)
    return { latest: m.latest, versions: m.versions.slice(0, 400).map((v) => ({ ...v, installed: installed.has(v.id) })) }
  },
  'versions:fabricLoaders': () => fabricLoaders(),
  'versions:quiltLoaders': (p) => quiltLoaders(String(p?.mc || '1.21.11')),
  'versions:forgePromos': () => forgePromos(),
  'versions:neoforge': (p) => neoforgeVersions(String(p?.mc || '1.21.11')),
  'versions:loaderSupport': (p) => loaderSupport(String(p?.mc || '')),
  'versions:install': async (p) => {
    const inst = resolveInstance(p)
    const loader = String(p?.loader || 'vanilla')
    const mc = String(p?.mc || inst.mcVersion)
    const win = getMainWindow()
    const send = (l: string) => { if (win && !win.isDestroyed()) win.webContents.send('install:log', l) }
    let versionId = mc
    if (loader === 'fabric') {
      const loaders = await fabricLoaders()
      const lv = String(p?.loaderVersion || '') || loaders.find((l) => l.stable)?.version || loaders[0]?.version
      versionId = (await installFabric(mc, lv, inst.gameDir)).id
    } else if (loader === 'quilt') {
      const loaders = await quiltLoaders(mc)
      const lv = String(p?.loaderVersion || '') || loaders[0]
      versionId = (await installQuilt(mc, lv, inst.gameDir)).id
    } else if (loader === 'forge') {
      const promos = await forgePromos()
      const full = forgeFull(mc, String(p?.full || promos[mc] || ''))
      if (!full) throw new Error(`Forge не вышел для Minecraft ${mc} — выбери Fabric, NeoForge или другую версию игры`)
      send(`Скачиваю Forge ${full}…`)
      const jar = await downloadForgeInstaller(full)
      const javaPath = await installerJava(inst.gameDir, mc, send)
      ensureLauncherProfile(inst.gameDir)
      await runModdedInstaller(jar, inst.gameDir, javaPath, send)
      const all = Array.from(installedVersions(inst.gameDir))
      versionId = matchInstalledVersion(all, mc, full) || mc
      if (versionId === mc) send('Установщик отработал, но версия не опознана — проверь список вручную')
      else await mergeInherits(inst.gameDir, versionId)
    } else if (loader === 'neoforge') {
      const vers = await neoforgeVersions(mc)
      const v = String(p?.full || '') || vers[0]
      if (!v) throw new Error(`NeoForge не вышел для Minecraft ${mc} — выбери Fabric, Forge или другую версию игры`)
      send(`Скачиваю NeoForge ${v}…`)
      const jar = await downloadNeoForgeInstaller(v)
      const javaPath = await installerJava(inst.gameDir, mc, send)
      ensureLauncherProfile(inst.gameDir)
      await runModdedInstaller(jar, inst.gameDir, javaPath, send)
      const all = Array.from(installedVersions(inst.gameDir))
      versionId = matchInstalledVersion(all, mc, v) || mc
      if (versionId !== mc) await mergeInherits(inst.gameDir, versionId)
    }
    const next: Instance = { ...inst, mcVersion: mc, loader: loader as any, loaderVersion: String(p?.loaderVersion || p?.full || ''), versionId }
    if (inst.id !== 'legacy') writeInstance(next)
    else updateConfig({ version: versionId, gameDir: inst.gameDir })
    return next
  },

  'launch:launch': async (p) => {
    const inst = resolveInstance(p)
    const cfg = getConfig()
    if (!inst.versionId) throw new Error('Выбери версию в инстансе')
    let auth: { mode: 'offline' | 'ely'; accessToken?: string; uuid?: string; name: string }
    if (cfg.authMode === 'ely') {
      const s = loadSession() || (await elyEnsureValid())
      if (!s) throw new Error('Сессия Ely.by истекла')
      auth = { mode: 'ely', accessToken: s.accessToken, uuid: s.profile.id, name: s.profile.name }
    } else {
      if (!cfg.nick) throw new Error('Укажи ник')
      auth = { mode: 'offline', name: cfg.nick }
    }
    const win = getMainWindow()
    const emit = (c: string, d: unknown) => {
      if (c === 'game:closed') void rpcClear()
      if (win && !win.isDestroyed()) win.webContents.send(c, d)
    }
    fs.mkdirSync(inst.gameDir, { recursive: true })
    rpcLaunching(inst.name)
    emit('launch:status', { phase: 'download', status: 'Подготовка версии…' })
    let javaPath = cfg.javaPath.trim()
    let major = majorForMc(inst.mcVersion)
    try { major = (await ensureVersionJson(inst.versionId, inst.gameDir))?.javaVersion?.majorVersion || major } catch { /* keep */ }
    if (!javaPath) {
      const detected = await detectJava('')
      const detectedMajor = detected ? parseJavaMajor(detected.version) : 0
      // рантайму Mojang достаточно >= (кроме legacy 8, где нужен ровно 8)
      const ok = major === 8 ? detectedMajor === 8 : detectedMajor >= major && detectedMajor > 0
      if (detected && ok) {
        javaPath = detected.path
      } else {
        emit('launch:status', { phase: 'download', status: `Качаю Java ${major}…` })
        javaPath = await ensureJavaRuntime(inst.gameDir, major, (done, total, name) =>
          emit('launch:progress', { type: 'java', kind: `Java ${major}`, name, task: done, total }))
      }
    }
    emit('launch:status', { phase: 'download', status: 'Загружаю файлы игры…' })
    launchGame({
      versionId: inst.versionId, nick: auth.name, gameDir: inst.gameDir,
      ramMB: inst.ramMB || cfg.ramMB, javaPath,
      flagsPreset: cfg.flagsPreset, customFlags: cfg.customFlags,
      fullscreen: cfg.fullscreenGame, gameWidth: cfg.gameWidth, gameHeight: cfg.gameHeight, auth,
      server: p?.server?.host ? { host: String(p.server.host), port: Number(p.server.port) || 25565 } : undefined,
    }, emit).then(() => { emit('launch:status', { phase: 'run', status: 'Игра запущена' }); rpcPlaying(inst.versionId, auth.name) })
      .catch((e) => { emit('launch:status', { phase: 'error', status: `Ошибка: ${e?.message || e}` }); emit('game:closed', { code: 1 }) })
    return { started: true }
  },
  'launch:openGameFolder': (p) => { const i = resolveInstance(p); fs.mkdirSync(i.gameDir, { recursive: true }); shell.openPath(i.gameDir) },

  'java:detect': () => detectJava(getConfig().javaPath),
  'java:pick': async () => {
    const r = await dialog.showOpenDialog(getMainWindow()!, { title: 'Выбери java.exe', properties: ['openFile'] })
    return r.canceled ? null : r.filePaths[0]
  },
  'gamedir:reset': () => updateConfig({ gameDir: defaultGameDir() }),

  'mods:list': (p) => listMods(resolveInstance(p).gameDir),
  'mods:toggle': (p) => ({ enabled: toggleMod(resolveInstance(p).gameDir, String(p?.file || '')) }),
  'mods:delete': (p) => { deleteMod(resolveInstance(p).gameDir, String(p?.file || p?.name || '')); return { ok: true } },
  'mods:addFiles': async (p) => {
    const inst = resolveInstance(p)
    const r = await dialog.showOpenDialog(getMainWindow()!, {
      title: 'Выбери .jar моды', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Моды Minecraft', extensions: ['jar'] }],
    })
    if (r.canceled) return { added: [] }
    return { added: r.filePaths.map((f) => addModFile(inst.gameDir, f)) }
  },
  'mods:addFilesByPath': (p) => {
    const inst = resolveInstance(p)
    const paths = ((p?.paths as string[]) || []).filter((f) => f.toLowerCase().endsWith('.jar'))
    if (!paths.length) throw new Error('Нужны .jar файлы')
    return { added: paths.map((f) => addModFile(inst.gameDir, f)) }
  },

  'saves:list': (p) => listWorlds(resolveInstance(p).gameDir),

  'paths:open': (p) => {
    const rel = String(p?.rel || '')
    if (rel.includes('..')) throw new Error('Некорректный путь')
    const base = resolveInstance(p).gameDir
    const target = rel ? path.join(base, ...rel.split('/')) : base
    fs.mkdirSync(target, { recursive: true })
    shell.openPath(target)
    return { ok: true }
  },
  'paths:openElyReg': () => { shell.openExternal('https://ely.by/reg'); return { ok: true } },
  'paths:openUrl': (p) => {
    const url = String(p?.url || '')
    if (/^https:\/\/(discord\.com|ptb\.discord\.com)\//.test(url)) shell.openExternal(url)
    return { ok: true }
  },
  'discord:refresh': () => { rpcIdle(); return { ok: true } },

  'modrinth:search': (p) => searchProjects(String(p?.query || ''), (p?.kind as any) || 'mod', String(p?.gameVersion || ''), String(p?.loader || ''), Number(p?.offset) || 0, (p?.categories as string[]) || []),
  'modrinth:categories': () => [...MOD_CATEGORIES],
  'modrinth:install': async (p) => {
    const inst = resolveInstance(p)
    const vers = await projectVersions(String(p?.projectId || ''), inst.mcVersion, inst.loader === 'vanilla' ? undefined : inst.loader)
    const v = pickVersion(vers, inst.mcVersion, inst.loader === 'vanilla' ? undefined : inst.loader)
    if (!v) throw new Error('Нет версии под этот инстанс')
    const modsDir = path.join(inst.gameDir, 'mods')
    fs.mkdirSync(modsDir, { recursive: true })
    const installed: string[] = []
    await installModVersion(v, modsDir, installed, new Set())
    return { installed }
  },
  'modrinth:installPack': async (p) => {
    const inst = resolveInstance(p)
    const vers = await projectVersions(String(p?.projectId || ''), inst.mcVersion, inst.loader === 'vanilla' ? undefined : inst.loader)
    const v = pickVersion(vers, inst.mcVersion, inst.loader === 'vanilla' ? undefined : inst.loader)
    if (!v) throw new Error('Нет сборки под этот инстанс')
    const mrpack = v.files.find((f) => f.filename.endsWith('.mrpack')) || v.files[0]
    const buf = await downloadUrl(mrpack.url)
    const tmp = path.join(app.getPath('userData'), 'cache', path.basename(mrpack.filename))
    fs.mkdirSync(path.dirname(tmp), { recursive: true })
    fs.writeFileSync(tmp, buf)
    const { default: AdmZip } = await import('adm-zip')
    const zip = new AdmZip(tmp)
    const indexRaw = zip.getEntry('modrinth.index.json')?.getData().toString('utf-8')
    if (!indexRaw) throw new Error('Битый .mrpack')
    const index = JSON.parse(indexRaw)
    const win = getMainWindow()
    const emit = (s: string) => { if (win && !win.isDestroyed()) win.webContents.send('install:log', s) }
    const planned = planDests(inst.gameDir, index.files || [])
    let done = 0
    emit(`Файлов сборки: ${planned.length} — качаю…`)
    await pool(planned, 6, async (f) => {
      writeFileChecked(f.dest, await downloadUrl(f.url), f.hashes)
      done++
      if (done % 5 === 0 || done === planned.length) emit(`Файлы сборки: ${done}/${planned.length}`)
    })
    for (const e of zip.getEntries()) {
      if (e.entryName.startsWith('overrides/') && !e.isDirectory) {
        // zip-slip guard и для overrides
        const dest = safeDest(inst.gameDir, e.entryName.slice('overrides/'.length))
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(dest, e.getData())
      }
    }
    return { ok: true, files: planned.length }
  },
}

export function registerIpc(): void {
  const win = getMainWindow
  rpcIdle()
  ipcMain.handle('window:minimize', () => win()?.minimize())
  ipcMain.handle('window:maximize', () => { const w = win(); if (w) { if (w.isMaximized()) w.unmaximize(); else w.maximize() } })
  ipcMain.handle('window:close', () => win()?.close())
  for (const [ch, h] of Object.entries(handlers)) {
    ipcMain.handle(ch, async (_e, payload) => {
      try { return { ok: true, data: await h(payload) } }
      catch (e: any) { return { ok: false, error: e?.message || String(e) } }
    })
  }
}
