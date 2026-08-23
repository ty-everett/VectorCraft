export type CraftSource = 'seed' | 'local-ai' | 'local-fallback'

export interface Material {
  id: string
  name: string
  emoji: string
  description: string
  discoveredAt: number
  parents?: [string, string]
  source: CraftSource
}

export interface Recipe {
  key: string
  inputs: [string, string]
  outputId: string
  source: CraftSource
  craftedAt: number
}

export interface SavedGame {
  version: 1
  materials: Material[]
  recipes: Recipe[]
  craftCount: number
}

export interface GeneratedMaterial {
  name: string
  emoji: string
  description: string
}

export type AiPhase = 'idle' | 'loading' | 'ready' | 'working' | 'error'

export interface AiStatus {
  phase: AiPhase
  task: 'generator' | 'embeddings' | null
  label: string
  progress: number | null
  device: 'webgpu' | 'wasm' | null
  profile: 'desktop-webgpu' | 'portable-wasm' | null
  modelLabel: string | null
  modelSize: string | null
}
