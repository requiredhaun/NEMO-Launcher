import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { call } from '../lib/ipc'
import { useGame } from '../store/gameStore'
import { useInstances, selectedInstance } from '../store/instancesStore'

const CRUMBS: Record<string, string> = {
  '/': 'Играть',
  '/instances': 'Библиотека',
  '/versions': 'Версия',
  '/mods': 'Моды',
  '/packs': 'Сборки',
  '/login': 'Аккаунт',
  '/settings': 'Настройки',
}

function Crumbs() {
  const loc = useLocation()
  const { instances, selectedId } = useInstances()
  const inst = selectedInstance(instances, selectedId)
  const page = CRUMBS[loc.pathname] || ''
  const showInst = inst && ['/versions', '/mods', '/packs'].includes(loc.pathname)
  return (
    <div className="crumbs">
      <span className="crumb-dim">NEMO</span>
      <span className="crumb-sep">/</span>
      <span>{page}</span>
      {showInst && inst && (
        <>
          <span className="crumb-sep">/</span>
          <span className="crumb-dim">{inst.name}</span>
        </>
      )}
    </div>
  )
}

function RunningPill() {
  const { launching, playing, progress, status } = useGame()
  const { instances, selectedId } = useInstances()
  const inst = selectedInstance(instances, selectedId)
  if (!launching && !playing) return null
  return (
    <AnimatePresence>
      <motion.div
        className={'run-pill' + (playing ? ' live' : '')}
        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
        title={status}
      >
        <span className="run-dot" />
        {playing ? `В игре${inst ? `: ${inst.name}` : ''}` : `${Math.round(progress * 100)}% · запуск`}
      </motion.div>
    </AnimatePresence>
  )
}

export function TitleBar() {
  return (
    <div className="titlebar">
      <div className="brand">NEMO</div>
      <Crumbs />
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: 0 }}>
        <RunningPill />
        <div className="win-btns">
          <button onClick={() => call('window:minimize')}>—</button>
          <button onClick={() => call('window:maximize')}>▢</button>
          <button onClick={() => call('window:close')} style={{ borderColor: '#5a1113' }}>✕</button>
        </div>
      </div>
    </div>
  )
}
