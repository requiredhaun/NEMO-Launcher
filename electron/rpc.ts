import { getConfig } from './settings'
import { tl } from './i18n'

/**
 * Discord Rich Presence — опционально, полностью отказоустойчиво:
 * Discord не запущен / выключено / нет Client ID / любые ошибки — молча игнорируем.
 */

let client: any = null
let connecting: Promise<void> | null = null

function rpcEnabled(): boolean {
  const cfg = getConfig()
  return cfg.discordRpc && !!cfg.discordClientId.trim()
}

async function getClient(): Promise<any | null> {
  if (!rpcEnabled()) return null
  if (client) return client
  if (!connecting) {
    connecting = (async () => {
      try {
        const mod: any = await import('discord-rich-presence')
        const create = mod.default || mod
        client = create(getConfig().discordClientId.trim())
        client.on?.('error', () => { client = null })
        client.on?.('disconnected', () => { client = null })
      } catch {
        client = null
      }
    })().finally(() => { connecting = null })
  }
  await connecting
  return client
}

async function set(activity: Record<string, unknown>): Promise<void> {
  try {
    const c = await getClient()
    if (!c) return
    await c.updatePresence(activity)
  } catch {
    client = null
  }
}

function idleActivity(): Record<string, unknown> {
  return { details: tl('rpc.idleD'), state: tl('rpc.idleS'), largeImageKey: 'nemo', largeImageText: 'NEMO Launcher', instance: false }
}

/** Лаунчер открыт — «сидит в NEMO». */
export function rpcIdle(): void {
  void set(idleActivity())
}

/** Пошёл запуск сборки. */
export function rpcLaunching(name: string): void {
  void set({ details: tl('rpc.launchD', { name }), state: tl('rpc.launchS'), largeImageKey: 'nemo', largeImageText: 'NEMO Launcher', instance: false })
}

/** Игра запущена — «Minecraft <версия> как <ник>» с таймером сессии. */
export function rpcPlaying(versionId: string, nick: string): void {
  void set({ details: `Minecraft ${versionId}`, state: tl('rpc.playS', { nick }), startTimestamp: Date.now(), largeImageKey: 'nemo', largeImageText: 'NEMO Launcher', instance: false })
}

/** Игра закрыта — назад в idle; если выключено — рвём соединение. */
export async function rpcClear(): Promise<void> {
  if (rpcEnabled()) {
    await set(idleActivity())
    return
  }
  const c = client
  client = null
  try { await c?.disconnect?.() } catch { /* ignore */ }
}
