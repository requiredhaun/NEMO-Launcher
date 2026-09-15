import { getConfig } from './settings'

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

/** Лаунчер открыт — «сидит в NEMO». */
export function rpcIdle(): void {
  void set({ details: 'Сидит в NEMO', state: 'Выбирает сборку', instance: false })
}

/** Пошёл запуск сборки. */
export function rpcLaunching(name: string): void {
  void set({ details: `Запускает «${name}»`, state: 'Загрузка файлов игры…', instance: false })
}

/** Игра запущена — «Minecraft <версия> как <ник>» с таймером сессии. */
export function rpcPlaying(versionId: string, nick: string): void {
  void set({ details: `Minecraft ${versionId}`, state: `Играет как ${nick}`, startTimestamp: Date.now(), instance: false })
}

/** Игра закрыта — назад в idle; если выключено — рвём соединение. */
export async function rpcClear(): Promise<void> {
  if (rpcEnabled()) {
    await set({ details: 'Сидит в NEMO', state: 'Выбирает сборку', instance: false })
    return
  }
  const c = client
  client = null
  try { await c?.disconnect?.() } catch { /* ignore */ }
}
