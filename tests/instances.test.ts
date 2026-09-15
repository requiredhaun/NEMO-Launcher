import { describe, it, expect } from 'vitest'
import { instanceDir } from '../electron/instances'

describe('instances', () => {
  it('builds per-instance dir under userData', () => {
    expect(instanceDir('C:/ud', 'abc').replace(/\\/g, '/')).toBe('C:/ud/instances/abc')
  })
})
