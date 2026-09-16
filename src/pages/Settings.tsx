import { useEffect, useState } from 'react'
import { call } from '../lib/ipc'
import { t, useLang, setLang, type Lang } from '../lib/i18n'
import { ACCENTS, accentLabel, applyTheme, type Theme } from '../lib/theme'

export function Settings() {
  const lang = useLang()
  const [cfg, setCfg] = useState<any>(null)
  const [info, setInfo] = useState<any>(null)
  const [presets, setPresets] = useState<any>({})

  const load = async () => {
    const c = await call<any>('config:get')
    setCfg(c)
    if (c?.theme) applyTheme(c.theme)
    if (c?.language === 'ru' || c?.language === 'en') setLang(c.language as Lang)
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
  const setLanguage = async (l: Lang) => {
    setLang(l)
    await set({ language: l })
    setPresets(await call('config:flagPresets'))
  }
  if (!cfg) return <div className="sub">…</div>
  const theme: Theme = { mode: 'dark', accent: 'red', dots: true, glow: true, animations: true, dotFont: true, compact: false, ...(cfg.theme || {}) }

  return (
    <div>
      <h1 className="h-dot">{t('settings.title')}</h1>
      <p className="sub">{t('settings.ram_line', { total: info?.totalRamMB ?? '', rec: info?.recommendedRamMB ?? '' })}</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t('settings.lang_title')}</div>
          <div className="sub" style={{ margin: '6px 0 0' }}>{t('settings.lang_note')}</div>
          <div className="row" style={{ marginTop: 8 }}>
            {([['ru', 'Русский'], ['en', 'English']] as const).map(([v, l]) => (
              <button
                key={v} className="btn" style={lang === v ? { borderColor: 'var(--red)', color: 'var(--accent-soft)' } : {}}
                onClick={() => setLanguage(v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t('settings.ram_default', { n: cfg.ramMB })}</div>
          <input type="range" min={1024} max={Math.min(16384, info?.totalRamMB || 8192)} step={256} value={cfg.ramMB}
            onChange={(e) => set({ ramMB: Number(e.target.value) })} style={{ width: '100%', marginTop: 12, accentColor: 'var(--red)' }} />
          {cfg.ramMB > (info?.totalRamMB || 8192) * 0.7 && <div style={{ color: '#ffb020' }}>{t('settings.ram_warn')}</div>}
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t('settings.perf_title')}</div>
          <select className="select" style={{ marginTop: 10 }} value={cfg.flagsPreset} onChange={(e) => set({ flagsPreset: e.target.value })}>
            {Object.entries(presets).map(([k, v]: any) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {cfg.flagsPreset === 'custom' && (
            <input className="input" style={{ marginTop: 8 }} value={cfg.customFlags} onChange={(e) => set({ customFlags: e.target.value })} placeholder="-XX:+UseG1GC …" />
          )}
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t('settings.java_title')}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input" value={cfg.javaPath} onChange={(e) => set({ javaPath: e.target.value })} placeholder={t('settings.java_ph')} />
            <button className="btn ghost" onClick={() => call('java:pick').then((p: any) => p && set({ javaPath: p }))}>{t('settings.browse')}</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" type="number" value={cfg.gameWidth} onChange={(e) => set({ gameWidth: Number(e.target.value) })} />
            <input className="input" type="number" value={cfg.gameHeight} onChange={(e) => set({ gameHeight: Number(e.target.value) })} />
            <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={cfg.fullscreenGame} onChange={(e) => set({ fullscreenGame: e.target.checked })} /> {t('settings.fullscreen')}</label>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost" onClick={() => call('launch:openGameFolder', {})}>{t('settings.game_folder')}</button>
            <button className="btn ghost" onClick={() => call('gamedir:reset').then(load)}>{t('settings.reset_path')}</button>
          </div>
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t('settings.design_title')}</div>
          <div className="sub" style={{ margin: '6px 0 0' }}>{t('settings.theme')}</div>
          <div className="row" style={{ marginTop: 8 }}>
            {([['dark', 'settings.dark'], ['light', 'settings.light']] as const).map(([v, k]) => (
              <button
                key={v} className="btn" style={theme.mode === v ? { borderColor: 'var(--red)', color: 'var(--accent-soft)' } : {}}
                onClick={() => setTheme({ mode: v })}
              >
                {t(k)}
              </button>
            ))}
          </div>
          <div className="sub" style={{ margin: '6px 0 0' }}>{t('settings.accent')}</div>
          <div className="swatches">
            {Object.entries(ACCENTS).map(([id, a]) => (
              <button
                key={id} title={accentLabel(id)} className={'swatch' + (theme.accent === id ? ' on' : '')}
                style={{ background: a.hex }} onClick={() => setTheme({ accent: id })}
              />
            ))}
          </div>
          {([
            ['dots', 'settings.tgl_dots', 'settings.tgl_dots_d'],
            ['glow', 'settings.tgl_glow', 'settings.tgl_glow_d'],
            ['animations', 'settings.tgl_anim', 'settings.tgl_anim_d'],
            ['dotFont', 'settings.tgl_dotfont', 'settings.tgl_dotfont_d'],
            ['compact', 'settings.tgl_compact', 'settings.tgl_compact_d'],
          ] as const).map(([key, labelKey, subKey]) => (
            <div key={key} className="toggle-row">
              <div>
                <div>{t(labelKey)}</div>
                <div className="t-sub">{t(subKey)}</div>
              </div>
              <button
                className={'switch' + ((theme as any)[key] ? ' on' : '')}
                onClick={() => setTheme({ [key]: !(theme as any)[key] } as any)}
                title={t(labelKey)}
              />
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>DISCORD</div>
          <div className="toggle-row" style={{ marginTop: 6 }}>
            <div>
              <div>{t('settings.discord_title')}</div>
              <div className="t-sub">{t('settings.discord_sub')}</div>
            </div>
            <button
              className={'switch' + (cfg.discordRpc ? ' on' : '')}
              onClick={() => set({ discordRpc: !cfg.discordRpc }).then(() => call('discord:refresh'))}
              title="Discord Rich Presence"
            />
          </div>
          {cfg.discordRpc && (
            <div className="sub" style={{ margin: '8px 0 0', lineHeight: 1.7 }}>
              {t('settings.discord_note1')}<br />
              {t('settings.discord_note2a')}<b>build/icon.png</b>{t('settings.discord_note2b')}
            </div>
          )}
        </div>
        <UpdateCard cfg={cfg} set={set} />
      </div>
    </div>
  )
}

function UpdateCard({ cfg, set }: { cfg: any; set: (p: any) => Promise<void> }) {
  useLang()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const check = async () => {
    setBusy(true); setMsg(t('update.checking'))
    try {
      const r = await call<any>('update:check', { manual: true })
      setMsg(r?.available ? t('update.available', { tag: r.latest }) : t('update.uptodate'))
    } catch (e: any) {
      setMsg(t('update.failed', { msg: e?.message || 'IPC error' }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card">
      <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2 }}>{t('update.title')}</div>
      <div className="sub" style={{ margin: '6px 0 0' }}>{t('update.current', { v: __APP_VERSION__ })}</div>
      <div className="toggle-row" style={{ marginTop: 6 }}>
        <div>
          <div>{t('update.auto')}</div>
          <div className="t-sub">{t('update.auto_sub')}</div>
        </div>
        <button
          className={'switch' + (cfg.autoCheckUpdates !== false ? ' on' : '')}
          onClick={() => set({ autoCheckUpdates: cfg.autoCheckUpdates === false })}
          title={t('update.auto')}
        />
      </div>
      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
        <button className="btn ghost" onClick={check} disabled={busy}>{t('update.check_now')}</button>
        {!!cfg.skippedVersion && (
          <button className="btn ghost" onClick={() => set({ skippedVersion: '' }).then(() => setMsg(''))}>
            {t('update.unskip')}
          </button>
        )}
      </div>
      {!!cfg.skippedVersion && <div className="sub" style={{ marginTop: 6 }}>{t('update.skipped', { v: cfg.skippedVersion })}</div>}
      {!!msg && <div className="sub" style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  )
}
