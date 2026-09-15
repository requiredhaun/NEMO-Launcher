import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import './styles/app.css'
import { DotBackground } from './components/DotBackground'
import { TitleBar } from './components/TitleBar'
import { GlyphLoader } from './components/GlyphLoader'
import { Home } from './pages/Home'
import { Instances } from './pages/Instances'
import { Versions } from './pages/Versions'
import { Mods } from './pages/Mods'
import { Modpacks } from './pages/Modpacks'
import { Settings } from './pages/Settings'
import { Login } from './pages/Login'
import { bindGameEvents } from './store/gameStore'
import { useAuth } from './store/authStore'
import { useInstances } from './store/instancesStore'
import { call } from './lib/ipc'

const NAV = [
  ['/', 'ИГРАТЬ'], ['/instances', 'БИБЛИОТЕКА'], ['/versions', 'ВЕРСИЯ'],
  ['/mods', 'МОДЫ'], ['/packs', 'СБОРКИ'], ['/login', 'АККАУНТ'], ['/settings', 'НАСТРОЙКИ'],
]

function AnimatedRoutes() {
  const loc = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div key={loc.pathname} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
        <Routes location={loc}>
          <Route path="/" element={<Home />} />
          <Route path="/instances" element={<Instances />} />
          <Route path="/versions" element={<Versions />} />
          <Route path="/mods" element={<Mods />} />
          <Route path="/packs" element={<Modpacks />} />
          <Route path="/login" element={<Login />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function Sidebar() {
  const { instances, create } = useInstances()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  const quickCreate = async () => {
    if (busy) return
    setBusy(true)
    try {
      let mc = '1.21.11'
      try {
        const m = await call<any>('versions:manifest')
        if (m?.latest?.release) mc = m.latest.release
      } catch { /* fallback */ }
      await create(`Сборка ${instances.length + 1}`, mc)
      nav('/instances')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="sidebar">
      {NAV.map(([to, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          {({ isActive }) => (
            <>
              <span className="dot" />{label}
              {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            </>
          )}
        </NavLink>
      ))}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <motion.button
          className="btn play" title="Новая сборка" onClick={quickCreate} disabled={busy}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
          style={{ padding: '10px 0', fontSize: 20 }}
        >
          {busy ? '…' : '+'}
        </motion.button>
        <div className="badge" style={{ textAlign: 'center' }}>v{__APP_VERSION__}</div>
      </div>
    </aside>
  )
}

function Shell() {
  const { refresh } = useAuth()
  const [boot, setBoot] = useState(true)
  useEffect(() => {
    bindGameEvents()
    let alive = true
    refresh().finally(() => { if (alive) setTimeout(() => alive && setBoot(false), 900) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="app">
      <TitleBar />
      {boot ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {'NEMO'.split('').map((ch, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i, type: 'spring', stiffness: 320, damping: 22 }}
                  style={{ fontFamily: 'var(--font-dot)', fontSize: 46, letterSpacing: 6 }}
                >
                  {ch}
                </motion.span>
              ))}
            </div>
            <div className="pixel-divider" style={{ width: 180, margin: '14px auto' }} />
            <GlyphLoader text="загрузка" />
          </div>
        </div>
      ) : (
        <div className="layout">
          <Sidebar />
          <main className="main">
            <AnimatedRoutes />
          </main>
        </div>
      )}
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <DotBackground />
      <Shell />
    </HashRouter>
  )
}
