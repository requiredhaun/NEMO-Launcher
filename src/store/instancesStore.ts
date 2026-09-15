import { create } from 'zustand'
import { call } from '../lib/ipc'

export interface Instance { id: string; name: string; mcVersion: string; loader: string; loaderVersion: string; versionId: string; ramMB: number; gameDir: string }

interface S {
  instances: Instance[]
  selectedId: string
  loading: boolean
  refresh: () => Promise<void>
  create: (name: string, mc: string) => Promise<void>
  select: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  update: (id: string, patch: Partial<Instance>) => Promise<void>
}

export const useInstances = create<S>((set, get) => ({
  instances: [], selectedId: '', loading: false,
  refresh: async () => {
    set({ loading: true })
    try {
      const list = await call<Instance[]>('instances:list')
      const cfg = await call<any>('config:get')
      set({ instances: list, selectedId: cfg.selectedInstanceId || list[0]?.id || '' })
    } finally { set({ loading: false }) }
  },
  create: async (name, mc) => {
    const inst = await call<Instance>('instances:create', { name, mc })
    await get().refresh()
    set({ selectedId: inst.id })
  },
  select: async (id) => { await call('instances:select', { id }); set({ selectedId: id }) },
  remove: async (id) => {
    const list = await call<Instance[]>('instances:remove', { id })
    const cur = get().selectedId
    const next = list.some((i) => i.id === cur) ? cur : (list[0]?.id || '')
    if (next && next !== cur) await call('instances:select', { id: next })
    set({ instances: list, selectedId: next })
  },
  update: async (id, patch) => {
    await call('instances:update', { id, patch })
    set((s) => ({ instances: s.instances.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
  },
}))

export function selectedInstance(list: Instance[], id: string): Instance | undefined {
  return list.find((i) => i.id === id)
}
