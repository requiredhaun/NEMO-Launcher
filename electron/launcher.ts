import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { app } from 'electron'
import { Client, Authenticator } from 'minecraft-launcher-core'
import { dashed } from './auth'
import { buildCustomArgs } from './flags'
import { versionType, mergeInherits, verifyClientJar, jvmArgsFromJson } from './versions'

const ELY_AUTH = 'https://authserver.ely.by'

/**
 * authlib-injector нужен чтобы Ely.by-сессия реально работала в игре
 * (скины + вход на серверы). Без него токен Ely бесполезен для Mojang-auth.
 * Качаем latest с GitHub один раз в кэш; если сети нет — играем как есть.
 */
async function injectorArgs(gameDir: string, emit: (c: string, d: unknown) => void): Promise<string[]> {
  try {
    const dir = path.join(app.getPath('userData'), 'cache', 'authlib')
    fs.mkdirSync(dir, { recursive: true })
    const existing = fs.readdirSync(dir).find((f) => f.startsWith('authlib-injector-') && f.endsWith('.jar'))
    let jar = existing ? path.join(dir, existing) : ''
    if (!jar) {
      emit('launch:status', { phase: 'download', status: 'Качаю authlib-injector для Ely.by…' })
      const rel: any = await (await fetch('https://api.github.com/yushijinhun/authlib-injector/releases/latest')).json()
      const asset = (rel?.assets || []).find((a: any) => String(a.name).endsWith('.jar') && !String(a.name).includes('sources'))
      if (!asset?.browser_download_url) return []
      jar = path.join(dir, String(asset.name))
      fs.writeFileSync(jar, Buffer.from(await (await fetch(asset.browser_download_url)).arrayBuffer()))
    }
    return [`-javaagent:${jar}=${ELY_AUTH}`, '-Dauthlibinjector.mojang.apiurl=https://authserver.mojang.com']
  } catch {
    return []
  }
}

function applyWindowOptions(gameDir: string, fullscreen: boolean, width: number, height: number): void {
  const file = path.join(gameDir, 'options.txt')
  let lines: string[] = []
  try { lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter((l) => l.trim() !== '') } catch { /* new */ }
  const set = (k: string, v: string) => {
    const i = lines.findIndex((l) => l.startsWith(`${k}:`))
    if (i >= 0) lines[i] = `${k}:${v}`
    else lines.push(`${k}:${v}`)
  }
  set('overrideWidth', String(Math.max(320, Math.floor(width))))
  set('overrideHeight', String(Math.max(240, Math.floor(height))))
  set('fullscreen', fullscreen ? 'true' : 'false')
  fs.mkdirSync(gameDir, { recursive: true })
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf-8')
}

export interface LaunchOptions {
  versionId: string; nick: string; gameDir: string; ramMB: number
  javaPath?: string; flagsPreset: string; customFlags: string
  fullscreen: boolean; gameWidth: number; gameHeight: number
  auth: { mode: 'offline' | 'ely'; accessToken?: string; uuid?: string; name: string }
  server?: { host: string; port: number }
}

let running = false
export function isRunning(): boolean { return running }

// MLC не умеет отмену и не отдаёт handle процесса — отменяем флагом:
// после спавна добиваем java-процессы именно этой сборки (папка уникальна).
let cancelRequested = false
let currentDir = ''

export function requestLaunchCancel(): void { cancelRequested = true }
export function isLaunchCancelled(): boolean { return cancelRequested }
export function currentGameDir(): string { return currentDir }

function cancelledError(): any {
  const e: any = new Error('Запуск отменён')
  e.cancelled = true
  return e
}

/** Выбрать из процессов pid тех java, в командной строке которых есть gameDir. Чистая функция для тестов. */
export function findGamePids(procs: { pid: number; cmd: string }[], gameDir: string): number[] {
  const needle = gameDir.toLowerCase()
  return procs
    .filter((p) => p.pid > 0 && p.cmd && p.cmd.toLowerCase().includes(needle))
    .map((p) => p.pid)
}

