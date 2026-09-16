import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { call } from '../lib/ipc'
import { t, useLang } from '../lib/i18n'
import { useGame } from '../store/gameStore'
import { useInstances, selectedInstance } from '../store/instancesStore'

const CRUMBS: Record<string, string> = {
  '/': 'nav.home',
  '/instances': 'nav.instances',
  '/versions': 'nav.versions',
  '/mods': 'nav.mods',
  '/packs': 'nav.packs',
  '/login': 'crumb.login',
  '/settings': 'nav.settings',
}

function Crumbs() {
  useLang()
  const loc = useLocation()
  const { instances, selectedId } = useInstances()
  const inst = selectedInstance(instances, selectedId)
  const key = CRUMBS[loc.pathname]
  const page = key ? t(key) : ''
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
  useLang()
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
        {playing ? (inst ? t('titlebar.ingame_named', { name: inst.name }) : t('titlebar.ingame')) : t('titlebar.launching', { pct: Math.round(progress * 100) })}
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
