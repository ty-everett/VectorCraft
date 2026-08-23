import type { GeneratedMaterial, Material, Recipe, SavedGame } from '../types'

export const STORAGE_KEY = 'vectorcraft:game:v1'

export const BASE_MATERIALS: Material[] = [
  { id: 'water', name: 'Water', emoji: '💧', description: 'The fluid beginning of every world.', discoveredAt: 1, source: 'seed' },
  { id: 'fire', name: 'Fire', emoji: '🔥', description: 'Heat, light, and restless transformation.', discoveredAt: 2, source: 'seed' },
  { id: 'earth', name: 'Earth', emoji: '🌍', description: 'Matter, ground, and patient structure.', discoveredAt: 3, source: 'seed' },
  { id: 'air', name: 'Air', emoji: '💨', description: 'Motion, breath, and invisible possibility.', discoveredAt: 4, source: 'seed' },
  { id: 'dna', name: 'DNA', emoji: '🧬', description: 'A compact blueprint for living systems.', discoveredAt: 5, source: 'seed' },
]

interface SeedRecipe extends GeneratedMaterial {
  description: string
}

export const SEED_RECIPES: Record<string, SeedRecipe> = {
  'air::air': { name: 'Wind', emoji: '🌬️', description: 'Air in purposeful motion.' },
  'air::earth': { name: 'Dust', emoji: '🌫️', description: 'Earth made light enough to travel.' },
  'air::fire': { name: 'Energy', emoji: '⚡', description: 'Fire carried forward by motion.' },
  'air::water': { name: 'Cloud', emoji: '☁️', description: 'Water suspended in the sky.' },
  'dna::earth': { name: 'Life', emoji: '🌱', description: 'A living pattern rooted in matter.' },
  'dna::water': { name: 'Cell', emoji: '🦠', description: 'A tiny vessel where biology begins.' },
  'earth::earth': { name: 'Mountain', emoji: '⛰️', description: 'Earth gathered into a monumental form.' },
  'earth::fire': { name: 'Lava', emoji: '🌋', description: 'Earth made molten by fire.' },
  'earth::water': { name: 'Mud', emoji: '🟤', description: 'Earth softened and shaped by water.' },
  'fire::fire': { name: 'Sun', emoji: '☀️', description: 'Fire intense enough to become a star.' },
  'fire::water': { name: 'Steam', emoji: '♨️', description: 'Water transformed into rising vapor.' },
  'water::water': { name: 'Ocean', emoji: '🌊', description: 'Water multiplied beyond the horizon.' },
}

export function pairKey(first: string, second: string): string {
  return [first.trim().toLowerCase(), second.trim().toLowerCase()].sort().join('::')
}

export function materialId(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `discovery-${Date.now()}`
}

export function initialGame(): SavedGame {
  return {
    version: 1,
    materials: BASE_MATERIALS.map((material) => ({ ...material })),
    recipes: [],
    craftCount: 0,
  }
}

export function loadGame(raw: string | null): SavedGame {
  if (!raw) return initialGame()
  try {
    const parsed = JSON.parse(raw) as Partial<SavedGame>
    if (parsed.version !== 1 || !Array.isArray(parsed.materials) || !Array.isArray(parsed.recipes)) {
      return initialGame()
    }
    return {
      version: 1,
      materials: parsed.materials,
      recipes: parsed.recipes,
      craftCount: Number.isFinite(parsed.craftCount) ? Number(parsed.craftCount) : 0,
    }
  } catch {
    return initialGame()
  }
}

export function findRecipe(recipes: Recipe[], first: Material, second: Material): Recipe | undefined {
  const key = pairKey(first.name, second.name)
  return recipes.find((recipe) => recipe.key === key)
}

export function getSeedRecipe(first: Material, second: Material): GeneratedMaterial | undefined {
  return SEED_RECIPES[pairKey(first.name, second.name)]
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .slice(0, 4)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function firstEmoji(value: string): string | null {
  const match = value.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u)
  return match?.[0] ?? null
}

export function parseGeneratedMaterial(raw: string): GeneratedMaterial | null {
  const objectMatch = raw.match(/\{[\s\S]*\}/)
  let candidate: Record<string, unknown> | null = null
  if (objectMatch) {
    try {
      candidate = JSON.parse(objectMatch[0]) as Record<string, unknown>
    } catch {
      candidate = null
    }
  }

  const rawName = typeof candidate?.name === 'string'
    ? candidate.name
    : raw.match(/(?:name|item)\s*[:=-]\s*["']?([^\n,"'}]+)/i)?.[1]
  const rawEmoji = typeof candidate?.emoji === 'string'
    ? candidate.emoji
    : raw.match(/(?:emoji|icon)\s*[:=-]\s*["']?([^\n,"'}]+)/i)?.[1]
  const rawDescription = typeof candidate?.description === 'string'
    ? candidate.description
    : raw.match(/description\s*[:=-]\s*["']?([^\n"'}]+)/i)?.[1]

  if (!rawName) return null
  const name = titleCase(rawName).replace(/[^\p{L}\p{N} '&-]/gu, '').trim()
  if (name.length < 2 || name.length > 36) return null

  return {
    name,
    emoji: firstEmoji(rawEmoji ?? raw) ?? '✨',
    description: (rawDescription?.trim().replace(/^['"]|['"]$/g, '').slice(0, 110)) || 'A new form crafted from unexpected forces.',
  }
}

export function fallbackMaterial(first: Material, second: Material): GeneratedMaterial {
  const forms = ['Bloom', 'Core', 'Echo', 'Engine', 'Field', 'Forge', 'Nexus', 'Shard']
  const emojis = ['✨', '💠', '🔮', '🌀', '🧿', '⚙️', '🌟', '🔷']
  const hash = [...pairKey(first.name, second.name)].reduce((total, char) => total + char.charCodeAt(0), 0)
  const [left, right] = [first.name, second.name].sort((a, b) => a.localeCompare(b))
  const lead = left.length <= right.length ? left : right
  const form = forms[hash % forms.length]
  return {
    name: `${lead} ${form}`,
    emoji: emojis[hash % emojis.length],
    description: `A locally synthesized fusion of ${left} and ${right}.`,
  }
}

export function uniqueMaterial(candidate: GeneratedMaterial, materials: Material[]): GeneratedMaterial {
  const names = new Set(materials.map((material) => material.name.toLowerCase()))
  if (!names.has(candidate.name.toLowerCase())) return candidate
  let index = 2
  while (names.has(`${candidate.name} ${index}`.toLowerCase())) index += 1
  return { ...candidate, name: `${candidate.name} ${index}` }
}
