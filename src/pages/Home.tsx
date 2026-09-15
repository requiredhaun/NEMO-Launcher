import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { call } from '../lib/ipc'
import { useInstances, selectedInstance } from '../store/instancesStore'
import { useGame } from '../store/gameStore'
import { useAuth } from '../store/authStore'
import { GlyphLoader } from '../components/GlyphLoader'

export function Home() {
  const { instances, selectedId, refresh } = useInstances()
  const { status, progress, launching, playing, launch } = useGame()
  const { nick } = useAuth()
  const [err, setErr] = useState('')
  const inst = selectedInstance(instances, selectedId)

  useEffect(() => { refresh() }, [])

  const play = async () => {
    if (!inst) { setErr('Сначала создай сборку во вкладке «Библиотека»'); return }
    setErr('')
    try { await launch(inst.id) } catch (e: any) { setErr(e.message) }
  }

  return (
    <div>
      <p className="sub" style={{ margin: '0 0 6px' }}>
        {nick ? `С возвращением, ${nick}` : 'Привет! Укажи ник во вкладке «Аккаунт» — и можно играть'}
      </p>
      {!inst ? (
        <div className="card">
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>У тебя пока нет ни одной сборки</div>
          <div className="sub">Сборка — это отдельный Minecraft со своей версией, загрузчиком и модами</div>
          <Link to="/instances" className="btn" style={{ display: 'inline-block', textDecoration: 'none' }}>Создать сборку</Link>
        </div>
      ) : (
        <motion.div className="card hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
            <div style={{ minWidth: 240 }}>
              <div className="sub" style={{ margin: '0 0 4px' }}>сейчас выбрана</div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{inst.name}</div>
              <div className="tags" style={{ marginTop: 10 }}>
                <span className="tag big">{inst.mcVersion}</span>
                <span className="tag big">{inst.loader}{inst.loaderVersion ? ` ${inst.loaderVersion}` : ''}</span>
                <span className="tag big">{inst.ramMB} МБ</span>
                {playing && <span className="tag live">● в игре</span>}
              </div>
              <div className="sub" style={{ margin: '10px 0 0' }}>{status}</div>
              {(launching) && !playing && (
                <div style={{ width: 320, maxWidth: '100%', marginTop: 8 }}>
                  <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                </div>
              )}
              {err && <div style={{ color: '#ff6b6f', marginTop: 8 }}>{err}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
              <motion.button className="btn play" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={play} disabled={launching || playing}>
                {launching ? 'Запускаю…' : playing ? 'Уже в игре' : '▶  Играть'}
              </motion.button>
              <div className="row">
                <button className="btn ghost" onClick={() => call('launch:openGameFolder', { instanceId: inst.id })}>Папка</button>
                <Link to="/versions" className="btn ghost" style={{ textDecoration: 'none' }}>Версия</Link>
                <Link to="/mods" className="btn ghost" style={{ textDecoration: 'none' }}>Моды</Link>
              </div>
            </div>
          </div>
          {launching && !playing && <div style={{ marginTop: 14 }}><GlyphLoader text="ЗАПУСК" /></div>}
        </motion.div>
      )}
      <div className="pixel-divider" />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {[
          ['/instances', 'Библиотека', `${instances.length} сб. — версии и моды отдельно для каждой`],
          ['/mods', 'Каталог модов', 'поиск по Modrinth с фильтром под твою версию'],
          ['/packs', 'Сборки', 'готовые модпаки в один клик'],
          ['/settings', 'Настройки', 'память, Java, окно игры'],
        ].map(([to, t, d], i) => (
          <motion.div key={to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} transition={{ delay: 0.08 * i }}>
            <Link to={to} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t}</div>
              <div className="sub" style={{ margin: '6px 0 0' }}>{d}</div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
