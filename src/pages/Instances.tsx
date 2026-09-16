import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInstances } from '../store/instancesStore'
import { useGame } from '../store/gameStore'
import { useLoaderSupport } from '../lib/loaders'
import { t, useLang } from '../lib/i18n'
import { call } from '../lib/ipc'

export function Instances() {
  useLang()
  const { instances, selectedId, refresh, select, remove } = useInstances()
  const { launching, playing, launchingId, launch, cancel } = useGame()

  const [name, setName] = useState('')
  const [mc, setMc] = useState('1.21.11')
  const [loader, setLoader] = useState('vanilla')
  const [picked, setPicked] = useState('')
  const [manifest, setManifest] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [clog, setClog] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [playErr, setPlayErr] = useState('')
  const [armDel, setArmDel] = useState('')

  useEffect(() => {
    if (!armDel) return
    const t = setTimeout(() => setArmDel(''), 5000)
    return () => clearTimeout(t)
  }, [armDel])
  const { loaders, loading: loadersLoading } = useLoaderSupport(mc)
  const loaderVersions = loaders.find((l) => l.id === loader)?.versions || []

  useEffect(() => {
    refresh()
    call<any>('versions:manifest')
      .then((m) => {
        setManifest(m.versions.filter((v: any) => v.type === 'release').slice(0, 30))
        if (m?.latest?.release) setMc(m.latest.release)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const off = window.nema.on('install:log', (l: any) => setClog((s) => [...s.slice(-100), String(l)]))
    return off
  }, [])

  useEffect(() => {
    setPicked('')
    if (!loadersLoading && loader !== 'vanilla' && loaders.find((l) => l.id === loader)?.supported === false) {
      setLoader('vanilla')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader, mc, loadersLoading])

  const submit = async () => {
    setErr('')
    setCreating(true)
    setClog([])
    try {
      const inst = await call<any>('instances:create', { name: name.trim() || t('instances.default_name', { n: instances.length + 1 }), mc })
      setClog((s) => [...s, t('instances.created_installing', { loader })])
      await call('versions:install', { instanceId: inst.id, loader, mc, loaderVersion: picked, full: picked })
      await refresh()
      setName('')
      setClog((s) => [...s, t('instances.ready_play')])
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <h1 className="h-dot">{t('instances.title')}</h1>
      <p className="sub">{t('instances.subtitle')}</p>
      <div className="card">
        <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, marginBottom: 10 }}>{t('instances.new_title')}</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="input" placeholder={t('instances.name_ph')} value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <select className="select" value={mc} onChange={(e) => setMc(e.target.value)} style={{ maxWidth: 150 }} title={t('instances.mc_ver_title')}>
            {manifest.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
          </select>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 10 }}>
          {loadersLoading && <span className="sub">{t('instances.checking', { mc })}</span>}
          {!loadersLoading && loaders.map((l) => (
            <button
              key={l.id} className="btn" title={l.hint} disabled={!l.supported}
              style={loader === l.id ? { borderColor: 'var(--red)', color: 'var(--accent-soft)' } : l.supported ? {} : { opacity: 0.4 }}
              onClick={() => setLoader(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        {loader !== 'vanilla' && (
          <div className="row" style={{ marginTop: 10 }}>
            <select className="select" value={picked} onChange={(e) => setPicked(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="">{t('instances.latest_opt')}</option>
              {loaderVersions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <span className="sub" style={{ margin: 0 }}>{t('instances.loader_note')}</span>
          </div>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn play" style={{ padding: '11px 30px', fontSize: 14 }} disabled={creating} onClick={submit}>
            {creating ? t('instances.creating') : t('instances.create')}
          </button>
          {creating && <button className="btn ghost" onClick={() => call('install:cancel').catch(() => {})}>{t('common.cancel')}</button>}
        </div>
        {creating && !!clog.length && <div className="log" style={{ marginTop: 12 }}>{clog.join('\n')}</div>}
        {err && <div style={{ color: 'var(--accent-soft)', marginTop: 8 }}>{err}</div>}
      </div>
      <div className="grid" style={{ marginTop: 14 }}>
        <AnimatePresence>
          {instances.map((i) => (
            <motion.div key={i.id} className="card" layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              style={{ borderColor: i.id === selectedId ? 'var(--red)' : undefined }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, fontSize: 16 }}>{i.name}</div>
                  <div className="sub" style={{ margin: '4px 0 0' }}>{i.mcVersion} · {i.loader} {i.loaderVersion} · {i.versionId}</div>
                </div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {launching && !playing && launchingId === i.id ? (
                    <button className="btn ghost" onClick={() => cancel()}>{t('common.cancel')}</button>
                  ) : (
                    <button
                      className="btn play" style={{ padding: '9px 22px', fontSize: 13 }}
                      disabled={launching || playing}
                      onClick={() => { setPlayErr(''); launch(i.id).catch((e: any) => setPlayErr(e.message)) }}
                    >
                      {playing && i.id === selectedId ? t('instances.in_game') : '▶'}
                    </button>
                  )}
                  {i.id === selectedId ? <span className="badge red">{t('instances.selected')}</span> : <button className="btn ghost" onClick={() => select(i.id)}>{t('instances.select')}</button>}
                  {armDel === i.id ? (
                    <>
                      <button className="btn" style={{ borderColor: 'var(--red)', color: 'var(--accent-soft)' }} onClick={() => { remove(i.id); setArmDel('') }}>{t('instances.confirm_delete')}</button>
                      <button className="btn ghost" onClick={() => setArmDel('')}>{t('common.no')}</button>
                    </>
                  ) : (
                    <button className="btn ghost" onClick={() => setArmDel(i.id)}>{t('common.delete')}</button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!instances.length && <div className="sub">{t('instances.empty')}</div>}
        {playErr && <div style={{ color: 'var(--accent-soft)' }}>{playErr}</div>}
      </div>
    </div>
  )
}
