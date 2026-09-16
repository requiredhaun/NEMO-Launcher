import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { call } from '../lib/ipc'
import { t, useLang, getLang } from '../lib/i18n'
import { useInstances, selectedInstance } from '../store/instancesStore'
import { useGame } from '../store/gameStore'
import { catLabel } from '../lib/categories'
import { TrashIcon, FolderIcon, GlobeIcon } from '../components/icons'
import { ConfirmModal } from '../components/ConfirmModal'

type Tab = 'content' | 'catalog' | 'files' | 'worlds' | 'logs'
type Filter = 'all' | 'on' | 'off'

const TABS: { id: Tab; key: string }[] = [
  { id: 'content', key: 'mods.tab_content' },
  { id: 'catalog', key: 'mods.tab_catalog' },
  { id: 'files', key: 'mods.tab_files' },
  { id: 'worlds', key: 'mods.tab_worlds' },
  { id: 'logs', key: 'mods.tab_logs' },
]

function fmtSize(b: number): string {
  if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} ${t('unit.mb')}`
  return `${Math.max(1, Math.round(b / 1024))} ${t('unit.kb')}`
}

export function Mods() {
  useLang()
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
  const [kind, setKind] = useState<'mod' | 'shader' | 'resourcepack'>('mod')
  const [hits, setHits] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const LIMIT = 24
  const [allCats, setAllCats] = useState<string[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(false)
  const [kindFiles, setKindFiles] = useState<any[]>([])

  const kindSub = kind === 'shader' ? 'shaderpacks' : kind === 'resourcepack' ? 'resourcepacks' : 'mods'
  const kindLabel = kind === 'shader' ? t('mods.kind_shader') : kind === 'resourcepack' ? t('mods.kind_resourcepack') : t('mods.kind_mod')
  const [notice, setNotice] = useState('')

  // --- миры ---
  const [worlds, setWorlds] = useState<any[]>([])

  const refreshMine = async () => { if (inst) setMine(await call<any[]>('mods:list', { instanceId: inst.id })) }
  const refreshKindFiles = async () => {
    if (!inst) return
    if (kind === 'mod') { await refreshMine(); return }
    setKindFiles(await call<any[]>('content:list', { instanceId: inst.id, sub: kindSub }))
  }

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
      const r = await call<any>('modrinth:search', { query, kind, gameVersion: inst.mcVersion, loader: inst.loader, categories: kind === 'mod' ? categories : [], offset: off })
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
  }, [q, cats.join(','), inst?.id, tab, kind])

  const visible = useMemo(() => {
    const s = fq.trim().toLowerCase()
    const locale = getLang() === 'en' ? 'en' : 'ru'
    return mine
      .filter((m) => (filter === 'all' ? true : filter === 'on' ? m.enabled : !m.enabled))
      .filter((m) => (!s ? true : m.name.toLowerCase().includes(s)))
      .sort((a, b) => (asc ? a.name.localeCompare(b.name, locale) : b.name.localeCompare(a.name, locale)))
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
    if (!paths.length) { setDropMsg(t('mods.need_jar')); return }
    try {
      const r = await call<any>('mods:addFilesByPath', { instanceId: inst.id, paths })
      await refreshMine()
      setDropMsg(t('mods.added', { n: r.added.length }))
    } catch (err: any) { setDropMsg(err.message) }
  }
  const install = async (id: string) => {
    if (!inst) return
    setBusy(id)
    setNotice('')
    try {
      await call('modrinth:install', { instanceId: inst.id, projectId: id, kind })
      await refreshMine()
      await refreshKindFiles()
      setNotice(t('mods.installed'))
    }
    catch (e: any) { setNotice(t('mods.error', { msg: e.message })) }
    finally { setBusy('') }
  }
  const play = async () => {
    if (!inst) return
    setNotice('')
    try { await launch(inst.id) } catch (e: any) { setNotice(t('mods.launch_fail', { msg: e.message })) }
  }

  if (!inst) return <div className="sub">{t('mods.no_inst')}</div>
  const offCount = mine.filter((m) => !m.enabled).length
  const noticeErr = notice.startsWith(t('mods.error_prefix')) || notice.startsWith(t('mods.launch_fail_prefix'))

  return (
    <div>
      {/* шапка сборки как в Modrinth App */}
      <div className="inst-head">
        <div className="inst-avatar">{inst.name.slice(0, 1).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</div>
          <div className="sub" style={{ margin: 0 }}>{inst.loader} {inst.mcVersion} · {t('mods.mods_count', { n: mine.length })}{offCount > 0 && t('mods.off_count', { n: offCount })}</div>
          {!!notice && <div className="sub" style={{ margin: '4px 0 0', color: noticeErr ? 'var(--accent-soft)' : 'var(--txt)' }}>{notice}</div>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <motion.button className="btn play" style={{ padding: '12px 34px' }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={play} disabled={launching || playing}>
            {launching ? t('mods.launching') : playing ? t('mods.in_game') : t('mods.play')}
          </motion.button>
          {launching && !playing && (
            <button className="btn ghost" onClick={() => cancel()}>✕</button>
          )}
        </div>
      </div>

      <div className="subtabs">
        {TABS.map((tb) => (
          <button key={tb.id} className={'subtab' + (tab === tb.id ? ' on' : '')} onClick={() => setTab(tb.id)}>
            {t(tb.key)}
            {tb.id === 'content' && mine.length > 0 && <span className="count">{mine.length}</span>}
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
            <input className="input" style={{ flex: 1, minWidth: 200 }} value={fq} onChange={(e) => setFq(e.target.value)} placeholder={t('mods.search_mine', { n: mine.length })} />
            <button className="btn play" style={{ padding: '10px 18px', fontSize: 13 }} onClick={() => setTab('catalog')}>{t('mods.find_mods')}</button>
            <button className="btn ghost" onClick={addFiles}>{t('mods.add_files')}</button>
          </div>
          <div className={'dropzone' + (dragOver ? ' over' : '')}>
            {dragOver ? t('mods.drop_over') : t('mods.drop_hint')}
            {dropMsg && <div style={{ marginTop: 4, color: 'var(--txt)' }}>{dropMsg}</div>}
          </div>
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            {([['all', 'mods.filter_all'], ['on', 'mods.filter_on'], ['off', 'mods.filter_off']] as [Filter, string][]).map(([v, k]) => (
              <button key={v} className={'chip' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{t(k)}</button>
            ))}
            <button className="chip" onClick={() => setAsc(!asc)} title={t('mods.sort_title')}>{asc ? t('mods.sort_asc') : t('mods.sort_desc')}</button>
          </div>
          <div className="mtable" style={{ marginTop: 12 }}>
            <div className="mrow mhead"><span>{t('mods.col_project')}</span><span>{t('mods.col_file')}</span><span style={{ textAlign: 'right' }}>{t('mods.col_actions')}</span></div>
            {visible.map((m) => (
              <div key={m.file} className={'mrow' + (m.enabled ? '' : ' off')}>
                <span className="mproj">
                  <span className="mchip">{m.name.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <span className="mname">{m.name}</span>
                    <span className="msub">{fmtSize(m.size)}{m.enabled ? '' : t('mods.disabled_suffix')}</span>
                  </span>
                </span>
                <span className="mfile">{m.file}</span>
                <span className="mactions">
                  <button className={'switch' + (m.enabled ? ' on' : '')} title={m.enabled ? t('mods.disable') : t('mods.enable')} onClick={() => toggle(m.file)} />
                  <button className="icon-btn danger" title={t('mods.delete_mod')} onClick={() => setPendingDel(m.file)}><TrashIcon /></button>
                </span>
              </div>
            ))}
            {!visible.length && <div className="sub" style={{ padding: 16 }}>{mine.length ? t('mods.empty_filtered') : t('mods.empty_none')}</div>}
          </div>
        </div>
      )}

      {tab === 'catalog' && (
        <div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {([['mod', 'mods.kind_mod'], ['shader', 'mods.kind_shader'], ['resourcepack', 'mods.kind_resourcepack']] as const).map(([v, k]) => (
              <button key={v} className="btn" style={kind === v ? { borderColor: 'var(--red)', color: 'var(--accent-soft)' } : {}} onClick={() => setKind(v)}>{t(k)}</button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <input
              className="input" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={kind === 'mod' ? t('mods.search_mod_ph') : kind === 'shader' ? t('mods.search_shader_ph') : t('mods.search_pack_ph')}
              style={{ fontSize: 15 }}
            />
          </div>
          <div className="browse">
            {kind === 'mod' ? (
              <aside className="filters">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, fontSize: 12 }}>{t('mods.categories')}</span>
                  {!!cats.length && <button className="link" onClick={() => setCats([])}>{t('mods.reset')}</button>}
                </div>
                <div className="chips">
                  {allCats.map((c) => (
                    <button key={c} className={'chip' + (cats.includes(c) ? ' on' : '')} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}>
                      {catLabel(c)}
                    </button>
                  ))}
                </div>
                <div className="sub" style={{ margin: '8px 0 0' }}>{t('mods.filter_line', { mc: inst.mcVersion, loader: inst.loader })}{total > 0 && t('mods.filter_total', { n: total.toLocaleString() })}</div>
              </aside>
            ) : (
              <aside className="filters">
                <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, fontSize: 12 }}>{kindLabel.toUpperCase()}</div>
                <div className="sub" style={{ margin: '8px 0 0' }}>{t('mods.filter_line_mc', { mc: inst.mcVersion })}{total > 0 && t('mods.filter_total', { n: total.toLocaleString() })}</div>
                <div className="sub" style={{ margin: '8px 0 0' }}>{t('mods.installed_count', { n: kindFiles.length })}</div>
              </aside>
            )}
            <div className="grid mods" style={{ flex: 1 }}>
              {loading && !hits.length && <>{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel" />)}</>}
              {!loading && !hits.length && <div className="sub">{t('mods.nothing_found')}</div>}
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
                      {busy === h.id ? t('mods.installing') : t('mods.install')}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <span className="sub" style={{ margin: 0 }}>{t('mods.shown_of', { a: hits.length, b: total.toLocaleString() })}</span>
            {hits.length < total && (
              <button className="btn ghost" disabled={loading} onClick={() => doSearch(q, cats, offset + LIMIT, true)}>
                {loading ? t('mods.loading_more') : t('mods.show_more')}
              </button>
            )}
          </div>
          {kind !== 'mod' && (
            <>
              <h3 style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, marginTop: 18 }}>{t('mods.installed_title', { n: kindFiles.length })}</h3>
              <div className="grid">
                {kindFiles.map((f) => (
                  <div key={f.name} className="card row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Consolas,monospace', fontSize: 13 }}>{f.name}</span>
                    <button
                      className="btn ghost"
                      onClick={() => call('content:delete', { instanceId: inst.id, sub: kindSub, file: f.name }).then(() => refreshKindFiles())}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
                {!kindFiles.length && <div className="sub">{t('mods.empty_small')}</div>}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'files' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          {([
            [t('mods.kind_mod'), 'mods', t('mods.file_mods_d', { n: mine.length })],
            [t('mods.kind_shader'), 'shaderpacks', t('mods.file_shaders_d')],
            [t('mods.kind_resourcepack'), 'resourcepacks', '16x–512x'],
            [t('mods.file_saves_t'), 'saves', t('mods.file_saves_d')],
            [t('mods.file_shots_t'), 'screenshots', t('mods.file_shots_d')],
            [t('mods.file_root_t'), '', t('mods.file_root_d')],
          ] as [string, string, string][]).map(([ft, rel, d]) => (
            <button key={ft} className="card" style={{ cursor: 'pointer', textAlign: 'left', color: 'inherit' }} onClick={() => call('paths:open', { instanceId: inst.id, rel })}>
              <div className="row" style={{ gap: 10 }}>
                <FolderIcon size={20} />
                <span style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{ft}</span>
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
                <div className="sub" style={{ margin: 0 }}>{fmtSize(w.size)} · {new Date(w.mtime).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'ru-RU')}</div>
              </div>
              <button className="btn ghost" onClick={() => call('paths:open', { instanceId: inst.id, rel: `saves/${w.name}` })}>{t('common.open')}</button>
            </div>
          ))}
          {!worlds.length && <div className="sub">{t('mods.no_worlds')}</div>}
        </div>
      )}

      {tab === 'logs' && (
        <div>
          <div className="sub">{t('mods.status_line', { s: status })}</div>
          <div className="log" style={{ marginTop: 8, maxHeight: 380 }}>
            {log.length ? [...log].reverse().join('\n') : t('mods.no_logs')}
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!pendingDel}
        title={t('mods.del_title')}
        text={t('mods.del_text', { file: pendingDel, inst: inst.name })}
        okLabel={t('common.delete')}
        danger
        onOk={remove}
        onCancel={() => setPendingDel('')}
      />
    </div>
  )
}
