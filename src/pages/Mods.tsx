import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { call } from '../lib/ipc'
import { useInstances, selectedInstance } from '../store/instancesStore'
import { useGame } from '../store/gameStore'
import { catLabel } from '../lib/categories'
import { TrashIcon, FolderIcon, GlobeIcon } from '../components/icons'
import { ConfirmModal } from '../components/ConfirmModal'

type Tab = 'content' | 'catalog' | 'files' | 'worlds' | 'logs'
type Filter = 'all' | 'on' | 'off'

const TABS: { id: Tab; label: string }[] = [
  { id: 'content', label: 'Контент' },
  { id: 'catalog', label: 'Каталог' },
  { id: 'files', label: 'Файлы' },
  { id: 'worlds', label: 'Миры' },
  { id: 'logs', label: 'Логи' },
]

function fmtSize(b: number): string {
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} МБ`
  return `${Math.max(1, Math.round(b / 1024))} КБ`
}

export function Mods() {
  const { instances, selectedId } = useInstances()
  const inst = selectedInstance(instances, selectedId)
  const { launching, playing, launch, cancel, status, log } = useGame()

  const [tab, setTab] = useState<Tab>('content')

  // --- контент ---
  const [mine, setMine] = useState<any[]>([])
  const [fq, setFq] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [asc, setAsc] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [pendingDel, setPendingDel] = useState('')
  const dragDepth = useRef(0)

  // --- каталог ---
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const LIMIT = 24
  const [allCats, setAllCats] = useState<string[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  // --- миры ---
  const [worlds, setWorlds] = useState<any[]>([])

  const refreshMine = async () => { if (inst) setMine(await call<any[]>('mods:list', { instanceId: inst.id })) }

  useEffect(() => {
    refreshMine().catch(() => {})
    call<string[]>('modrinth:categories').then(setAllCats).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst?.id])

  useEffect(() => {
    if (tab === 'worlds' && inst) call<any[]>('saves:list', { instanceId: inst.id }).then(setWorlds).catch(() => {})
  }, [tab, inst?.id])

  const doSearch = async (query: string, categories: string[], off: number, append: boolean) => {
    if (!inst) return
    setLoading(true)
    try {
      const r = await call<any>('modrinth:search', { query, kind: 'mod', gameVersion: inst.mcVersion, loader: inst.loader, categories, offset: off })
      setHits((prev) => (append ? [...prev, ...r.hits] : r.hits))
      setTotal(r.total)
      setOffset(off)
    } catch { /* ignore */ }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab !== 'catalog' || !inst) return
    const t = setTimeout(() => { doSearch(q, cats, 0, false) }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cats.join(','), inst?.id, tab])

  const visible = useMemo(() => {
    const s = fq.trim().toLowerCase()
    return mine
      .filter((m) => (filter === 'all' ? true : filter === 'on' ? m.enabled : !m.enabled))
      .filter((m) => (!s ? true : m.name.toLowerCase().includes(s)))
      .sort((a, b) => (asc ? a.name.localeCompare(b.name, 'ru') : b.name.localeCompare(a.name, 'ru')))
  }, [mine, fq, filter, asc])

  const toggle = async (file: string) => {
    if (!inst) return
    await call('mods:toggle', { instanceId: inst.id, file })
    await refreshMine()
  }
  const remove = async () => {
    if (!inst || !pendingDel) return
    await call('mods:delete', { instanceId: inst.id, file: pendingDel })
    setPendingDel('')
    await refreshMine()
  }
  const addFiles = async () => {
    if (!inst) return
    const r = await call<any>('mods:addFiles', { instanceId: inst.id })
    if (r.added?.length) await refreshMine()
  }
  const [dropMsg, setDropMsg] = useState('')
  const onDropFiles = async (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    if (!inst || !e.dataTransfer.files.length) return
    const paths = Array.from(e.dataTransfer.files)
      .map((f: any) => f.path)
      .filter((p) => typeof p === 'string' && p.toLowerCase().endsWith('.jar'))
    if (!paths.length) { setDropMsg('Нужны .jar файлы модов'); return }
    try {
      const r = await call<any>('mods:addFilesByPath', { instanceId: inst.id, paths })
      await refreshMine()
      setDropMsg(`Добавлено: ${r.added.length}`)
    } catch (err: any) { setDropMsg(err.message) }
  }
  const install = async (id: string) => {
    if (!inst) return
    setBusy(id)
    setNotice('')
    try { await call('modrinth:install', { instanceId: inst.id, projectId: id }); await refreshMine(); setNotice('Мод установлен') }
    catch (e: any) { setNotice(`Ошибка: ${e.message}`) }
    finally { setBusy('') }
  }
  const play = async () => {
    if (!inst) return
    setNotice('')
    try { await launch(inst.id) } catch (e: any) { setNotice(`Не запустилось: ${e.message}`) }
  }

  if (!inst) return <div className="sub">Сначала создай сборку во вкладке «Библиотека»</div>
  const offCount = mine.filter((m) => !m.enabled).length

  return (
    <div>
      {/* шапка сборки как в Modrinth App */}
      <div className="inst-head">
        <div className="inst-avatar">{inst.name.slice(0, 1).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</div>
          <div className="sub" style={{ margin: 0 }}>{inst.loader} {inst.mcVersion} · {mine.length} модов{offCount > 0 && ` · ${offCount} выкл.`}</div>
          {!!notice && <div className="sub" style={{ margin: '4px 0 0', color: notice.startsWith('Ошибка') || notice.startsWith('Не запустилось') ? 'var(--accent-soft)' : 'var(--txt)' }}>{notice}</div>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <motion.button className="btn play" style={{ padding: '12px 34px' }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={play} disabled={launching || playing}>
            {launching ? 'Запускаю…' : playing ? 'В игре' : '▶ Играть'}
          </motion.button>
          {launching && !playing && (
            <button className="btn ghost" onClick={() => cancel()}>✕</button>
          )}
        </div>
      </div>

      <div className="subtabs">
        {TABS.map((t) => (
          <button key={t.id} className={'subtab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'content' && mine.length > 0 && <span className="count">{mine.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'content' && (
        <div
          onDragEnter={(e) => { e.preventDefault(); dragDepth.current++; setDragOver(true) }}
          onDragLeave={(e) => { e.preventDefault(); if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragOver(false) } }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropFiles}
        >
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 1, minWidth: 200 }} value={fq} onChange={(e) => setFq(e.target.value)} placeholder={`Искать среди ${mine.length}…`} />
            <button className="btn play" style={{ padding: '10px 18px', fontSize: 13 }} onClick={() => setTab('catalog')}>Найти моды</button>
            <button className="btn ghost" onClick={addFiles}>+ Добавить файлы</button>
          </div>
          <div className={'dropzone' + (dragOver ? ' over' : '')}>
            {dragOver ? 'Отпускай — ставлю моды' : '…или перетащи .jar файлы сюда'}
            {dropMsg && <div style={{ marginTop: 4, color: 'var(--txt)' }}>{dropMsg}</div>}
          </div>
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            {([['all', 'Все'], ['on', 'Включённые'], ['off', 'Отключённые']] as [Filter, string][]).map(([v, l]) => (
              <button key={v} className={'chip' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{l}</button>
            ))}
            <button className="chip" onClick={() => setAsc(!asc)} title="Порядок сортировки">{asc ? '↓ По алфавиту' : '↑ По алфавиту'}</button>
          </div>
          <div className="mtable" style={{ marginTop: 12 }}>
            <div className="mrow mhead"><span>Проект</span><span>Файл</span><span style={{ textAlign: 'right' }}>Действия</span></div>
            {visible.map((m) => (
              <div key={m.file} className={'mrow' + (m.enabled ? '' : ' off')}>
                <span className="mproj">
                  <span className="mchip">{m.name.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <span className="mname">{m.name}</span>
                    <span className="msub">{fmtSize(m.size)}{m.enabled ? '' : ' · выключен'}</span>
                  </span>
                </span>
                <span className="mfile">{m.file}</span>
                <span className="mactions">
                  <button className={'switch' + (m.enabled ? ' on' : '')} title={m.enabled ? 'Выключить' : 'Включить'} onClick={() => toggle(m.file)} />
                  <button className="icon-btn danger" title="Удалить мод" onClick={() => setPendingDel(m.file)}><TrashIcon /></button>
                </span>
              </div>
            ))}
            {!visible.length && <div className="sub" style={{ padding: 16 }}>{mine.length ? 'Под фильтр ничего не попало' : 'Модов пока нет — нажми «Найти моды» или перетащи .jar сюда'}</div>}
          </div>
        </div>
      )}

      {tab === 'catalog' && (
        <div>
          <div className="row">
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти мод… например, sodium" style={{ fontSize: 15 }} />
          </div>
          <div className="browse">
            <aside className="filters">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, fontSize: 12 }}>КАТЕГОРИИ</span>
                {!!cats.length && <button className="link" onClick={() => setCats([])}>сбросить</button>}
              </div>
              <div className="chips">
                {allCats.map((c) => (
                  <button key={c} className={'chip' + (cats.includes(c) ? ' on' : '')} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}>
                    {catLabel(c)}
                  </button>
                ))}
              </div>
              <div className="sub" style={{ margin: '8px 0 0' }}>фильтр: {inst.mcVersion} · {inst.loader}{total > 0 && ` · ${total.toLocaleString()}`}</div>
            </aside>
            <div className="grid mods" style={{ flex: 1 }}>
              {loading && !hits.length && <>{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel" />)}</>}
              {!loading && !hits.length && <div className="sub">Ничего не нашлось — попробуй другой запрос или убери категории</div>}
              <AnimatePresence mode="popLayout">
                {hits.map((h, i) => (
                  <motion.div key={h.id} className="card" layout
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}>
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
              </AnimatePresence>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <span className="sub" style={{ margin: 0 }}>показано {hits.length} из {total.toLocaleString()}</span>
            {hits.length < total && (
              <button className="btn ghost" disabled={loading} onClick={() => doSearch(q, cats, offset + LIMIT, true)}>
                {loading ? 'Гружу…' : 'Показать ещё'}
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          {[
            ['Моды', 'mods', `${mine.length} файлов`],
            ['Сохранения', 'saves', 'миры сборки'],
            ['Скриншоты', 'screenshots', 'F2 в игре'],
            ['Корень сборки', '', 'всё остальное'],
          ].map(([t, rel, d]) => (
            <button key={t} className="card" style={{ cursor: 'pointer', textAlign: 'left', color: 'inherit' }} onClick={() => call('paths:open', { instanceId: inst.id, rel })}>
              <div className="row" style={{ gap: 10 }}>
                <FolderIcon size={20} />
                <span style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t}</span>
              </div>
              <div className="sub" style={{ margin: '6px 0 0' }}>{d}</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'worlds' && (
        <div className="grid">
          {worlds.map((w) => (
            <div key={w.name} className="card row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div className="row" style={{ gap: 10 }}>
                  <GlobeIcon size={20} />
                  <span style={{ fontWeight: 700 }}>{w.name}</span>
                </div>
                <div className="sub" style={{ margin: 0 }}>{fmtSize(w.size)} · {new Date(w.mtime).toLocaleDateString('ru-RU')}</div>
              </div>
              <button className="btn ghost" onClick={() => call('paths:open', { instanceId: inst.id, rel: `saves/${w.name}` })}>Открыть</button>
            </div>
          ))}
          {!worlds.length && <div className="sub">Миров пока нет — они появятся здесь после первой игры</div>}
        </div>
      )}

      {tab === 'logs' && (
        <div>
          <div className="sub">статус: {status}</div>
          <div className="log" style={{ marginTop: 8, maxHeight: 380 }}>
            {log.length ? [...log].reverse().join('\n') : 'Логов пока нет — запусти игру'}
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!pendingDel}
        title="Удалить мод?"
        text={`«${pendingDel}» будет удалён из «${inst.name}». Это действие нельзя отменить.`}
        okLabel="Удалить"
        danger
        onOk={remove}
        onCancel={() => setPendingDel('')}
      />
    </div>
  )
}
