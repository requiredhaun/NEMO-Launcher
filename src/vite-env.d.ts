/// <reference types="vite/client" />
declare global {
  interface Window {
    nema: {
      call: (channel: string, payload?: unknown) => Promise<{ ok: boolean; data?: any; error?: string }>
      on: (channel: string, cb: (data: any) => void) => () => void
    }
  }
}
export {}
