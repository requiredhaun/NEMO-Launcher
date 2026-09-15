import { create } from 'zustand'
import { call } from '../lib/ipc'

interface Auth { mode: string; nick: string; refresh: () => Promise<void>; loginOffline: (nick: string) => Promise<void>; loginEly: (login: string, password: string) => Promise<void>; logout: () => Promise<void> }

export const useAuth = create<Auth>((set) => ({
  mode: 'offline', nick: '',
  refresh: async () => {
    try { const s = await call<any>('auth:state'); set({ mode: s.mode, nick: s.nick || '' }) } catch { /* ignore */ }
  },
  loginOffline: async (nick) => { const s = await call<any>('auth:offline', { nick }); set({ mode: s.mode, nick: s.nick }) },
  loginEly: async (login, password) => { const s = await call<any>('auth:elyLogin', { login, password }); set({ mode: s.mode, nick: s.nick }) },
  logout: async () => { await call('auth:elyLogout'); set({ mode: 'offline' }) },
}))
