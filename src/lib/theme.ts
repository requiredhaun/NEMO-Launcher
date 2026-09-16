import { t } from './i18n'

export const ACCENTS: Record<string, { hex: string; soft: string; on: string }> = {
  red: { hex: '#d71920', soft: '#ff6b6f', on: '#ffffff' },
  green: { hex: '#16c60c', soft: '#4ade80', on: '#ffffff' },
  purple: { hex: '#a855f7', soft: '#c084fc', on: '#ffffff' },
  blue: { hex: '#3b82f6', soft: '#60a5fa', on: '#ffffff' },
  orange: { hex: '#f97316', soft: '#fb923c', on: '#ffffff' },
  white: { hex: '#e8e8e8', soft: '#ffffff', on: '#111111' },
}

export function accentLabel(id: string): string {
  const key = `accent.${id}`
  const s = t(key)
  return s === key ? id : s
}

export type ThemeMode = 'dark' | 'light'

export interface Theme {
  mode: ThemeMode
  accent: string
  dots: boolean
  glow: boolean
  animations: boolean
  dotFont: boolean
  compact: boolean
}

export function accentHex(accent: string): string {
  return ACCENTS[accent]?.hex || ACCENTS.red.hex
}

/** Применить тему к документу: режим, акцент, шрифт, классы плотности/анимаций. */
export function applyTheme(t: Partial<Theme>): void {
  const root = document.documentElement
  const accent = ACCENTS[t.accent || 'red'] || ACCENTS.red
  const light = t.mode === 'light'
  root.style.setProperty('--red', accent.hex)
  root.style.setProperty('--accent-soft', accent.soft)
  root.style.setProperty('--on-accent', accent.on)
  root.style.setProperty(
    '--font-dot',
    t.dotFont === false ? 'var(--font-ui)' : '"DotGothic16", "VT323", "Consolas", monospace',
  )
  document.body.classList.toggle('light', light)
  document.body.classList.toggle('no-anim', t.animations === false)
  document.body.classList.toggle('no-glow', t.glow === false)
  document.body.classList.toggle('compact', t.compact === true)
  document.body.classList.toggle('no-dots', t.dots === false)
  window.dispatchEvent(new CustomEvent('nemo:theme'))
}
