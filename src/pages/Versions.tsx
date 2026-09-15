import { useEffect, useState } from 'react'
import { call } from '../lib/ipc'
import { useInstances, selectedInstance } from '../store/instancesStore'
import { GlyphLoader } from '../components/GlyphLoader'

const LOADERS: { id: string; label: string }[] = [
  { id: 'vanilla', label: 'Без модов' },
  { id: 'fabric', label: 'Fabric' },
  { id: 'quilt', label: 'Quilt' },
  { id: 'forge', label: 'Forge' },
  { id: 'neoforge', label: 'NeoForge' },
]

export function Versions() {
  const { instances, selectedId, refresh, update } = useInstances()
  const inst = selectedInstance(instances, selectedId)
  const [loader, setLoader] = useState('fabric')
  const [options, setOptions] = useState<string[]>([])
  const [picked, setPicked] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const [loaderTouched, setLoaderTouched] = useState(false)

  // init выбора из инстанса — один раз на инстанс, выбор юзера не затираем
  useEffect(() => {
    if (!inst) return
    if (!loaderTouched) setLoader(inst.loader === 'vanilla' ? 'fabric' : inst.loader)
    setPicked('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst?.id])

  useEffect(() => {
    if (!inst) return
    let alive = true;
    (async () => {
      try {
        let opts: string[] = []
        if (loader === 'fabric') opts = (await call<any[]>('versions:fabricLoaders')).map((l) => l.version).slice(0, 10)
        else if (loader === 'quilt') opts = await call<string[]>('versions:quiltLoaders', { mc: inst.mcVersion })
        else if (loader === 'forge') opts = (Object.values(await call<any>('versions:forgePromos')).filter(Boolean) as string[]).slice(0, 10)
        else if (loader === 'neoforge') opts = await call<string[]>('versions:neoforge', { mc: inst.mcVersion })
        if (alive) setOptions(opts)
      } catch { if (alive) setOptions([]) }
    })()
    return () => { alive = false }
  }, [loader, inst?.mcVersion])

  useEffect(() => {
    const off = window.nema.on('install:log', (l: any) => setLog((s) => [...s.slice(-200), String(l)]))
    return off
  }, [])

  const install = async () => {
    if (!inst) return
    setBusy(true); setLog([])
    try {
      await call('versions:install', { instanceId: inst.id, loader, mc: inst.mcVersion, loaderVersion: picked, full: picked })
      await refresh()
      setLog((s) => [...s, 'OK // версия установлена'])
    } catch (e: any) { setLog((s) => [...s, 'ERR: ' + e.message]) }
    finally { setBusy(false) }
  }

  if (!inst) return <div className="sub">Сначала создай сборку во вкладке «Библиотека»</div>
  return (
    <div>
      <h1 className="h-dot">Версия</h1>
      <p className="sub">{inst.name} · Minecraft {inst.mcVersion} · сейчас стоит: {inst.versionId}</p>
      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {LOADERS.map((l) => (
            <button key={l.id} className="btn" style={loader === l.id ? { borderColor: 'var(--red)', color: '#ff6b6f' } : {}} onClick={() => { setLoaderTouched(true); setLoader(l.id) }}>{l.label}</button>
          ))}
        </div>
        {loader !== 'vanilla' && (
          <div className="row" style={{ marginTop: 12 }}>
            <select className="select" value={picked} onChange={(e) => setPicked(e.target.value)}>
              <option value="">последняя / рекомендуемая</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <button className="btn play" disabled={busy} onClick={install}>{busy ? 'Ставлю…' : 'Установить'}</button>
          </div>
        )}
        {loader === 'vanilla' && (
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn play" disabled={busy} onClick={install}>{busy ? 'Ставлю…' : 'Играть без модов'}</button>
          </div>
        )}
        {busy && <div style={{ marginTop: 12 }}><GlyphLoader text="Ставлю версию…" /></div>}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>ПАМЯТЬ ДЛЯ «{inst.name}» — {inst.ramMB} МБ</div>
        <input type="range" min={1024} max={16384} step={256} value={inst.ramMB}
          onChange={(e) => update(inst.id, { ramMB: Number(e.target.value) })}
          style={{ width: '100%', marginTop: 12, accentColor: '#d71920' }} />
        <div className="sub" style={{ margin: '4px 0 0' }}>сколько памяти дать именно этой сборке</div>
      </div>
      {!!log.length && <div className="log" style={{ marginTop: 12 }}>{log.join('\n')}</div>}
    </div>
  )
}
