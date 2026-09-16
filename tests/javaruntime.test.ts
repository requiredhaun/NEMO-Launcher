import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

vi.mock('electron', () => ({ app: { getPath: () => path.join(os.tmpdir(), 'nemo-java-test') } }))

import {
  COMPONENT_BY_MAJOR, majorForMc, parseJavaMajor,
  resolveComponents, runtimePlatformKey, ensureJavaRuntime,
} from '../electron/javaRuntime'

describe('COMPONENT_BY_MAJOR matches Mojang version.json declarations', () => {
  it('8 -> jre-legacy (1.16.5, 1.12.2)', () => expect(COMPONENT_BY_MAJOR[8]).toBe('jre-legacy'))
  it('16 -> java-runtime-alpha (1.17.1)', () => expect(COMPONENT_BY_MAJOR[16]).toBe('java-runtime-alpha'))
  it('17 -> java-runtime-gamma, not beta (1.19/1.20)', () => expect(COMPONENT_BY_MAJOR[17]).toBe('java-runtime-gamma'))
  it('21 -> java-runtime-delta, not epsilon (1.21)', () => expect(COMPONENT_BY_MAJOR[21]).toBe('java-runtime-delta'))
})

describe('runtimePlatformKey is Mojang keys, not process.platform', () => {
  it('win32/x64 -> windows-x64', () => expect(runtimePlatformKey('win32', 'x64')).toBe('windows-x64'))
  it('win32/arm64 -> windows-arm64', () => expect(runtimePlatformKey('win32', 'arm64')).toBe('windows-arm64'))
  it('darwin/arm64 -> mac-os-arm64', () => expect(runtimePlatformKey('darwin', 'arm64')).toBe('mac-os-arm64'))
  it('darwin/x64 -> mac-os', () => expect(runtimePlatformKey('darwin', 'x64')).toBe('mac-os'))
  it('linux/x64 -> linux', () => expect(runtimePlatformKey('linux', 'x64')).toBe('linux'))
  it('linux/ia32 -> linux-i386', () => expect(runtimePlatformKey('linux', 'ia32')).toBe('linux-i386'))
  it('unknown platform -> null', () => expect(runtimePlatformKey('sunos', 'x64')).toBeNull())
})

describe('resolveComponents prefers version.json hint', () => {
  it('hint first', () => {
    const cs = resolveComponents(21, 'java-runtime-epsilon')
    expect(cs[0]).toBe('java-runtime-epsilon')
    expect(cs).toContain('java-runtime-delta')
  })
  it('mapping second when no hint', () => {
    expect(resolveComponents(17)[0]).toBe('java-runtime-gamma')
  })
  it('no duplicates', () => {
    const cs = resolveComponents(21, 'java-runtime-delta')
    expect(new Set(cs).size).toBe(cs.length)
  })
})

describe('majorForMc / parseJavaMajor', () => {
  it('1.16 -> 8, 1.17 -> 16, 1.18-1.20 -> 17, 1.21 -> 21', () => {
    expect(majorForMc('1.16.5')).toBe(8)
    expect(majorForMc('1.17.1')).toBe(16)
    expect(majorForMc('1.20.4')).toBe(17)
    expect(majorForMc('1.21.1')).toBe(21)
  })
  it('parseJavaMajor handles legacy 1.8 scheme', () => {
    expect(parseJavaMajor('1.8.0_392')).toBe(8)
    expect(parseJavaMajor('17.0.9')).toBe(17)
    expect(parseJavaMajor('21.0.2')).toBe(21)
  })
})

describe('ensureJavaRuntime downloads via manifest (mocked fetch)', () => {
  const root = path.join(os.tmpdir(), 'nemo-java-test')
  beforeEach(() => { fs.rmSync(root, { recursive: true, force: true }) })

  it('resolves platform key + hint component and lays out files', async () => {
    const platKey = runtimePlatformKey()!
    const fakeRoot = { [platKey]: { 'java-runtime-epsilon': [{ manifest: { url: 'http://t/manifest' } }] } }
    const fakeManifest = { files: { 'bin/java.exe': { type: 'file', downloads: { raw: { url: 'http://t/f' } } } } }
    const payload = Buffer.from('fake-java-binary')
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('all.json')) return { ok: true, json: async () => fakeRoot }
      if (String(url).endsWith('/manifest')) return { ok: true, json: async () => fakeManifest }
      return { ok: true, arrayBuffer: async () => payload }
    }))
    const exe = await ensureJavaRuntime('/unused', 21, undefined, 'java-runtime-epsilon')
    expect(exe.endsWith('java.exe') || exe.endsWith('/java')).toBe(true)
    expect(fs.readFileSync(exe)).toEqual(payload)
    vi.unstubAllGlobals()
  })

  it('throws translated error when platform missing from root', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ 'gamecore': {} }) })))
    await expect(ensureJavaRuntime('/unused', 21)).rejects.toThrow(/Java 21/)
    vi.unstubAllGlobals()
  })
})
