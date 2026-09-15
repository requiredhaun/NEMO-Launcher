import { create } from 'zustand'
import { call } from '../lib/ipc'

interface GameState {
  status: string
  phase: string
  progress: number
  log: string[]
  launching: boolean
  playing: boolean
  launch: (instanceId: string) => Promise<void>
}

export const useGame = create<GameState>((set) => ({
  status: 'Готов', phase: 'idle', progress: 0, log: [], launching: false, playing: false,
  launch: async (instanceId) => {
    set({ launching: true, playing: false, status: 'Запуск…', phase: 'download', progress: 0.05 })
    await call('launch:launch', { instanceId })
  },
}))

let bound = false
export function bindGameEvents() {
  if (bound) return
  bound = true
  window.nema.on('launch:status', (d: any) => {
    if (d.phase === 'run') useGame.setState({ status: d.status, phase: d.phase, launching: false, playing: true })
    else if (d.phase === 'error') useGame.setState({ status: d.status, phase: d.phase, launching: false, playing: false })
    else useGame.setState({ status: d.status, phase: d.phase })
  })
  window.nema.on('launch:progress', (d: any) => {
    if (d.total && d.task != null) useGame.setState({ progress: Math.min(0.99, d.task / d.total) })
    else if (d.total && d.current != null) useGame.setState({ progress: Math.min(0.99, d.current / d.total) })
  })
  window.nema.on('game:log', (d: any) => {
    useGame.setState((s) => ({ log: [...s.log.slice(-300), `[${d.level}] ${d.line}`] }))
  })
  window.nema.on('game:closed', () => useGame.setState({ launching: false, playing: false, status: 'Готов', phase: 'idle', progress: 0 }))
}
