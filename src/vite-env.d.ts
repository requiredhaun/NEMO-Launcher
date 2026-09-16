/// <reference types="vite/client" />
declare global {
  const __APP_VERSION__: string
  interface Window {
    nema: {
      call: (channel: string, payload?: unknown) => Promise<{ ok: boolean; data?: any; error?: string; cancelled?: boolean }>
      on: (channel: string, cb: (data: any) => void) => () => void
    }
  }
}
export {}
