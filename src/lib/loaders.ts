import { useEffect, useState } from 'react'
import { call } from './ipc'
import { t, useLang } from './i18n'

export interface LoaderOpt {
  id: string
  label: string
  hint: string
  supported: boolean
  versions: string[]
}

const META_IDS = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'] as const

/** Какие загрузчики реально вышли под версию MC + их версии. Кэш на MC. */
const cache = new Map<string, Record<string, { supported: boolean; versions: string[] }>>()

export function useLoaderSupport(mc: string): { loaders: LoaderOpt[]; loading: boolean } {
  useLang()
  const [data, setData] = useState<Record<string, { supported: boolean; versions: string[] }>>(() => cache.get(mc) || {})
  const [loading, setLoading] = useState(!cache.has(mc))

  useEffect(() => {
    let alive = true
    const cached = cache.get(mc)
    if (cached) { setData(cached); setLoading(false); return }
    setLoading(true)
    call<Record<string, { supported: boolean; versions: string[] }>>('versions:loaderSupport', { mc })
      .then((d) => { cache.set(mc, d); if (alive) setData(d) })
      .catch(() => { if (alive) setData({}) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [mc])

  const loaders: LoaderOpt[] = META_IDS.map((id) => {
    if (id === 'vanilla') return { id, label: t('loader.vanilla_label'), hint: t('loader.vanilla_hint'), supported: true, versions: [] }
    const s = data[id]
    return {
      id,
      label: t(`loader.${id}_label`),
      hint: s && !s.supported ? t('loader.unsupported', { mc }) : t(`loader.${id}_hint`),
      supported: s ? s.supported : true,
      versions: s?.versions || [],
    }
  })
  return { loaders, loading }
}
