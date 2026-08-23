import { describe, expect, it } from 'vitest'
import { selectRuntimeProfile } from './runtime'

describe('local AI runtime selection', () => {
  it('uses the portable single-threaded WASM profile on iPhone Safari', () => {
    const profile = selectRuntimeProfile(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1',
      true,
    )
    expect(profile).toMatchObject({ device: 'wasm', generatorDtype: 'q8', singleThreadedWasm: true })
    expect(profile.generatorModel).toContain('135M')
  })

  it('uses WebGPU only for a secure supported Chromium runtime', () => {
    const profile = selectRuntimeProfile(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
      true,
    )
    expect(profile).toMatchObject({ device: 'webgpu', generatorDtype: 'q4f16' })
    expect(profile.generatorModel).toContain('360M')
  })

  it('falls back to the portable model when WebGPU is unavailable', () => {
    expect(selectRuntimeProfile('Mozilla/5.0 Firefox/142.0', false).device).toBe('wasm')
  })
})
