import { tl } from './i18n'

const API = 'https://api.modrinth.com/v2'

export type ProjectKind = 'mod' | 'modpack' | 'shader' | 'resourcepack'

/** Папка контента внутри сборки по типу проекта. */
export function contentSubdir(kind: ProjectKind): string {
  if (kind === 'shader') return 'shaderpacks'
  if (kind === 'resourcepack') return 'resourcepacks'
  return 'mods'
}

export interface ModHit { id: string; slug: string; title: string; description: string; author: string; downloads: number; iconUrl?: string; categories: string[]; clientSide?: string; serverSide?: string }
export interface ModVersion { id: string; version_number: string; game_versions: string[]; loaders: string[]; files: { url: string; filename: string; primary: boolean; hashes?: { sha512?: string } }[]; dependencies: { project_id?: string; dependency_type: string }[] }
export interface PackFile { hashes: { sha512?: string; sha1?: string }; url: string; filename: string; primary: boolean; size: number }

export const MOD_CATEGORIES = [
  'adventure', 'cursed', 'decoration', 'economy', 'equipment', 'food',
  'game-mechanics', 'library', 'magic', 'management', 'minigame', 'mobs',
  'optimization', 'social', 'storage', 'technology', 'transportation',
  'utility', 'worldgen',
] as const

export async function searchProjects(query: string, kind: ProjectKind, gameVersion?: string, loader?: string, offset = 0, categories: string[] = []): Promise<{ total: number; hits: ModHit[] }> {
  const params = new URLSearchParams({ query, limit: '24', offset: String(offset), index: 'downloads' })
  // каждый внутренний массив — OR, между массивами — AND
  const facets: string[][] = [[`project_type:${kind}`]]
  if (gameVersion) facets.push([`versions:"${gameVersion}"`])
  // у шейдеров/текстурпаков загрузчиков нет — фильтр только для модов
  if (kind === 'mod' && loader && loader !== 'any' && loader !== 'vanilla') facets.push([`categories:"${loader}"`])
  const cats = categories.filter(Boolean)
  if (cats.length) facets.push(cats.map((c) => `categories:"${c}"`))
  params.set('facets', JSON.stringify(facets))
  const res = await fetch(`${API}/search?${params}`, { headers: { 'User-Agent': 'NemaLauncher/0.1' } })
  if (!res.ok) throw new Error(`Modrinth: ${res.status}`)
  const j: any = await res.json()
  const CATS = new Set<string>(MOD_CATEGORIES as unknown as string[])
  return {
    total: j.total_hits || 0,
    // в поиске загрузчики подмешаны в categories — оставляем только настоящие категории
    hits: (j.hits || []).map((h: any) => ({ id: h.project_id, slug: h.slug, title: h.title, description: h.description, author: h.author, downloads: h.downloads, iconUrl: h.icon_url, categories: ((h.categories || []) as string[]).filter((c) => CATS.has(c)), clientSide: h.client_side, serverSide: h.server_side })),
  }
}

export async function projectVersions(projectId: string, gameVersion?: string, loader?: string): Promise<ModVersion[]> {
  const params = new URLSearchParams()
  if (gameVersion) params.set('game_versions', JSON.stringify([gameVersion]))
  if (loader && loader !== 'any' && loader !== 'vanilla') params.set('loaders', JSON.stringify([loader]))
  const res = await fetch(`${API}/project/${projectId}/version?${params}`, { headers: { 'User-Agent': 'NemaLauncher/0.1' } })
  if (!res.ok) throw new Error(`Modrinth: ${res.status}`)
  return (await res.json()) as ModVersion[]
}

export function pickVersion(versions: ModVersion[], gameVersion?: string, loader?: string): ModVersion | null {
  if (!versions.length) return null
  const norm = (l: string) => l.toLowerCase()
  const scored = versions.map((v) => {
    let score = 0
    if (gameVersion && v.game_versions.includes(gameVersion)) score += 2
    if (loader && loader !== 'any' && loader !== 'vanilla' && v.loaders.map(norm).includes(norm(loader))) score += 2
    return { v, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  // нулевое совпадение = ставим заведомо чужой jar; честно отказываем, коллер уже кидает "Нет версии…"
  const need = (gameVersion ? 2 : 0) + (loader && loader !== 'any' && loader !== 'vanilla' ? 2 : 0)
  if (best.score < need) return null
  return best.v
}

export async function downloadUrl(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': 'NemaLauncher/0.1' } })
  if (!res.ok) throw new Error(tl('modrinth.dl', { status: res.status }))
  return Buffer.from(await res.arrayBuffer())
}
