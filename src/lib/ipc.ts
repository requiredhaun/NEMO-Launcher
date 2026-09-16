export async function call<T = any>(channel: string, payload?: unknown): Promise<T> {
  const res = await window.nema.call(channel, payload)
  if (!res.ok) {
    const e: any = new Error(res.error || 'IPC error')
    if (res.cancelled) e.cancelled = true
    throw e
  }
  return res.data as T
}
