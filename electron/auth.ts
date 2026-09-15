import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const AUTHSERVER = 'https://authserver.ely.by'
const SKINSYSTEM = 'https://skinsystem.ely.by'

export interface ElyProfile { id: string; name: string }
export interface ElySession { accessToken: string; clientToken: string; profile: ElyProfile }

const secretsFile = () => path.join(app.getPath('userData'), 'secrets.json')

export function loadSession(): ElySession | null {
  try {
    const s = JSON.parse(fs.readFileSync(secretsFile(), 'utf-8')) as ElySession
    return s.accessToken && s.profile?.name && s.profile?.id ? s : null
  } catch { return null }
}

export function saveSession(s: ElySession | null): void {
  if (!s) { try { fs.unlinkSync(secretsFile()) } catch { /* ignore */ } return }
  fs.mkdirSync(path.dirname(secretsFile()), { recursive: true })
  fs.writeFileSync(secretsFile(), JSON.stringify(s, null, 2), 'utf-8')
}

export function dashed(uuid: string): string {
  const c = uuid.replace(/-/g, '')
  if (c.length !== 32) return uuid
  return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`
}

export async function elyLogin(login: string, password: string): Promise<ElySession> {
  const res = await fetch(`${AUTHSERVER}/authenticate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent: { name: 'Minecraft', version: 1 }, username: login, password, clientToken: crypto.randomUUID(), requestUser: true }),
  })
  const body: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.errorMessage || body?.error || `Ely.by: ${res.status}`)
  const profile = body.selectedProfile || body.availableProfiles?.[0]
  if (!profile) throw new Error('У аккаунта Ely.by нет профиля Minecraft')
  const s: ElySession = { accessToken: body.accessToken, clientToken: body.clientToken, profile: { id: profile.id, name: profile.name } }
  saveSession(s)
  return s
}

export async function elyEnsureValid(): Promise<ElySession | null> {
  const s = loadSession()
  if (!s) return null
  try {
    const v = await fetch(`${AUTHSERVER}/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: s.accessToken, clientToken: s.clientToken }),
    })
    if (v.ok) return s
  } catch { return s }
  try {
    const r = await fetch(`${AUTHSERVER}/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: s.accessToken, clientToken: s.clientToken, requestUser: true }),
    })
    const b: any = await r.json().catch(() => ({}))
    if (r.ok && b.accessToken) {
      const fresh: ElySession = { accessToken: b.accessToken, clientToken: b.clientToken || s.clientToken, profile: b.selectedProfile ? { id: b.selectedProfile.id, name: b.selectedProfile.name } : s.profile }
      saveSession(fresh)
      return fresh
    }
  } catch { /* ignore */ }
  return null
}

export async function elyLogout(): Promise<void> {
  const s = loadSession()
  if (s) {
    try {
      await fetch(`${AUTHSERVER}/invalidate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: s.accessToken, clientToken: s.clientToken }),
      })
    } catch { /* ignore */ }
  }
  saveSession(null)
}
