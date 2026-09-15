import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/nemo-test' } }))

import { ensureLauncherProfile } from '../electron/versions'

describe('ensureLauncherProfile', () => {
  it('creates minimal profile in empty dir', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-prof-'))
    ensureLauncherProfile(dir)
    const raw = fs.readFileSync(path.join(dir, 'launcher_profiles.json'), 'utf-8')
    expect(JSON.parse(raw).profiles).toBeDefined()
    fs.rmSync(dir, { recursive: true, force: true })
  })
  it('does not overwrite existing profile', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-prof-'))
    fs.writeFileSync(path.join(dir, 'launcher_profiles.json'), '{"profiles":{"mine":{}}}')
    ensureLauncherProfile(dir)
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'launcher_profiles.json'), 'utf-8')).profiles).toEqual({ mine: {} })
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
