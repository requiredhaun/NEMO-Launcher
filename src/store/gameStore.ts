import { create } from 'zustand'
import { call } from '../lib/ipc'
import { t } from '../lib/i18n'

interface GameState {
  status: string
  phase: string
  progress: number
  log: string[]
  launching: boolean
  playing: boolean
  launchingId: string
  launch: (instanceId: string) => Promise<void>
  cancel: () => Promise<void>
}

export const useGame = create<GameState>((set) => ({
  status: t('game.ready'), phase: 'idle', progress: 0, log: [], launching: false, playing: false, launchingId: '',
  launch: async (instanceId) => {
    lastPhase = ''
    set({ launching: true, playing: false, launchingId: instanceId, status: t('game.launching'), phase: 'download', progress: 0 })
    await call('launch:launch', { instanceId })
  },
  cancel: async () => {
    lastPhase = ''
    try { await call('launch:cancel', {}) } catch { /* ignore */ }
    set({ launching: false, launchingId: '', status: t('game.cancelling'), phase: 'download', progress: 0 })
  },
}))

/** Человеческие подписи фаз закачки MLC. */
function phaseLabel(type: string): string | null {
  if (!type) return null
  if (type.startsWith('java')) return 'Java'
  if (type === 'version-jar') return t('phase.client')
  if (type === 'assets') return t('phase.assets')
  if (type === 'assets-copy') return t('phase.assets_copy')
  if (type === 'natives') return t('phase.natives')
  if (type === 'libraries' || type === 'minecraft-libraries') return t('phase.libs')
  if (type === 'forge' || type === 'files') return t('phase.files')
  return null
}

let bound = false
let lastPhase = ''

export function bindGameEvents() {
  if (bound) return
  bound = true
  window.nema.on('launch:status', (d: any) => {
    if (d.phase === 'run') {
      lastPhase = ''
      useGame.setState({ status: d.status, phase: d.phase, launching: false, playing: true, progress: 1 })
    } else if (d.phase === 'error') {
      lastPhase = ''
      useGame.setState({ status: d.status, phase: d.phase, launching: false, playing: false })
    } else {
      if (d.phase === 'download') lastPhase = ''
      useGame.setState({ status: d.status, phase: d.phase })
    }
  })
  // Прогресс MLC идёт по фазам (каждая с нуля) и по файлам — бар дёргался
  // туда-сюда. Держим монотонный прогресс: только вперёд, до 99%.
  const push = (value: number, type?: string) => {
    if (!Number.isFinite(value)) return
    const v = Math.max(0, Math.min(0.99, value))
    useGame.setState((s) => {
      const next: Partial<GameState> = {}
      if (v > s.progress) next.progress = v
      const label = phaseLabel(type || '')
      if (label && label !== lastPhase && s.launching) {
        lastPhase = label
        next.status = t('game.downloading', { label })
      }
      return Object.keys(next).length ? next : s
    })
  }
  window.nema.on('launch:progress', (d: any) => {
    if (d.total && d.task != null) push(d.task / d.total, d.type || d.kind)
    else if (d.total && d.current != null) push(d.current / d.total, d.type)
  })
  window.nema.on('game:log', (d: any) => {
    useGame.setState((s) => ({ log: [...s.log.slice(-300), `[${d.level}] ${d.line}`] }))
  })
  window.nema.on('game:closed', () => {
    lastPhase = ''
    useGame.setState({ launching: false, playing: false, launchingId: '', status: t('game.ready'), phase: 'idle', progress: 0 })
  })
}
