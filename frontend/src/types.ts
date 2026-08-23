export type CraftSource = 'corpus' | 'local-ai' | 'local-fallback' | 'collapsed'

export interface Material {
  id: string
  name: string
  emoji: string
  description: string
  discoveredAt: number
  lastCraftedAt: number
  craftCount: number
  generation: number
  parents?: [string, string]
  source: CraftSource
}

export interface Recipe {
  id: string
  key: string
  inputs: [string, string]
  outputId: string
  source: CraftSource
  craftedAt: number
  lastCraftedAt: number
  craftCount: number
  similarity?: number
  modelProfile?: string
}

export interface WorkspaceItem {
  id: string
  materialId: string
  x: number
  y: number
}

export interface GameSettings {
  sound: boolean
  haptics: boolean
  contributionAcknowledged: boolean
  clanTag: string
}

export interface CompletedChallenge {
  id: string
  completedAt: number
  recipeKey: string
}

export interface SavedGame {
  version: 2
  materials: Material[]
  recipes: Recipe[]
  craftCount: number
  favorites: string[]
  workspace: WorkspaceItem[]
  achievements: string[]
  completedChallenges: CompletedChallenge[]
  settings: GameSettings
}

export interface GeneratedMaterial {
  name: string
  emoji: string
  description: string
}

export interface SimilarMaterial {
  id: string
  score: number
}

export interface RecipeContribution {
  schemaVersion: 1
  engineVersion: string
  recipeId: string
  recipeKey: string
  inputs: Array<{ name: string; emoji: string }>
  output: { name: string; emoji: string; description: string }
  source: CraftSource
  outcome: 'new' | 'collapsed' | 'recalled'
  collapsedInto?: string
  similarity?: number
  generation: number
  modelProfile?: string
  challengeId?: string
  clanTag?: string
  craftedAt: string
}

export interface SignedRecipePacket {
  type: 'vectorcraft.recipe.v1'
  payload: RecipeContribution
  signer: { algorithm: 'ECDSA-P256-SHA256'; publicKey: JsonWebKey }
  signature: string
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
