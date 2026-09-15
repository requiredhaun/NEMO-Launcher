import { useEffect, useState } from 'react'
import { call } from '../lib/ipc'

export function Settings() {
  const [cfg, setCfg] = useState<any>(null)
  const [info, setInfo] = useState<any>(null)
  const [presets, setPresets] = useState<any>({})

  const load = async () => {
    setCfg(await call('config:get'))
    setInfo(await call('system:info'))
    setPresets(await call('config:flagPresets'))
  }
  useEffect(() => { load() }, [])

  const set = async (patch: any) => { setCfg(await call('config:set', patch)) }
  if (!cfg) return <div className="sub">…</div>

  return (
    <div>
      <h1 className="h-dot">Настройки</h1>
      <p className="sub">всего памяти: {info?.totalRamMB} МБ · советуем: {info?.recommendedRamMB} МБ</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>ПАМЯТЬ ПО УМОЛЧАНИЮ — {cfg.ramMB} МБ</div>
          <input type="range" min={1024} max={Math.min(16384, info?.totalRamMB || 8192)} step={256} value={cfg.ramMB}
            onChange={(e) => set({ ramMB: Number(e.target.value) })} style={{ width: '100%', marginTop: 12, accentColor: '#d71920' }} />
          {cfg.ramMB > (info?.totalRamMB || 8192) * 0.7 && <div style={{ color: '#ffb020' }}>⚠ больше 70% ОЗУ системы</div>}
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>РЕЖИМ ПРОИЗВОДИТЕЛЬНОСТИ</div>
          <select className="select" style={{ marginTop: 10 }} value={cfg.flagsPreset} onChange={(e) => set({ flagsPreset: e.target.value })}>
            {Object.entries(presets).map(([k, v]: any) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {cfg.flagsPreset === 'custom' && (
            <input className="input" style={{ marginTop: 8 }} value={cfg.customFlags} onChange={(e) => set({ customFlags: e.target.value })} placeholder="-XX:+UseG1GC …" />
          )}
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>JAVA И ОКНО ИГРЫ</div>
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input" value={cfg.javaPath} onChange={(e) => set({ javaPath: e.target.value })} placeholder="auto (рантайм Mojang)" />
            <button className="btn ghost" onClick={() => call('java:pick').then((p: any) => p && set({ javaPath: p }))}>…</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" type="number" value={cfg.gameWidth} onChange={(e) => set({ gameWidth: Number(e.target.value) })} />
            <input className="input" type="number" value={cfg.gameHeight} onChange={(e) => set({ gameHeight: Number(e.target.value) })} />
            <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={cfg.fullscreenGame} onChange={(e) => set({ fullscreenGame: e.target.checked })} /> Во всё окно</label>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={() => call('launch:openGameFolder', {})}>Папка игры</button>
            <button className="btn ghost" onClick={() => call('gamedir:reset').then(load)}>Сбросить путь</button>
          </div>
        </div>
      </div>
    </div>
  )
}