export async function killGameProcesses(gameDir: string): Promise<number> {
  try {
    if (process.platform === 'win32') {
      const out: string = await new Promise((res) => {
        execFile(
          'powershell',
          ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='java.exe' OR Name='javaw.exe'" | ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }`],
          { windowsHide: true, timeout: 15000 },
          (_e, stdout) => res(String(stdout || '')),
        )
      })
      const procs = out.split(/\r?\n/).map((l) => {
        const m = l.match(/^\s*(\d+)\|(.*)$/)
        return m ? { pid: Number(m[1]), cmd: m[2] } : null
      }).filter(Boolean) as { pid: number; cmd: string }[]
      let n = 0
      for (const pid of findGamePids(procs, gameDir)) {
        try { process.kill(pid); n++ } catch { /* уже мёртв */ }
      }
      return n
    }
    const { execFileSync } = await import('node:child_process')
    try {
      const out = String(execFileSync('ps', ['-eo', 'pid,args']))
      const procs = out.split('\n').map((l) => {
        const m = l.trim().match(/^(\d+)\s+(.*)$/)
        return m ? { pid: Number(m[1]), cmd: m[2] } : null
      }).filter(Boolean) as { pid: number; cmd: string }[]
      let n = 0
      for (const pid of findGamePids(procs.filter((p) => /java/.test(p.cmd)), gameDir)) {
        try { process.kill(pid, 'SIGKILL'); n++ } catch { /* ignore */ }
      }
      return n
    } catch { return 0 }
  } catch {
    return 0
  }
}

export async function launchGame(opts: LaunchOptions, emit: (c: string, d: unknown) => void): Promise<void> {
  if (running) throw new Error('Игра уже запущена')
  running = true
  currentDir = opts.gameDir
  if (cancelRequested) {
    cancelRequested = false
    running = false
    currentDir = ''
    throw cancelledError()
  }
  try {
    const lc = new Client()
    const authorization: any =
      opts.auth.mode === 'ely' && opts.auth.accessToken && opts.auth.uuid
        ? { access_token: opts.auth.accessToken, name: opts.auth.name, uuid: dashed(opts.auth.uuid), user_properties: '{}' }
        : Authenticator.getAuth(opts.nick || 'Player')
    applyWindowOptions(opts.gameDir, opts.fullscreen, opts.gameWidth, opts.gameHeight)
    const type = await versionType(opts.gameDir, opts.versionId)
    // forge/neoforge json с inheritsFrom чиним в плоский перед запуском
    try {
      await mergeInherits(opts.gameDir, opts.versionId)
    } catch (e: any) {
      throw new Error(`Файл версии битый, переустанови загрузчик: ${e?.message || e}`)
    }
    // оборванный jar навсегда ломал бы запуск — удаляем, MLC скачает заново
    const check = verifyClientJar(opts.gameDir, opts.versionId)
    if (!check.ok) throw new Error('Файл версии не читается, переустанови версию')
    if (check.repaired) emit('launch:status', { phase: 'download', status: 'Нашёл битый файл, качаю заново…' })
    emit('launch:status', { phase: 'download', status: 'Загрузка файлов игры…' })
    lc.on('progress', (v: any) => emit('launch:progress', { type: v?.type, kind: v?.kind, task: v?.task, total: v?.total }))
    lc.on('download-status', (v: any) => emit('launch:progress', { type: v?.type, name: v?.name, current: v?.current, total: v?.total }))
    lc.on('debug', (e: any) => { if (e) emit('game:log', { level: 'debug', line: String(e) }) })
    lc.on('data', (e: any) => { if (e) emit('game:log', { level: 'info', line: String(e) }) })
    lc.on('close', (code: number) => { running = false; currentDir = ''; emit('game:closed', { code }) })
    // MLC не читает arguments.jvm из json — модульные флаги Forge/NeoForge
    // (-p, --add-modules, --add-opens) подсовываем сами через customArgs
    let versionJson: any = null
    try {
      versionJson = JSON.parse(fs.readFileSync(path.join(opts.gameDir, 'versions', opts.versionId, `${opts.versionId}.json`), 'utf-8'))
    } catch { /* verifyClientJar ниже даст понятную ошибку */ }
    const customArgs = [
      ...(versionJson ? jvmArgsFromJson(versionJson, { gameDir: opts.gameDir, versionId: opts.versionId, sep: process.platform === 'win32' ? ';' : ':' }) : []),
      ...buildCustomArgs(opts.flagsPreset, opts.customFlags),
    ]
    if (opts.auth.mode === 'ely') customArgs.unshift(...(await injectorArgs(opts.gameDir, emit)))
    await lc.launch({
      root: opts.gameDir,
      version: { number: opts.versionId, type: type || 'release' },
      authorization,
      memory: { max: String(Math.floor(opts.ramMB)), min: String(Math.min(Math.floor(opts.ramMB), 2048)) },
      javaPath: opts.javaPath || undefined,
      customArgs,
      overrides: { detached: false } as any,
    })
    if (cancelRequested) {
      // отмена прилетела во время скачивания: процесс уже заспавнен — добиваем
      cancelRequested = false
      running = false
      await killGameProcesses(opts.gameDir)
      currentDir = ''
      throw cancelledError()
    }
  } catch (e) {
    running = false
    currentDir = ''
    throw e
  }
}
