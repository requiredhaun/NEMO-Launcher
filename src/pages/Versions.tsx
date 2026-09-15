import { useEffect, useState } from 'react'
import { call } from '../lib/ipc'
import { useInstances, selectedInstance } from '../store/instancesStore'
import { GlyphLoader } from '../components/GlyphLoader'

const LOADERS = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']

export function Versions() {
  const { instances, selectedId, refresh } = useInstances()
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

  if (!inst) return <div className="sub">Сначала создай инстанс</div>
  return (
    <div>
      <h1 className="h-dot">VERSIONS</h1>
      <p className="sub">{inst.name} · MC {inst.mcVersion} · сейчас: {inst.versionId}</p>
      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {LOADERS.map((l) => (
            <button key={l} className="btn" style={loader === l ? { borderColor: 'var(--red)', color: '#ff6b6f' } : {}} onClick={() => { setLoaderTouched(true); setLoader(l) }}>{l}</button>
          ))}
        </div>
        {loader !== 'vanilla' && (
          <div className="row" style={{ marginTop: 12 }}>
            <select className="select" value={picked} onChange={(e) => setPicked(e.target.value)}>
              <option value="">latest / recommended</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <button className="btn play" disabled={busy} onClick={install}>{busy ? '…' : 'INSTALL'}</button>
          </div>
        )}
        {loader === 'vanilla' && (
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn play" disabled={busy} onClick={install}>{busy ? '…' : 'USE VANILLA'}</button>
          </div>
        )}
        {busy && <div style={{ marginTop: 12 }}><GlyphLoader text="FORGING VERSION" /></div>}
      </div>
      {!!log.length && <div className="log" style={{ marginTop: 12 }}>{log.join('\n')}</div>}
    </div>
  )
}
