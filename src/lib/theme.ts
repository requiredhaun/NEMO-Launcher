export const ACCENTS: Record<string, { label: string; hex: string; soft: string }> = {
  red: { label: 'Красный', hex: '#d71920', soft: '#ff6b6f' },
  green: { label: 'Зелёный', hex: '#16c60c', soft: '#4ade80' },
  purple: { label: 'Фиолет', hex: '#a855f7', soft: '#c084fc' },
  blue: { label: 'Синий', hex: '#3b82f6', soft: '#60a5fa' },
  orange: { label: 'Оранж', hex: '#f97316', soft: '#fb923c' },
  white: { label: 'Белый', hex: '#e8e8e8', soft: '#ffffff' },
}

export interface Theme {
  accent: string
  dots: boolean
  glow: boolean
  animations: boolean
  dotFont: boolean
  compact: boolean
}

export interface ThemePreset { id: string; label: string; sub: string; theme: Theme }

const FULL: Theme = { accent: 'red', dots: true, glow: true, animations: true, dotFont: true, compact: false }

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'classic', label: 'NEMO Classic', sub: 'красный · точки · glow', theme: { ...FULL } },
  { id: 'stealth', label: 'Stealth', sub: 'монохром · тихо', theme: { ...FULL, accent: 'white', dots: false, glow: false } },
  { id: 'toxic', label: 'Toxic', sub: 'зелёный · без dot-шрифта', theme: { ...FULL, accent: 'green', dotFont: false } },
  { id: 'amethyst', label: 'Amethyst', sub: 'фиолет · компакт', theme: { ...FULL, accent: 'purple', glow: false, compact: true } },
]

export function presetMatches(p: ThemePreset, t: Partial<Theme>): boolean {
  return (Object.keys(p.theme) as (keyof Theme)[]).every((k) => (t[k] ?? FULL[k]) === p.theme[k])
}

export function accentHex(accent: string): string {
  return ACCENTS[accent]?.hex || ACCENTS.red.hex
}

/** Применить тему к документу: акцент, шрифт, классы плотности/анимаций. */
export function applyTheme(t: Partial<Theme>): void {
  const root = document.documentElement
  const accent = ACCENTS[t.accent || 'red'] || ACCENTS.red
  root.style.setProperty('--red', accent.hex)
  root.style.setProperty('--accent-soft', accent.soft)
  root.style.setProperty(
    '--font-dot',
    t.dotFont === false ? 'var(--font-ui)' : '"DotGothic16", "VT323", "Consolas", monospace',
  )
  document.body.classList.toggle('no-anim', t.animations === false)
  document.body.classList.toggle('no-glow', t.glow === false)
  document.body.classList.toggle('compact', t.compact === true)
  document.body.classList.toggle('no-dots', t.dots === false)
  window.dispatchEvent(new CustomEvent('nemo:theme'))
}
