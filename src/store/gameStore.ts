import { create } from 'zustand'
import { call } from '../lib/ipc'

interface GameState {
  status: string
  phase: string
  progress: number
  log: string[]
  launching: boolean
  launch: (instanceId: string) => Promise<void>
}

export const useGame = create<GameState>((set) => ({
  status: 'Готов', phase: 'idle', progress: 0, log: [], launching: false,
  launch: async (instanceId) => {
    set({ launching: true, status: 'Запуск…', phase: 'download', progress: 0.05 })
    await call('launch:launch', { instanceId })
  },
}))

let bound = false
export function bindGameEvents() {
  if (bound) return
  bound = true
  window.nema.on('launch:status', (d: any) => {
    useGame.setState({ status: d.status, phase: d.phase, launching: d.phase === 'download' || d.phase === 'run' ? useGame.getState().launching : false })
    if (d.phase === 'error') useGame.setState({ launching: false })
  })
  window.nema.on('launch:progress', (d: any) => {
    if (d.total && d.task != null) useGame.setState({ progress: Math.min(0.99, d.task / d.total) })
    else if (d.total && d.current != null) useGame.setState({ progress: Math.min(0.99, d.current / d.total) })
  })
  window.nema.on('game:log', (d: any) => {
    useGame.setState((s) => ({ log: [...s.log.slice(-300), `[${d.level}] ${d.line}`] }))
  })
  window.nema.on('game:closed', () => useGame.setState({ launching: false, status: 'Готов', phase: 'idle', progress: 0 }))
}
