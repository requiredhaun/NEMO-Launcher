import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { call } from '../lib/ipc'
import { useInstances, selectedInstance } from '../store/instancesStore'

export function Mods() {
  const { instances, selectedId } = useInstances()
  const inst = selectedInstance(instances, selectedId)
  const [q, setQ] = useState('sodium')
  const [hits, setHits] = useState<any[]>([])
  const [mine, setMine] = useState<any[]>([])
  const [busy, setBusy] = useState('')

  const search = async () => {
    if (!inst) return
    const r = await call<any>('modrinth:search', { query: q, kind: 'mod', gameVersion: inst.mcVersion, loader: inst.loader })
    setHits(r.hits)
  }
  const refreshMine = async () => { if (inst) setMine(await call<any[]>('mods:list', { instanceId: inst.id })) }
  useEffect(() => { search().catch(() => {}); refreshMine().catch(() => {}) }, [inst?.id])

  const install = async (id: string) => {
    if (!inst) return
    setBusy(id)
    try { await call('modrinth:install', { instanceId: inst.id, projectId: id }); await refreshMine() }
    catch (e: any) { alert(e.message) }
    finally { setBusy('') }
  }

  if (!inst) return <div className="sub">Сначала создай инстанс</div>
  return (
    <div>
      <h1 className="h-dot">MODS</h1>
      <p className="sub">modrinth · {inst.mcVersion} · {inst.loader} · установлено: {mine.length}</p>
      <div className="row">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="поиск…" />
        <button className="btn" onClick={search}>SEARCH</button>
      </div>
      <div className="grid mods" style={{ marginTop: 14 }}>
        {hits.map((h, i) => (
          <motion.div key={h.id} className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
            <div className="row">
              {h.iconUrl && <img src={h.iconUrl} width={40} height={40} style={{ borderRadius: 8 }} />}
              <div>
                <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 1 }}>{h.title}</div>
                <div className="sub" style={{ margin: 0 }}>▼ {h.downloads.toLocaleString()} · {h.author}</div>
              </div>
            </div>
            <div className="sub" style={{ minHeight: 36 }}>{h.description?.slice(0, 110)}</div>
            <button className="btn" disabled={busy === h.id} onClick={() => install(h.id)}>{busy === h.id ? '…' : '+ INSTALL'}</button>
          </motion.div>
        ))}
      </div>
      <div className="pixel-divider" />
      <h3 style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>INSTALLED</h3>
      <div className="grid">
        {mine.map((m) => (
          <div key={m.name} className="card row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Consolas,monospace', fontSize: 13 }}>{m.name}</span>
            <button className="btn ghost" onClick={() => call('mods:delete', { instanceId: inst.id, name: m.name }).then(refreshMine)}>DEL</button>
          </div>
        ))}
      </div>
    </div>
  )
}
