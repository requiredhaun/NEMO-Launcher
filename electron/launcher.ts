import fs from 'node:fs'
import path from 'node:path'
import { Client, Authenticator } from 'minecraft-launcher-core'
import { dashed } from './auth'
import { buildCustomArgs } from './flags'
import { versionType } from './versions'

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
    await lc.launch({
      root: opts.gameDir,
      version: { number: opts.versionId, type: type || 'release' },
      authorization,
      memory: { max: String(Math.floor(opts.ramMB)), min: String(Math.min(Math.floor(opts.ramMB), 2048)) },
      javaPath: opts.javaPath || undefined,
      customArgs: buildCustomArgs(opts.flagsPreset, opts.customFlags),
      overrides: { detached: false } as any,
    })
  } catch (e) {
    running = false
    throw e
  }
}
