import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { call } from '../lib/ipc'
import { useInstances, selectedInstance } from '../store/instancesStore'
import { catLabel } from '../lib/categories'

export function Mods() {
  const { instances, selectedId } = useInstances()
  const inst = selectedInstance(instances, selectedId)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [mine, setMine] = useState<any[]>([])
  const [allCats, setAllCats] = useState<string[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(false)

  const search = async (query: string, categories: string[]) => {
    if (!inst) return
    setLoading(true)
    try {
      const r = await call<any>('modrinth:search', { query, kind: 'mod', gameVersion: inst.mcVersion, loader: inst.loader, categories })
      setHits(r.hits)
      setTotal(r.total)
    } finally { setLoading(false) }
  }

  const refreshMine = async () => { if (inst) setMine(await call<any[]>('mods:list', { instanceId: inst.id })) }

  useEffect(() => {
    call<string[]>('modrinth:categories').then(setAllCats).catch(() => {})
    refreshMine().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst?.id])

  useEffect(() => {
    const t = setTimeout(() => search(q, cats).catch(() => {}), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cats.join(','), inst?.id])

  const toggle = (c: string) => {
    const next = cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c]
    setCats(next)
  }

  const install = async (id: string) => {
    if (!inst) return
    setBusy(id)
    try { await call('modrinth:install', { instanceId: inst.id, projectId: id }); await refreshMine() }
    catch (e: any) { alert(e.message) }
    finally { setBusy('') }
  }

  if (!inst) return <div className="sub">Сначала создай сборку во вкладке «Библиотека»</div>

  return (
    <div>
      <h1 className="h-dot">Каталог модов</h1>
      <p className="sub">
        для «{inst.name}» · {inst.mcVersion} · {inst.loader} · установлено: {mine.length}
        {total > 0 && ` · найдено: ${total.toLocaleString()}`}
      </p>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <input
          className="input" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Найти мод… например, sodium" style={{ fontSize: 15 }}
        />
      </div>
      <div className="browse">
        <aside className="filters">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, fontSize: 12 }}>КАТЕГОРИИ</span>
            {!!cats.length && <button className="link" onClick={() => setCats([])}>сбросить</button>}
          </div>
          <div className="chips">
            {allCats.map((c) => (
              <button key={c} className={'chip' + (cats.includes(c) ? ' on' : '')} onClick={() => toggle(c)}>
                {catLabel(c)}
              </button>
            ))}
          </div>
          {!!cats.length && <div className="sub" style={{ margin: '8px 0 0' }}>выбрано: {cats.length}</div>}
        </aside>
        <div className="grid mods" style={{ flex: 1 }}>
          {loading && !hits.length && <div className="sub">Ищу…</div>}
          {!loading && !hits.length && <div className="sub">Ничего не нашлось — попробуй другой запрос или убери категории</div>}
          {hits.map((h, i) => (
            <motion.div key={h.id} className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
              <div className="row">
                {h.iconUrl && <img src={h.iconUrl} width={44} height={44} style={{ borderRadius: 10 }} loading="lazy" />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                  <div className="sub" style={{ margin: 0 }}>▼ {h.downloads.toLocaleString()} · {h.author}</div>
                </div>
              </div>
              <div className="sub" style={{ minHeight: 38 }}>{h.description?.slice(0, 110)}</div>
              {!!h.categories?.length && (
                <div className="tags">
                  {h.categories.slice(0, 3).map((c: string) => <span key={c} className="tag">{catLabel(c)}</span>)}
                </div>
              )}
              <button className="btn" disabled={busy === h.id} onClick={() => install(h.id)} style={{ marginTop: 10 }}>
                {busy === h.id ? 'Ставлю…' : 'Установить'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="pixel-divider" />
      <h3 style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>Установленные · {mine.length}</h3>
      <div className="grid">
        {mine.map((m) => (
          <div key={m.name} className="card row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Consolas,monospace', fontSize: 13 }}>{m.name}</span>
            <button className="btn ghost" onClick={() => call('mods:delete', { instanceId: inst.id, name: m.name }).then(refreshMine)}>Удалить</button>
          </div>
        ))}
        {!mine.length && <div className="sub">Пока пусто — моды появятся здесь после установки</div>}
      </div>
    </div>
  )
}
