import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { call } from '../lib/ipc'
import { useInstances, selectedInstance } from '../store/instancesStore'

export function Modpacks() {
  const { instances, selectedId } = useInstances()
  const inst = selectedInstance(instances, selectedId)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<any[]>([])
  const [busy, setBusy] = useState('')

  const search = async () => {
    if (!inst) return
    const r = await call<any>('modrinth:search', { query: q, kind: 'modpack', gameVersion: inst.mcVersion, loader: inst.loader })
    setHits(r.hits)
  }
  useEffect(() => { search().catch(() => {}) }, [inst?.id])

  const install = async (id: string) => {
    if (!inst) return
    if (!confirm('Поставить сборку в текущий инстанс? Файлы будут дозаписаны.')) return
    setBusy(id)
    try { const r = await call<any>('modrinth:installPack', { instanceId: inst.id, projectId: id }); alert(`Готово: файлов ${r.files}`) }
    catch (e: any) { alert(e.message) }
    finally { setBusy('') }
  }

  if (!inst) return <div className="sub">Сначала создай сборку во вкладке «Библиотека»</div>
  return (
    <div>
      <h1 className="h-dot">Сборки</h1>
      <p className="sub">готовые модпаки ставятся прямо в «{inst.name}»</p>
      <div className="row">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Название сборки…" />
        <button className="btn" onClick={search}>Найти</button>
      </div>
      <div className="grid mods" style={{ marginTop: 14 }}>
        {hits.map((h, i) => (
          <motion.div key={h.id} className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
            <div className="row">
              {h.iconUrl && <img src={h.iconUrl} width={44} height={44} style={{ borderRadius: 8 }} />}
              <div>
                <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 1 }}>{h.title}</div>
                <div className="sub" style={{ margin: 0 }}>▼ {h.downloads.toLocaleString()}</div>
              </div>
            </div>
            <div className="sub">{h.description?.slice(0, 120)}</div>
            <button className="btn play" style={{ padding: '10px 18px', fontSize: 13 }} disabled={busy === h.id} onClick={() => install(h.id)}>{busy === h.id ? 'Ставлю…' : '↓ Установить'}</button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
