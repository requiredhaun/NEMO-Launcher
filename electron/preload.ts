import { contextBridge, ipcRenderer } from 'electron'

const api = {
  call: (channel: string, payload?: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> =>
    ipcRenderer.invoke(channel, payload),
  on: (channel: string, cb: (data: unknown) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: unknown) => cb(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('nema', api)
export type NemaApi = typeof api
