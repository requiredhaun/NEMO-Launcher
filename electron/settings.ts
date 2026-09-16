import { app } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface ServerEntry { id: string; name: string; host: string; port: number }
export type AuthMode = 'offline' | 'ely'
export type Lang = 'ru' | 'en'

export type Accent = 'red' | 'green' | 'purple' | 'blue' | 'orange' | 'white'

export interface ThemeConfig {
  mode: 'dark' | 'light'
  accent: Accent
  dots: boolean
  glow: boolean
  animations: boolean
  dotFont: boolean
  compact: boolean
}

export interface LauncherConfig {
  nick: string
  authMode: AuthMode
  language: Lang
  ramMB: number
  javaPath: string
  gameDir: string
  version: string
  flagsPreset: string
  customFlags: string
  fullscreenGame: boolean
  gameWidth: number
  gameHeight: number
  servers: ServerEntry[]
  theme: ThemeConfig
  discordRpc: boolean
  discordClientId: string
  windowBounds?: { x?: number; y?: number; width: number; height: number }
  selectedInstanceId?: string
}

export function defaultGameDir(): string {
  return path.join(app.getPath('userData'), 'minecraft')
}

export function defaultTheme(): ThemeConfig {
  return { mode: 'dark', accent: 'red', dots: true, glow: true, animations: true, dotFont: true, compact: false }
}

function defaults(): LauncherConfig {
  return {
    nick: '',
    authMode: 'offline',
    language: 'ru',
    ramMB: recommendedRamMB(),
    javaPath: '',
    gameDir: defaultGameDir(),
    version: '',
    flagsPreset: 'standard',
    customFlags: '',
    fullscreenGame: false,
    gameWidth: 1280,
    gameHeight: 720,
    servers: [],
    theme: defaultTheme(),
    // Discord RPC включён из коробки: присутствие видно сразу после скачивания
    discordRpc: true,
    discordClientId: '1549482343906152498',
  }
}

const file = () => path.join(app.getPath('userData'), 'config.json')

export function getConfig(): LauncherConfig {
  try {
    const raw = fs.readFileSync(file(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<LauncherConfig>
    const cfg = { ...defaults(), ...parsed, theme: { ...defaultTheme(), ...(parsed.theme || {}) } }
    if (!cfg.discordClientId?.trim()) cfg.discordClientId = defaults().discordClientId
    if (cfg.language !== 'en' && cfg.language !== 'ru') cfg.language = 'ru'
    return cfg
  } catch {
    return defaults()
  }
}

export function updateConfig(patch: Partial<LauncherConfig>): LauncherConfig {
  const cur = getConfig()
  const next = { ...cur, ...patch, theme: { ...cur.theme, ...(patch.theme || {}) } }
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(file(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}

export function totalRamMB(): number {
  return Math.max(1024, Math.floor(os.totalmem() / 1024 / 1024))
}

export function recommendedRamMB(): number {
  const total = totalRamMB()
  return Math.min(8192, Math.max(2048, Math.floor(total / 2 / 512) * 512))
}
