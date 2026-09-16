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
import { useAvatar } from './lib/avatar'
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
  const avatar = useAvatar(nick)
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
        {nick && avatar ? <img src={avatar} alt={nick} /> : (nick ? nick.slice(0, 1).toUpperCase() : <UserIcon size={20} />)}
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

function UpdateBanner({ info, onDone }: { info: any; onDone: () => void }) {
  useLang()
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'failed'>('idle')
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')

  useEffect(() => window.nema.on('update:progress', (d: any) => {
    if (d?.total) setPct(Math.max(0, Math.min(100, Math.round((d.done / d.total) * 100))))
  }), [])

  const install = async () => {
    if (!info.setupUrl) {
      try { await call('update:openPage', { url: info.pageUrl }) } catch { /* ignore */ }
      onDone()
      return
    }
    setPhase('downloading'); setPct(0); setErr('')
    try {
      const r = await call<any>('update:download')
      setPct(100)
      await call('update:install', { file: r.file })
    } catch (e: any) {
      setPhase('failed'); setErr(e?.message || 'IPC error')
    }
  }
  const skip = async () => {
    try { await call('update:skip', { tag: info.latest }) } catch { /* ignore */ }
    onDone()
  }

  return (
    <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t('update.available', { tag: info.latest })}</div>
          {!!info.notes && <div className="sub" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{String(info.notes).slice(0, 400)}</div>}
          {phase === 'downloading' && <div className="progress" style={{ marginTop: 8 }}><div style={{ width: `${pct}%` }} /></div>}
          {phase === 'downloading' && <div className="sub" style={{ marginTop: 4 }}>{t('update.downloading', { pct })}</div>}
          {phase === 'failed' && <div style={{ color: '#ff5b5b', marginTop: 4 }}>{t('update.failed', { msg: err })}</div>}
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          {phase !== 'downloading' && <button className="btn" onClick={install}>{info.setupUrl ? t('update.install') : t('update.open_page')}</button>}
          {phase === 'idle' && <button className="btn ghost" onClick={skip}>{t('update.skip')}</button>}
          {phase !== 'downloading' && <button className="btn ghost" onClick={onDone}>{t('update.later')}</button>}
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const { refresh } = useAuth()
  const [boot, setBoot] = useState(true)
  const [upd, setUpd] = useState<any>(null)
  useEffect(() => {
    bindGameEvents()
    call<any>('config:get').then((c) => {
      if (c?.theme) applyTheme(c.theme)
      if (c?.language === 'ru' || c?.language === 'en') setLang(c.language)
      if (c?.autoCheckUpdates !== false) {
        call<any>('update:check').then((r) => {
          if (r?.available && !r?.skipped) setUpd(r)
        }).catch(() => {})
      }
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
            {upd && <UpdateBanner info={upd} onDone={() => setUpd(null)} />}
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
