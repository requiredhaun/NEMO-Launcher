import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { call } from '../lib/ipc'
import { useInstances, selectedInstance } from '../store/instancesStore'
import { useGame } from '../store/gameStore'
import { useAuth } from '../store/authStore'
import { GlyphLoader } from '../components/GlyphLoader'

export function Home() {
  const { instances, selectedId, refresh } = useInstances()
  const { status, phase, progress, launching, launch } = useGame()
  const { nick } = useAuth()
  const [err, setErr] = useState('')
  const inst = selectedInstance(instances, selectedId)

  useEffect(() => { refresh() }, [])

  const play = async () => {
    if (!inst) { setErr('Создай инстанс на вкладке INSTANCES'); return }
    setErr('')
    try { await launch(inst.id) } catch (e: any) { setErr(e.message) }
  }

  return (
    <div>
      <motion.h1 className="h-dot" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>NEMA<b style={{ color: 'var(--red)' }}>●</b>OS</motion.h1>
      <p className="sub">dot-matrix лаунчер // {nick ? `пилот: ${nick}` : 'offline режим'} // {inst ? `${inst.name} · ${inst.mcVersion} · ${inst.loader}` : 'нет инстанса'}</p>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, marginBottom: 8 }}>STATUS: {status}</div>
            {(phase === 'download' || launching) && (
              <div style={{ width: 320 }}>
                <div className="progress"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              </div>
            )}
            {err && <div style={{ color: '#ff6b6f', marginTop: 8 }}>{err}</div>}
          </div>
          <motion.button className="btn play" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={play} disabled={launching}>
            {launching ? '●●●' : '▶ ИГРАТЬ'}
          </motion.button>
        </div>
        {launching && <div style={{ marginTop: 14 }}><GlyphLoader text="GLYPH LINK // ЗАПУСК" /></div>}
      </div>
      <div className="pixel-divider" />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
        {[['INSTANCES', 'изоляция миров'], ['VERSIONS', 'vanilla→quilt'], ['MODS', 'modrinth 1-клик'], ['MODPACKS', '.mrpack']].map(([t, d], i) => (
          <motion.div key={t} className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}>
            <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t}</div>
            <div className="sub" style={{ margin: '6px 0 0' }}>{d}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
