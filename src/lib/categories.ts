import { t } from './i18n'

export function catLabel(c: string): string {
  const key = `cat.${c}`
  const s = t(key)
  return s === key ? c : s
}
