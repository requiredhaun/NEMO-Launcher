export async function call<T = any>(channel: string, payload?: unknown): Promise<T> {
  const res = await window.nema.call(channel, payload)
  if (!res.ok) throw new Error(res.error || 'IPC error')
  return res.data as T
}
