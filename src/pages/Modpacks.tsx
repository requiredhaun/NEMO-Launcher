import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { call } from '../lib/ipc'
import { useInstances, selectedInstance } from '../store/instancesStore'
import { ConfirmModal } from '../components/ConfirmModal'

export function Modpacks() {
  const { instances, selectedId } = useInstances()
  const inst = selectedInstance(instances, selectedId)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<any[]>([])
  const [busy, setBusy] = useState('')
  const [pending, setPending] = useState<any>(null)
  const [plog, setPlog] = useState<string[]>([])
  const [done, setDone] = useState('')

  const search = async () => {
    if (!inst) return
    const r = await call<any>('modrinth:search', { query: q, kind: 'modpack', gameVersion: inst.mcVersion, loader: inst.loader })
    setHits(r.hits)
  }
  useEffect(() => { search().catch(() => {}) }, [inst?.id])
  useEffect(() => {
    const off = window.nema.on('install:log', (l: any) => setPlog((s) => [...s.slice(-100), String(l)]))
    return off
  }, [])

  const install = async () => {
    if (!inst || !pending) return
    const id = pending.id
    setBusy(id)
    setPlog([])
    setDone('')
    try {
      const r = await call<any>('modrinth:installPack', { instanceId: inst.id, projectId: id })
      setDone(`Готово — файлов поставлено: ${r.files}`)
    } catch (e: any) {
      setDone(`Ошибка: ${e.message}`)
    } finally {
      setBusy('')
      setPending(null)
    }
  }

  if (!inst) return <div className="sub">Сначала создай сборку во вкладке «Библиотека»</div>
  return (
    <div>
      <h1 className="h-dot">Сборки</h1>
      <p className="sub">готовые модпаки ставятся прямо в «{inst.name}» · {inst.mcVersion} · {inst.loader}</p>
      <div className="row">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Название сборки…" />
        <button className="btn" onClick={search}>Найти</button>
      </div>
      {!!plog.length && <div className="log" style={{ marginTop: 12 }}>{plog.join('\n')}</div>}
      {done && <div className="card" style={{ marginTop: 12, borderColor: done.startsWith('Ошибка') ? 'var(--red)' : undefined }}>{done}</div>}
      <div className="grid mods" style={{ marginTop: 14 }}>
        <AnimatePresence mode="popLayout">
          {hits.map((h, i) => (
            <motion.div key={h.id} className="card" layout
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}>
              <div className="row">
                {h.iconUrl && <img src={h.iconUrl} width={44} height={44} style={{ borderRadius: 8 }} loading="lazy" />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                  <div className="sub" style={{ margin: 0 }}>▼ {h.downloads.toLocaleString()} · {h.author}</div>
                </div>
              </div>
              <div className="sub" style={{ minHeight: 38 }}>{h.description?.slice(0, 120)}</div>
              <button className="btn play" style={{ padding: '10px 18px', fontSize: 13 }} disabled={busy !== ''} onClick={() => setPending(h)}>
                {busy === h.id ? 'Ставлю…' : '↓ Установить'}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <ConfirmModal
        open={!!pending}
        title="Поставить сборку?"
        text={`«${pending?.title}» встанет в «${inst.name}». Файлы сборки будут дозаписаны поверх текущих, твои миры не тронутся.`}
        okLabel="Поставить"
        busy={busy !== ''}
        onOk={install}
        onCancel={() => { if (!busy) setPending(null) }}
      />
    </div>
  )
}
