import { useEffect, useState } from 'react'
import { call } from '../lib/ipc'
import { ACCENTS, THEME_PRESETS, presetMatches, applyTheme, type Theme } from '../lib/theme'

export function Settings() {
  const [cfg, setCfg] = useState<any>(null)
  const [info, setInfo] = useState<any>(null)
  const [presets, setPresets] = useState<any>({})

  const load = async () => {
    const c = await call<any>('config:get')
    setCfg(c)
    if (c?.theme) applyTheme(c.theme)
    setInfo(await call('system:info'))
    setPresets(await call('config:flagPresets'))
  }
  useEffect(() => { load() }, [])

  const set = async (patch: any) => {
    const c = await call<any>('config:set', patch)
    setCfg(c)
    if (c?.theme) applyTheme(c.theme)
  }
  const setTheme = (patch: Partial<Theme>) => set({ theme: { ...theme, ...patch } })
  if (!cfg) return <div className="sub">…</div>
  const theme: Theme = { accent: 'red', dots: true, glow: true, animations: true, dotFont: true, compact: false, ...(cfg.theme || {}) }

  return (
    <div>
      <h1 className="h-dot">Настройки</h1>
      <p className="sub">всего памяти: {info?.totalRamMB} МБ · советуем: {info?.recommendedRamMB} МБ</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>ПАМЯТЬ ПО УМОЛЧАНИЮ — {cfg.ramMB} МБ</div>
          <input type="range" min={1024} max={Math.min(16384, info?.totalRamMB || 8192)} step={256} value={cfg.ramMB}
            onChange={(e) => set({ ramMB: Number(e.target.value) })} style={{ width: '100%', marginTop: 12, accentColor: 'var(--red)' }} />
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
            <button className="btn ghost" onClick={() => call('java:pick').then((p: any) => p && set({ javaPath: p }))}>Обзор</button>
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
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>ДИЗАЙН ЛАУНЧЕРА</div>
          <div className="sub" style={{ margin: '6px 0 0' }}>Готовые темы</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 8 }}>
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id} className="card" style={{ cursor: 'pointer', textAlign: 'left', padding: 12, borderColor: presetMatches(p, theme) ? 'var(--red)' : undefined }}
                onClick={() => setTheme({ ...p.theme })}
              >
                <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 1, fontSize: 13 }}>{p.label}</div>
                <div className="sub" style={{ margin: '4px 0 0' }}>{p.sub}</div>
              </button>
            ))}
          </div>
          <div className="sub" style={{ margin: '6px 0 0' }}>Акцентный цвет</div>
          <div className="swatches">
            {Object.entries(ACCENTS).map(([id, a]) => (
              <button
                key={id} title={a.label} className={'swatch' + (theme.accent === id ? ' on' : '')}
                style={{ background: a.hex }} onClick={() => setTheme({ accent: id })}
              />
            ))}
          </div>
          {[
            ['dots', 'Точки на фоне', 'dot-сетка как у Nothing'],
            ['glow', 'Свечение', 'пульс кнопки Играть и неоновые тени'],
            ['animations', 'Анимации', 'переходы, волны точек, скелетоны'],
            ['dotFont', 'Dot-шрифт заголовков', 'выкл — обычный шрифт везде'],
            ['compact', 'Компактный вид', 'меньше отступы, больше влезает'],
          ].map(([key, label, sub]) => (
            <div key={key} className="toggle-row">
              <div>
                <div>{label}</div>
                <div className="t-sub">{sub}</div>
              </div>
              <button
                className={'switch' + ((theme as any)[key] ? ' on' : '')}
                onClick={() => setTheme({ [key]: !(theme as any)[key] } as any)}
                title={label}
              />
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>DISCORD</div>
          <div className="toggle-row" style={{ marginTop: 6 }}>
            <div>
              <div>Статус в Discord</div>
              <div className="t-sub">что запущено — видно в профиле</div>
            </div>
            <button
              className={'switch' + (cfg.discordRpc ? ' on' : '')}
              onClick={() => set({ discordRpc: !cfg.discordRpc }).then(() => call('discord:refresh'))}
              title="Discord Rich Presence"
            />
          </div>
          {cfg.discordRpc && (
            <div className="sub" style={{ margin: '8px 0 0', lineHeight: 1.7 }}>
              Статус идёт через встроенный ID приложения NEMO — ничего вбивать не надо.<br />
              Чтобы вместо «?» была иконка: загрузи <b>build/icon.png</b> из папки лаунчера в App Icon своего Discord-приложения.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
