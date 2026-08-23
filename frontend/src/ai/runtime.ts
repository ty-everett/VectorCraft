export interface RuntimeProfile {
  device: 'webgpu' | 'wasm'
  generatorModel: string
  generatorLabel: string
  generatorDtype: 'q4f16' | 'q8'
  generatorSize: string
  singleThreadedWasm: boolean
  profile: 'desktop-webgpu' | 'portable-wasm'
}

const DESKTOP_MODEL = 'HuggingFaceTB/SmolLM2-360M-Instruct'
const PORTABLE_MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct'

export function isAppleWebKit(userAgent: string): boolean {
  if (!/AppleWebKit/i.test(userAgent)) return false
  if (/(?:iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS)/i.test(userAgent)) return true
  return /Safari/i.test(userAgent) && !/(?:Chrome|Chromium|Edg)\//i.test(userAgent)
}

export function selectRuntimeProfile(
  userAgent: string,
  hasGpu: boolean,
  secureContext = true,
): RuntimeProfile {
  const chromium = /(?:Chrome|Chromium|Edg)\//i.test(userAgent) && !/(?:CriOS|EdgiOS)/i.test(userAgent)
  const useWebGpu = secureContext && hasGpu && chromium && !isAppleWebKit(userAgent)

  if (useWebGpu) {
    return {
      device: 'webgpu',
      generatorModel: DESKTOP_MODEL,
      generatorLabel: 'SmolLM2 360M Instruct',
      generatorDtype: 'q4f16',
      generatorSize: '~272 MB',
      singleThreadedWasm: false,
      profile: 'desktop-webgpu',
    }
  }

  return {
    device: 'wasm',
    generatorModel: PORTABLE_MODEL,
    generatorLabel: 'SmolLM2 135M Instruct',
    generatorDtype: 'q8',
    generatorSize: '~137 MB',
    singleThreadedWasm: isAppleWebKit(userAgent),
    profile: 'portable-wasm',
  }
}
