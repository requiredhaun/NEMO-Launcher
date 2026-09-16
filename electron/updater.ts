import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { app, shell } from 'electron'
import { tl } from './i18n'

const REPO = 'requiredhaun/NEMO-Launcher'
const API_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`

export interface UpdateInfo {
  current: string
  latest: string
  available: boolean
  name: string
  notes: string
  pageUrl: string
  setupUrl: string
}

/** Сравнение версий: 'v1.0.1' vs '1.0.2' → -1/0/1. Чистая, для тестов. */
export function cmpVersions(a: string, b: string): number {
  const norm = (s: string) => String(s || '').trim().replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0)
  const pa = norm(a)
  const pb = norm(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}

/** Выбор установщика из ассетов релиза: Setup-exe, иначе первый .exe, иначе ''. */
export function pickSetupAsset(assets: any[]): string {
  const exes = (assets || []).filter((a) => String(a?.name || '').toLowerCase().endsWith('.exe'))
  const setup = exes.find((a) => String(a.name).toLowerCase().includes('setup'))
  return (setup || exes[0])?.browser_download_url || ''
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const current = app.getVersion()
  const res = await fetch(API_LATEST, { headers: { 'User-Agent': 'NEMO-Launcher', Accept: 'application/vnd.github+json' } })
  if (res.status === 404) {
    return { current, latest: current, available: false, name: '', notes: '', pageUrl: `https://github.com/${REPO}/releases`, setupUrl: '' }
  }
  if (!res.ok) throw new Error(tl('upd.checkFail', { status: res.status }))
  const j: any = await res.json()
  const latest = String(j?.tag_name || current)
  const setupUrl = pickSetupAsset(j?.assets || [])
  return {
    current,
    latest,
    available: cmpVersions(current, latest) < 0,
    name: String(j?.name || latest),
    notes: String(j?.body || ''),
    pageUrl: String(j?.html_url || `https://github.com/${REPO}/releases`),
    setupUrl,
  }
}

export function openReleasesPage(url: string): void {
  shell.openExternal(url)
}

/** Качает установщик в кэш с прогрессом. Возвращает путь к файлу. */
export async function downloadUpdate(url: string, onProgress?: (done: number, total: number) => void): Promise<string> {
  if (!url) throw new Error(tl('upd.noAsset'))
  const res = await fetch(url, { headers: { 'User-Agent': 'NEMO-Launcher' } })
  if (!res.ok || !res.body) throw new Error(tl('upd.checkFail', { status: res.status }))
  const total = Number(res.headers.get('content-length')) || 0
  const dir = path.join(app.getPath('userData'), 'cache', 'updates')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `NEMO-Setup-${Date.now()}.exe`)
  const out = fs.createWriteStream(file)
  let done = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done: fin, value } = await reader.read()
    if (fin) break
    out.write(Buffer.from(value))
    done += value.length
    onProgress?.(done, total)
  }
  await new Promise<void>((res2, rej) => out.end((e: any) => (e ? rej(e) : res2())))
  return file
}

/** Запускает установщик отдельно и гасит лаунчер — иначе NSIS упрётся в занятые файлы. */
export function launchInstaller(file: string): void {
  spawn(file, [], { detached: true, stdio: 'ignore' }).unref()
  app.quit()
}
