import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { Client, Authenticator } from 'minecraft-launcher-core'
import { dashed } from './auth'
import { buildCustomArgs } from './flags'
import { versionType } from './versions'

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

export async function launchGame(opts: LaunchOptions, emit: (c: string, d: unknown) => void): Promise<void> {
  if (running) throw new Error('Игра уже запущена')
  running = true
  try {
    const lc = new Client()
    const authorization: any =
      opts.auth.mode === 'ely' && opts.auth.accessToken && opts.auth.uuid
        ? { access_token: opts.auth.accessToken, name: opts.auth.name, uuid: dashed(opts.auth.uuid), user_properties: '{}' }
        : Authenticator.getAuth(opts.nick || 'Player')
    applyWindowOptions(opts.gameDir, opts.fullscreen, opts.gameWidth, opts.gameHeight)
    const type = await versionType(opts.gameDir, opts.versionId)
    emit('launch:status', { phase: 'download', status: 'Загрузка файлов игры…' })
    lc.on('progress', (v: any) => emit('launch:progress', { type: v?.type, kind: v?.kind, task: v?.task, total: v?.total }))
    lc.on('download-status', (v: any) => emit('launch:progress', { type: v?.type, name: v?.name, current: v?.current, total: v?.total }))
    lc.on('debug', (e: any) => { if (e) emit('game:log', { level: 'debug', line: String(e) }) })
    lc.on('data', (e: any) => { if (e) emit('game:log', { level: 'info', line: String(e) }) })
    lc.on('close', (code: number) => { running = false; emit('game:closed', { code }) })
    const customArgs = buildCustomArgs(opts.flagsPreset, opts.customFlags)
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
  } catch (e) {
    running = false
    throw e
  }
}
