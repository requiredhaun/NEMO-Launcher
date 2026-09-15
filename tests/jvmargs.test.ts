import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/nemo-test' } }))

import { jvmArgsFromJson } from '../electron/versions'

const CTX = { gameDir: 'C:\\game', versionId: 'neoforge-21.1.250', sep: ';' }

describe('jvmArgsFromJson', () => {
  it('takes module args, drops -cp/classpath (MLC provides them)', () => {
    const json = {
      arguments: {
        jvm: [
          '-Djava.net.preferIPv6Addresses=system',
          '-DlibraryDirectory=${library_directory}',
          '-p',
          'a.jar${classpath_separator}b.jar',
          '--add-modules',
          'ALL-MODULE-PATH',
          '--add-opens',
          'java.base/java.lang.invoke=cpw.mods.securejarhandler',
          '-Djava.library.path=${natives_directory}',
          '-cp',
          '${classpath}',
        ],
      },
    }
    expect(jvmArgsFromJson(json, CTX)).toEqual([
      '-Djava.net.preferIPv6Addresses=system',
      '-DlibraryDirectory=C:\\game\\libraries',
      '-p',
      'a.jar;b.jar',
      '--add-modules',
      'ALL-MODULE-PATH',
      '--add-opens',
      'java.base/java.lang.invoke=cpw.mods.securejarhandler',
      '-Djava.library.path=C:\\game\\natives\\neoforge-21.1.250',
    ])
  })

  it('respects os rules (osx-only dropped on windows)', () => {
    const json = {
      arguments: {
        jvm: [
          { rules: [{ action: 'allow', os: { name: 'osx' } }], value: '-XstartOnFirstThread' },
          { rules: [{ action: 'allow', os: { name: 'windows' } }], value: '-XX:HeapDumpPath=dump' },
          '-Dkeep=yes',
        ],
      },
    }
    expect(jvmArgsFromJson(json, CTX)).toEqual(['-XX:HeapDumpPath=dump', '-Dkeep=yes'])
  })

  it('returns [] when no jvm args', () => {
    expect(jvmArgsFromJson({}, CTX)).toEqual([])
    expect(jvmArgsFromJson({ arguments: {} }, CTX)).toEqual([])
  })
})
