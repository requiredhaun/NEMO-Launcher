import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { call } from '../lib/ipc'
import { t, useLang } from '../lib/i18n'
import { useInstances, selectedInstance } from '../store/instancesStore'
import { useGame } from '../store/gameStore'
import { useAuth } from '../store/authStore'
import { GlyphLoader } from '../components/GlyphLoader'

export function Home() {
  useLang()
  const { instances, selectedId, refresh } = useInstances()
  const { status, progress, launching, playing, launch, cancel } = useGame()
  const { nick } = useAuth()
  const [err, setErr] = useState('')
  const inst = selectedInstance(instances, selectedId)

  useEffect(() => { refresh() }, [])

  const play = async () => {
    if (!inst) { setErr(t('home.no_build_error')); return }
    setErr('')
    try { await launch(inst.id) } catch (e: any) { setErr(e.message) }
  }

  return (
    <div>
      <p className="sub" style={{ margin: '0 0 6px' }}>
        {nick ? t('home.welcome_back', { nick }) : t('home.hello')}
      </p>
      {!inst ? (
        <div className="card">
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{t('home.empty_title')}</div>
          <div className="sub">{t('home.empty_sub')}</div>
          <Link to="/instances" className="btn" style={{ display: 'inline-block', textDecoration: 'none' }}>{t('home.create_build')}</Link>
        </div>
      ) : (
        <motion.div className="card hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
            <div style={{ minWidth: 240 }}>
              <div className="sub" style={{ margin: '0 0 4px' }}>{t('home.selected_now')}</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{inst.name}</div>
              <div className="tags" style={{ marginTop: 10 }}>
                <span className="tag big">{inst.mcVersion}</span>
                <span className="tag big">{inst.loader}{inst.loaderVersion ? ` ${inst.loaderVersion}` : ''}</span>
                <span className="tag big">{inst.ramMB} {t('unit.mb')}</span>
                {playing && <span className="tag live">{t('home.ingame')}</span>}
              </div>
              <div className="sub" style={{ margin: '10px 0 0' }}>{status}</div>
              {(launching) && !playing && (
                <div style={{ width: 320, maxWidth: '100%', marginTop: 8 }}>
                  <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                  <div className="sub" style={{ margin: '4px 0 0' }}>{Math.round(progress * 100)}%</div>
                </div>
              )}
              {err && <div style={{ color: 'var(--accent-soft)', marginTop: 8 }}>{err}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
              <motion.button className="btn play" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={play} disabled={launching || playing}>
                {launching ? t('home.launching') : playing ? t('home.in_game') : t('home.play')}
              </motion.button>
              {launching && !playing && (
                <motion.button className="btn ghost" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => cancel()}>
                  {t('common.cancel')}
                </motion.button>
              )}
              <div className="row">
                <button className="btn ghost" onClick={() => call('launch:openGameFolder', { instanceId: inst.id })}>{t('home.folder')}</button>
                <Link to="/versions" className="btn ghost" style={{ textDecoration: 'none' }}>{t('home.version')}</Link>
                <Link to="/mods" className="btn ghost" style={{ textDecoration: 'none' }}>{t('home.mods')}</Link>
              </div>
            </div>
          </div>
          {launching && !playing && <div style={{ marginTop: 14 }}><GlyphLoader text={t('home.starting')} /></div>}
        </motion.div>
      )}
      <div className="pixel-divider" />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {([
          ['/instances', t('home.card_lib_t'), t('home.card_lib_d', { n: instances.length })],
          ['/mods', t('home.card_cat_t'), t('home.card_cat_d')],
          ['/packs', t('home.card_packs_t'), t('home.card_packs_d')],
          ['/settings', t('home.card_set_t'), t('home.card_set_d')],
        ] as [string, string, string][]).map(([to, title, d], i) => (
          <motion.div key={to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} transition={{ delay: 0.08 * i }}>
            <Link to={to} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{title}</div>
              <div className="sub" style={{ margin: '6px 0 0' }}>{d}</div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
