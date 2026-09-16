import { useEffect, useState } from 'react'

/** Голова скина Ely.by в сайдбар: качаем скин, кропаем голову+оверлей на canvas. */
export function elySkinUrl(nick: string): string {
  return `https://skinsystem.ely.by/skins/${encodeURIComponent(nick)}.png`
}

const mem = new Map<string, string | null>()
const LS = (nick: string) => `nemo-avatar-${nick.toLowerCase()}`

function readCache(nick: string): string | null {
  if (mem.has(nick)) return mem.get(nick) || null
  try {
    const v = window.localStorage.getItem(LS(nick))
    if (v?.startsWith('data:image')) { mem.set(nick, v); return v }
  } catch { /* ignore */ }
  return null
}

function writeCache(nick: string, url: string): void {
  mem.set(nick, url)
  try { window.localStorage.setItem(LS(nick), url) } catch { /* ignore */ }
}

/** Вырезает голову 8x8 (+оверлей 40,8 для 64x64 скинов), апскейл без сглаживания. */
export async function renderHead(skinUrl: string, px = 96): Promise<string | null> {
  try {
    const res = await fetch(skinUrl, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.includes('png') && blob.size < 100) return null
    const bmp = await createImageBitmap(blob)
    const s = bmp.width / 64
    if (!(s >= 1) || bmp.height < 32 * s) { bmp.close(); return null }
    const c = document.createElement('canvas')
    c.width = px
    c.height = px
    const g = c.getContext('2d')
    if (!g) { bmp.close(); return null }
    g.imageSmoothingEnabled = false
    g.drawImage(bmp, 8 * s, 8 * s, 8 * s, 8 * s, 0, 0, px, px)
    if (bmp.height >= 64 * s) g.drawImage(bmp, 40 * s, 8 * s, 8 * s, 8 * s, 0, 0, px, px)
    bmp.close()
    return c.toDataURL('image/png')
  } catch {
    return null
  }
}

/** dataURL головы или null (нет скина/сети — показать букву). Кэш: память + localStorage. */
export function useAvatar(nick: string): string | null {
  const [url, setUrl] = useState<string | null>(() => (nick ? readCache(nick) : null))
  useEffect(() => {
    if (!nick) { setUrl(null); return }
    let alive = true
    const cached = readCache(nick)
    if (cached) { setUrl(cached); return }
    setUrl(null)
    renderHead(elySkinUrl(nick)).then((u) => {
      if (!alive) return
      if (u) {
        writeCache(nick, u)
        setUrl(u)
      } else {
        mem.set(nick, null)
      }
    })
    return () => { alive = false }
  }, [nick])
  return url
}
