import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { createInstance, listInstances, readInstance, instanceDir } from '../electron/instances'

describe('instances roundtrip', () => {
  it('create -> read -> list agree on one meta location', () => {
    const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'nema-test-'))
    const inst = createInstance(ud, 'Test', '1.21.11')
    expect(inst.gameDir).toBe(instanceDir(ud, inst.id))
    expect(readInstance(inst.gameDir)).toMatchObject({ id: inst.id, name: 'Test' })
    expect(listInstances(ud).map((i) => i.id)).toContain(inst.id)
    fs.rmSync(ud, { recursive: true, force: true })
  })
})
