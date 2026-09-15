import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInstances } from '../store/instancesStore'
import { call } from '../lib/ipc'

export function Instances() {
  const { instances, selectedId, refresh, create, select, remove } = useInstances()
  const [name, setName] = useState('')
  const [mc, setMc] = useState('1.21.11')
  const [manifest, setManifest] = useState<any[]>([])

  useEffect(() => {
    refresh()
    call<any>('versions:manifest').then((m) => setManifest(m.versions.filter((v: any) => v.type === 'release').slice(0, 30))).catch(() => {})
  }, [])

  return (
    <div>
      <h1 className="h-dot">INSTANCES</h1>
      <p className="sub">каждый инстанс — отдельная папка, версия и моды</p>
      <div className="card">
        <div className="row">
          <input className="input" placeholder="Имя инстанса…" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="select" value={mc} onChange={(e) => setMc(e.target.value)} style={{ maxWidth: 180 }}>
            {manifest.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
          </select>
          <button className="btn" onClick={() => create(name || `Instance ${instances.length + 1}`, mc).then(() => setName(''))}>+ NEW</button>
        </div>
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        <AnimatePresence>
          {instances.map((i) => (
            <motion.div key={i.id} className="card" layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ borderColor: i.id === selectedId ? 'var(--red)' : undefined }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, fontSize: 16 }}>{i.name}</div>
                  <div className="sub" style={{ margin: '4px 0 0' }}>{i.mcVersion} · {i.loader} {i.loaderVersion} · {i.versionId}</div>
                </div>
                <div className="row">
                  {i.id === selectedId ? <span className="badge red">ACTIVE</span> : <button className="btn ghost" onClick={() => select(i.id)}>SELECT</button>}
                  <button className="btn ghost" onClick={() => { if (confirm(`Удалить ${i.name}?`)) remove(i.id) }}>DEL</button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
