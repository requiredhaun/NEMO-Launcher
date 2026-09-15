import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Безопасная распаковка .mrpack: защита от Zip-Slip + проверка sha512/sha1 из индекса.
 * Все dest обязаны лежать строго внутри gameDir, иначе — throw.
 */

export function safeDest(gameDir: string, rel: string): string {
  const normalized = path.normalize(path.join(gameDir, ...rel.split('/')))
  const root = path.normalize(gameDir + path.sep)
  if (normalized !== path.normalize(gameDir) && !normalized.startsWith(root)) {
    throw new Error(`Опасный путь в сборке: ${rel}`)
  }
  return normalized
}

export function verifyHash(buf: Buffer, hashes?: { sha512?: string; sha1?: string }): void {
  if (!hashes || (!hashes.sha512 && !hashes.sha1)) return
  if (hashes.sha512) {
    const h = crypto.createHash('sha512').update(buf).digest('hex')
    if (h !== hashes.sha512.toLowerCase()) throw new Error('sha512 не сошёлся — файл битый или подменён')
    return
  }
  const h = crypto.createHash('sha1').update(buf).digest('hex')
  if (h !== hashes.sha1!.toLowerCase()) throw new Error('sha1 не сошёлся — файл битый или подменён')
}

export interface MrpackFile { path?: string; filename?: string; downloads?: string[]; hashes?: { sha512?: string; sha1?: string }; env?: { client?: string } }

export function planDests(gameDir: string, files: MrpackFile[]): { dest: string; url: string; hashes?: MrpackFile['hashes'] }[] {
  return files
    .filter((f) => !f.env || f.env.client !== 'unsupported')
    .filter((f) => f.downloads?.[0])
    .map((f) => ({ dest: safeDest(gameDir, f.path || f.filename || 'file'), url: f.downloads![0], hashes: f.hashes }))
}

export function writeFileChecked(dest: string, buf: Buffer, hashes?: MrpackFile['hashes']): void {
  verifyHash(buf, hashes)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
}

/** Пул воркеров: качаем в N потоков вместо строгой очереди. */
export async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k], k)
    }
  })
  await Promise.all(workers)
  return out
}
