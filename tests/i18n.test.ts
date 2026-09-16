import { describe, it, expect } from 'vitest'
import { t, setLang, tl } from '../electron/i18n'
import { STR } from '../src/lib/i18n'

describe('backend dict parity', () => {
  it('t() interpolates and falls back', () => {
    expect(t('ru', 'java.downloading', { major: 21 })).toContain('21')
    expect(t('en', 'java.downloading', { major: 21 })).toContain('21')
    expect(t('ru', 'no.such.key')).toBe('no.such.key')
  })
  it('tl() follows setLang', () => {
    setLang('en')
    expect(tl('launch.cancelled')).toBe('Launch cancelled')
    setLang('ru')
    expect(tl('launch.cancelled')).toContain('отмен')
    setLang(undefined)
    expect(tl('launch.cancelled')).toContain('отмен')
  })
})

describe('renderer dict parity', () => {
  it('ru/en key sets identical', () => {
    const ru = Object.keys(STR.ru).sort()
    const en = Object.keys(STR.en).sort()
    expect(en).toEqual(ru)
    expect(ru.length).toBeGreaterThan(200)
  })
})
