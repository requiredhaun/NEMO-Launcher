const API = 'https://api.modrinth.com/v2'

export interface ModHit { id: string; slug: string; title: string; description: string; author: string; downloads: number; iconUrl?: string }
export interface ModVersion { id: string; version_number: string; game_versions: string[]; loaders: string[]; files: { url: string; filename: string; primary: boolean; hashes?: { sha512?: string } }[]; dependencies: { project_id?: string; dependency_type: string }[] }
export interface PackFile { hashes: { sha512?: string; sha1?: string }; url: string; filename: string; primary: boolean; size: number }

export async function searchProjects(query: string, kind: 'mod' | 'modpack', gameVersion?: string, loader?: string, offset = 0): Promise<{ total: number; hits: ModHit[] }> {
  const params = new URLSearchParams({ query, limit: '24', offset: String(offset), index: 'downloads' })
  const facets: string[] = [`project_type:${kind}`]
  if (gameVersion) facets.push(`versions:"${gameVersion}"`)
  if (loader && loader !== 'any' && loader !== 'vanilla') facets.push(`categories:"${loader}"`)
  params.set('facets', JSON.stringify([facets]))
  const res = await fetch(`${API}/search?${params}`, { headers: { 'User-Agent': 'NemaLauncher/0.1' } })
  if (!res.ok) throw new Error(`Modrinth: ${res.status}`)
  const j: any = await res.json()
  return {
    total: j.total_hits || 0,
    hits: (j.hits || []).map((h: any) => ({ id: h.project_id, slug: h.slug, title: h.title, description: h.description, author: h.author, downloads: h.downloads, iconUrl: h.icon_url })),
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
  if (!res.ok) throw new Error(`Скачивание: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
