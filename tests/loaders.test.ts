import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/nemo-test' } }))

import { neoPrefix, matchInstalledVersion } from '../electron/versions'
import { findGamePids } from '../electron/launcher'

describe('neoPrefix: MC -> NeoForge prefix', () => {
  it('old scheme 1.21.1 -> 21.1.', () => expect(neoPrefix('1.21.1')).toBe('21.1.'))
  it('old scheme 1.21 -> 21.0.', () => expect(neoPrefix('1.21')).toBe('21.0.'))
  it('old scheme 1.20.4 -> 20.4.', () => expect(neoPrefix('1.20.4')).toBe('20.4.'))
  it('new scheme 26.2 -> 26.2.', () => expect(neoPrefix('26.2')).toBe('26.2.'))
  it('new scheme 26.1.2 -> 26.1.', () => expect(neoPrefix('26.1.2')).toBe('26.1.'))
  it('does not confuse 21.1 with 21.10', () => {
    expect('21.10.3'.startsWith(neoPrefix('1.21.1'))).toBe(false)
    expect('21.1.250'.startsWith(neoPrefix('1.21.1'))).toBe(true)
  })
})

describe('matchInstalledVersion', () => {
  it('finds neoforge dir by mc+build', () => {
    const dirs = ['1.21.1', '1.21.1-neoforge-21.1.250', 'fabric-loader-0.16.14-1.21.1']
    expect(matchInstalledVersion(dirs, '1.21.1', '21.1.250')).toBe('1.21.1-neoforge-21.1.250')
  })
  it('finds forge dir by mc+build, not just any forge', () => {
    const dirs = ['1.20.1-forge-47.2.0', '1.20.1-forge-47.4.0']
    expect(matchInstalledVersion(dirs, '1.20.1', '1.20.1-47.4.0')).toBe('1.20.1-forge-47.4.0')
  })
  it('finds neoforge dir without mc prefix', () => {
    const dirs = ['1.21.1', 'neoforge-21.1.250']
    expect(matchInstalledVersion(dirs, '1.21.1', '21.1.250')).toBe('neoforge-21.1.250')
  })
  it('returns null when nothing matches', () => {
    expect(matchInstalledVersion(['1.21.1'], '1.21.1', '21.1.250')).toBeNull()
  })
})

describe('findGamePids', () => {
  const dir = 'C:\\Users\\k\\AppData\\nema-launcher\\instances\\abc123'
  it('matches only java whose cmdline contains the instance dir', () => {
    const procs = [
      { pid: 11, cmd: `"C:\\Java\\bin\\java.exe" -Djava.library.path=${dir}\\natives --gameDir "${dir}"` },
      { pid: 22, cmd: `"C:\\Java\\bin\\java.exe" -jar installer.jar --installClient C:\\other` },
      { pid: 33, cmd: 'code.exe --unity-launch' },
    ]
    expect(findGamePids(procs, dir)).toEqual([11])
  })
  it('is case-insensitive and skips bad pids', () => {
    const procs = [
      { pid: 0, cmd: dir.toUpperCase() },
      { pid: -5, cmd: dir },
      { pid: 44, cmd: '' },
    ]
    expect(findGamePids(procs, dir)).toEqual([])
  })
})
