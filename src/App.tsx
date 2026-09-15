import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import './styles/app.css'
import { DotBackground } from './components/DotBackground'
import { TitleBar } from './components/TitleBar'
import { Home } from './pages/Home'
import { Instances } from './pages/Instances'
import { Versions } from './pages/Versions'
import { Mods } from './pages/Mods'
import { Modpacks } from './pages/Modpacks'
import { Settings } from './pages/Settings'
import { Login } from './pages/Login'
import { bindGameEvents } from './store/gameStore'
import { useAuth } from './store/authStore'

const NAV = [
  ['/', 'PLAY'], ['/instances', 'INSTANCES'], ['/versions', 'VERSIONS'],
  ['/mods', 'MODS'], ['/packs', 'MODPACKS'], ['/login', 'ACCOUNT'], ['/settings', 'SETTINGS'],
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

export function App() {
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
    <HashRouter>
      <DotBackground />
      <div className="app">
        <TitleBar />
        {boot ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div style={{ fontFamily: 'var(--font-dot)', fontSize: 42, letterSpacing: 8 }}>NEMA<b style={{ color: 'var(--red)' }}>●</b></div>
              <div className="pixel-divider" />
              <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 4, color: 'var(--dim)', fontSize: 12 }}>GLYPH BOOT SEQUENCE</div>
            </motion.div>
          </div>
        ) : (
          <div className="layout">
            <aside className="sidebar">
              {NAV.map(([to, label]) => (
                <NavLink key={to} to={to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                  <span className="dot" />{label}
                </NavLink>
              ))}
              <div style={{ marginTop: 'auto' }} className="badge">NOTHING-STYLE ● DOT 14px</div>
            </aside>
            <main className="main">
              <AnimatedRoutes />
            </main>
          </div>
        )}
      </div>
    </HashRouter>
  )
}
