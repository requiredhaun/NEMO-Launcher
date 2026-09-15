import { useEffect, useState } from 'react'
import { call } from './ipc'

export interface LoaderOpt {
  id: string
  label: string
  hint: string
  supported: boolean
  versions: string[]
}

const META: { id: string; label: string; hint: string }[] = [
  { id: 'vanilla', label: 'Без модов', hint: 'чистый Minecraft' },
  { id: 'fabric', label: 'Fabric', hint: 'лёгкий, много модов' },
  { id: 'quilt', label: 'Quilt', hint: 'форк Fabric' },
  { id: 'forge', label: 'Forge', hint: 'классика, ставится дольше' },
  { id: 'neoforge', label: 'NeoForge', hint: 'современный Forge' },
]

/** Какие загрузчики реально вышли под версию MC + их версии. Кэш на MC. */
const cache = new Map<string, Record<string, { supported: boolean; versions: string[] }>>()

export function useLoaderSupport(mc: string): { loaders: LoaderOpt[]; loading: boolean } {
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

  const loaders: LoaderOpt[] = META.map((m) => {
    if (m.id === 'vanilla') return { ...m, supported: true, versions: [] }
    const s = data[m.id]
    return {
      ...m,
      supported: s ? s.supported : true,
      versions: s?.versions || [],
      hint: s && !s.supported ? `не вышел для ${mc}` : m.hint,
    }
  })
  return { loaders, loading }
}
