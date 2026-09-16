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
import { t, useLang, setLang } from './lib/i18n'
import { applyTheme } from './lib/theme'
import { PlayIcon, LibraryIcon, TagIcon, CompassIcon, BoxIcon, SlidersIcon, PlusIcon, UserIcon } from './components/icons'

const NAV: { to: string; key: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { to: '/', key: 'nav.home', Icon: PlayIcon },
  { to: '/instances', key: 'nav.instances', Icon: LibraryIcon },
  { to: '/versions', key: 'nav.versions', Icon: TagIcon },
  { to: '/mods', key: 'nav.mods', Icon: CompassIcon },
  { to: '/packs', key: 'nav.packs', Icon: BoxIcon },
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
  useLang()
  const { instances, create } = useInstances()
  const { nick } = useAuth()
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
      await create(t('app.new_build', { n: instances.length + 1 }), mc)
      nav('/instances')
    } catch {
      nav('/instances')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="rail">
      <button className="rail-avatar" title={nick ? t('app.account_named', { nick }) : t('app.account_login')} onClick={() => nav('/login')}>
        {nick ? nick.slice(0, 1).toUpperCase() : <UserIcon size={20} />}
      </button>
      <div className="rail-group">
        {NAV.map(({ to, key, Icon }) => (
          <NavLink key={to} to={to} data-tip={t(key)} className={({ isActive }) => 'rail-btn' + (isActive ? ' active' : '')}>
            {({ isActive }) => (
              <>
                <Icon size={21} />
                {isActive && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div className="rail-bottom">
        <motion.button
          className="rail-btn create" data-tip={t('app.create_tip')} onClick={quickCreate} disabled={busy}
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
        >
          {busy ? '…' : <PlusIcon size={21} />}
        </motion.button>
        <NavLink to="/settings" data-tip={t('nav.settings')} className={({ isActive }) => 'rail-btn' + (isActive ? ' active' : '')}>
          <SlidersIcon size={21} />
        </NavLink>
        <div className="rail-ver" title={`NEMO ${__APP_VERSION__}`}>v{__APP_VERSION__}</div>
      </div>
    </aside>
  )
}

function Shell() {
  const { refresh } = useAuth()
  const [boot, setBoot] = useState(true)
  useEffect(() => {
    bindGameEvents()
    call<any>('config:get').then((c) => {
      if (c?.theme) applyTheme(c.theme)
      if (c?.language === 'ru' || c?.language === 'en') setLang(c.language)
    }).catch(() => {})
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
            <GlyphLoader text={t('app.loading')} />
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
