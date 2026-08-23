import { CORPUS_RECIPES } from '../data/corpus'
import type { CraftSource, GeneratedMaterial, Material, Recipe, SavedGame } from '../types'

export const STORAGE_KEY = 'vectorcraft:game:v2'
export const LEGACY_STORAGE_KEY = 'vectorcraft:game:v1'
export const ENGINE_VERSION = 'vectorcraft-deterministic-v2'

function baseMaterial(id: string, name: string, emoji: string, description: string, discoveredAt: number): Material {
  return { id, name, emoji, description, discoveredAt, lastCraftedAt: discoveredAt, craftCount: 0, generation: 0, source: 'corpus' }
}

export const BASE_MATERIALS: Material[] = [
  baseMaterial('water', 'Water', '💧', 'The fluid beginning of every world.', 1),
  baseMaterial('fire', 'Fire', '🔥', 'Heat, light, and restless transformation.', 2),
  baseMaterial('earth', 'Earth', '🌍', 'Matter, ground, and patient structure.', 3),
  baseMaterial('air', 'Air', '💨', 'Motion, breath, and invisible possibility.', 4),
  baseMaterial('dna', 'DNA', '🧬', 'A compact blueprint for living systems.', 5),
]

export function pairKey(first: string, second: string): string {
  return [first.trim().toLowerCase(), second.trim().toLowerCase()].sort().join('::')
}

export function stableHash(value: string): string {
  let hash = 2166136261
  for (const char of value.normalize('NFKC')) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function materialId(name: string): string {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'discovery'}-${stableHash(name.toLowerCase())}`
}

export function recipeId(key: string): string {
  return `recipe-${stableHash(key)}`
}

export function initialGame(): SavedGame {
  return {
    version: 2,
    materials: BASE_MATERIALS.map((material) => ({ ...material })),
    recipes: [],
    craftCount: 0,
    favorites: [],
    workspace: [],
    achievements: [],
    completedChallenges: [],
    settings: { sound: true, haptics: true, contributionAcknowledged: false, clanTag: '' },
  }
}

function normalizedMaterial(value: Partial<Material>, index: number): Material | null {
  if (!value.name || !value.emoji || !value.description) return null
  const discoveredAt = Number.isFinite(value.discoveredAt) ? Number(value.discoveredAt) : Date.now() + index
  return {
    id: value.id || materialId(value.name),
    name: String(value.name).slice(0, 48),
    emoji: String(value.emoji).slice(0, 16),
    description: String(value.description).slice(0, 180),
    discoveredAt,
    lastCraftedAt: Number.isFinite(value.lastCraftedAt) ? Number(value.lastCraftedAt) : discoveredAt,
    craftCount: Number.isFinite(value.craftCount) ? Math.max(0, Number(value.craftCount)) : 0,
    generation: Number.isFinite(value.generation) ? Math.max(0, Number(value.generation)) : value.parents ? 1 : 0,
    parents: Array.isArray(value.parents) && value.parents.length === 2 ? [String(value.parents[0]), String(value.parents[1])] : undefined,
    source: value.source === 'local-ai' || value.source === 'local-fallback' || value.source === 'collapsed' ? value.source : 'corpus',
  }
}

function migrateV1(parsed: Record<string, unknown>): SavedGame {
  const materials = (Array.isArray(parsed.materials) ? parsed.materials : []).map((item, index) => normalizedMaterial(item as Partial<Material>, index)).filter((item): item is Material => Boolean(item))
  const materialMap = new Map(materials.map((material) => [material.id, material]))
  const recipes = (Array.isArray(parsed.recipes) ? parsed.recipes : []).flatMap((item) => {
    const old = item as Partial<Recipe>
    if (!old.key || !Array.isArray(old.inputs) || old.inputs.length !== 2 || !old.outputId || !materialMap.has(old.outputId)) return []
    const craftedAt = Number.isFinite(old.craftedAt) ? Number(old.craftedAt) : Date.now()
    const source: CraftSource = old.source === 'local-ai' || old.source === 'local-fallback' ? old.source : 'corpus'
    return [{ id: recipeId(old.key), key: old.key, inputs: [String(old.inputs[0]), String(old.inputs[1])] as [string, string], outputId: old.outputId, source, craftedAt, lastCraftedAt: craftedAt, craftCount: 1 }]
  })
  return { ...initialGame(), materials: materials.length ? materials : BASE_MATERIALS.map((item) => ({ ...item })), recipes, craftCount: Number(parsed.craftCount) || 0 }
}

export function loadGame(raw: string | null, legacyRaw: string | null = null): SavedGame {
  const value = raw ?? legacyRaw
  if (!value) return initialGame()
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (parsed.version === 1) return migrateV1(parsed)
    if (parsed.version !== 2 || !Array.isArray(parsed.materials) || !Array.isArray(parsed.recipes)) return initialGame()
    const materials = parsed.materials.map((item, index) => normalizedMaterial(item as Partial<Material>, index)).filter((item): item is Material => Boolean(item))
    const ids = new Set(materials.map((material) => material.id))
    const recipes = parsed.recipes.flatMap((item) => {
      const recipe = item as Partial<Recipe>
      if (!recipe.key || !recipe.outputId || !Array.isArray(recipe.inputs) || recipe.inputs.length !== 2 || !ids.has(recipe.outputId)) return []
      const craftedAt = Number(recipe.craftedAt) || Date.now()
      const source: CraftSource = recipe.source === 'local-ai' || recipe.source === 'local-fallback' || recipe.source === 'collapsed' ? recipe.source : 'corpus'
      return [{ id: recipe.id || recipeId(recipe.key), key: recipe.key, inputs: [String(recipe.inputs[0]), String(recipe.inputs[1])] as [string, string], outputId: recipe.outputId, source, craftedAt, lastCraftedAt: Number(recipe.lastCraftedAt) || craftedAt, craftCount: Math.max(1, Number(recipe.craftCount) || 1), similarity: Number.isFinite(recipe.similarity) ? Number(recipe.similarity) : undefined, modelProfile: typeof recipe.modelProfile === 'string' ? recipe.modelProfile : undefined }]
    })
    const settings = typeof parsed.settings === 'object' && parsed.settings ? parsed.settings as Record<string, unknown> : {}
    return {
      version: 2,
      materials: materials.length ? materials : BASE_MATERIALS.map((item) => ({ ...item })),
      recipes,
      craftCount: Math.max(0, Number(parsed.craftCount) || 0),
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.map(String).filter((id) => ids.has(id)) : [],
      workspace: Array.isArray(parsed.workspace) ? parsed.workspace.flatMap((item) => {
        const entry = item as Record<string, unknown>
        return typeof entry.id === 'string' && typeof entry.materialId === 'string' && ids.has(entry.materialId) ? [{ id: entry.id, materialId: entry.materialId, x: Math.max(4, Math.min(92, Number(entry.x) || 10)), y: Math.max(6, Math.min(88, Number(entry.y) || 10)) }] : []
      }) : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements.map(String).slice(0, 100) : [],
      completedChallenges: Array.isArray(parsed.completedChallenges) ? parsed.completedChallenges.flatMap((item) => {
        const entry = item as Record<string, unknown>
        return typeof entry.id === 'string' && typeof entry.recipeKey === 'string' ? [{ id: entry.id, recipeKey: entry.recipeKey, completedAt: Number(entry.completedAt) || Date.now() }] : []
      }) : [],
      settings: { sound: settings.sound !== false, haptics: settings.haptics !== false, contributionAcknowledged: settings.contributionAcknowledged === true, clanTag: typeof settings.clanTag === 'string' ? settings.clanTag.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 24) : '' },
    }
  } catch {
    return initialGame()
  }
}

export function mergeGames(current: SavedGame, incoming: SavedGame): SavedGame {
  return {
    ...current,
    materials: [...new Map([...current.materials, ...incoming.materials].map((item) => [item.id, item])).values()],
    recipes: [...new Map([...incoming.recipes, ...current.recipes].map((item) => [item.key, item])).values()],
    craftCount: Math.max(current.craftCount, incoming.craftCount),
    favorites: [...new Set([...current.favorites, ...incoming.favorites])],
    achievements: [...new Set([...current.achievements, ...incoming.achievements])],
    completedChallenges: [...new Map([...current.completedChallenges, ...incoming.completedChallenges].map((item) => [item.id, item])).values()],
  }
}

export function findRecipe(recipes: Recipe[], first: Material, second: Material): Recipe | undefined {
  return recipes.find((recipe) => recipe.key === pairKey(first.name, second.name))
}

export function getCorpusRecipe(first: Material, second: Material): GeneratedMaterial | undefined {
  const key = pairKey(first.name, second.name)
  const recipe = CORPUS_RECIPES.find((item) => pairKey(item.inputs[0], item.inputs[1]) === key)
  return recipe ? { name: recipe.name, emoji: recipe.emoji, description: recipe.description } : undefined
}

export function recipesForMaterial(recipes: Recipe[], materialIdValue: string): Recipe[] {
  return recipes.filter((recipe) => recipe.outputId === materialIdValue).sort((a, b) => a.craftedAt - b.craftedAt)
}

export function usesForMaterial(recipes: Recipe[], materialIdValue: string): Recipe[] {
  return recipes.filter((recipe) => recipe.inputs.includes(materialIdValue)).sort((a, b) => b.lastCraftedAt - a.lastCraftedAt)
}

function titleCase(value: string): string {
  return value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').split(' ').slice(0, 4).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ')
}

function firstEmoji(value: string): string | null {
  return value.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u)?.[0] ?? null
}

export function parseGeneratedMaterial(raw: string): GeneratedMaterial | null {
  const boilerplate = /\b(?:the following|this is|great example|short description|relevant information|input and output|output format|the output|name and emoji|combining different|innovative ideas|as an ai)\b/i
  const objectMatch = raw.match(/\{[\s\S]*\}/)
  let candidate: Record<string, unknown> | null = null
  if (objectMatch) try { candidate = JSON.parse(objectMatch[0]) as Record<string, unknown> } catch { candidate = null }
  const rawName = typeof candidate?.name === 'string' ? candidate.name : raw.match(/(?:name|item)\s*[:=-]\s*["']?([^\n,"'}]+)/i)?.[1]
  const rawEmoji = typeof candidate?.emoji === 'string' ? candidate.emoji : raw.match(/(?:emoji|icon)\s*[:=-]\s*["']?([^\n,"'}]+)/i)?.[1]
  const rawDescription = typeof candidate?.description === 'string' ? candidate.description : raw.match(/description\s*[:=-]\s*["']?([^\n"'}]+)/i)?.[1]
  const pipeParts = raw.split('\n').map((line) => line.replace(/^(?:OUTPUT|ANSWER)\s*:\s*/i, '').trim()).find((line) => line.split('|').length >= 3)?.split('|').map((part) => part.trim())
  const resolvedName = rawName ?? pipeParts?.[0]
  if (!resolvedName) return null
  const name = titleCase(resolvedName).replace(/[^\p{L}\p{N} '&-]/gu, '').trim()
  if (name.length < 2 || name.length > 36 || boilerplate.test(name) || /^(?:name|item|input|output|answer|result)$/i.test(name) || /^(?:the|this|that|it|there|here)\b/i.test(name) || /\b(?:is|are|was|were)\b/i.test(name)) return null
  return { name, emoji: firstEmoji(rawEmoji ?? pipeParts?.[1] ?? raw) ?? '✨', description: (rawDescription ?? pipeParts?.slice(2).join(' | '))?.trim().replace(/^["']|["']$/g, '').slice(0, 140) || 'A new form crafted from unexpected forces.' }
}

export function fallbackMaterial(first: Material, second: Material): GeneratedMaterial {
  const forms = ['Bloom', 'Core', 'Echo', 'Engine', 'Field', 'Forge', 'Nexus', 'Shard']
  const emojis = ['✨', '💠', '🔮', '🌀', '🧿', '⚙️', '🌟', '🔷']
  const hash = Number.parseInt(stableHash(pairKey(first.name, second.name)), 36)
  const [left, right] = [first.name, second.name].sort((a, b) => a.localeCompare(b))
  const lead = left.length <= right.length ? left : right
  return { name: `${lead} ${forms[hash % forms.length]}`, emoji: emojis[hash % emojis.length], description: `A deterministic local fusion of ${left} and ${right}.` }
}

export function modelAssistedMaterial(modelSignal: string, first: Material, second: Material): GeneratedMaterial | null {
  if (!modelSignal.trim()) return null
  const forms = ['Aurora', 'Bloom', 'Catalyst', 'Cipher', 'Core', 'Echo', 'Engine', 'Flux', 'Garden', 'Halo', 'Nexus', 'Prism', 'Pulse', 'Reactor', 'Shard', 'Spark']
  const emojis = ['🌌', '🌱', '⚗️', '🔹', '💠', '🔮', '⚙️', '🌀', '🌻', '💫', '🧿', '🔷', '💓', '☢️', '✨', '⚡']
  const hash = Number.parseInt(stableHash(pairKey(first.name, second.name)), 36)
  const [left, right] = [first.name, second.name].sort((a, b) => a.localeCompare(b))
  const lead = hash % 2 === 0 ? left : right
  return { name: `${lead} ${forms[hash % forms.length]}`, emoji: emojis[(hash >>> 4) % emojis.length], description: `An on-device AI interpretation of ${left} and ${right}.` }
}

export function achievementsFor(game: SavedGame): string[] {
  const earned: string[] = []
  if (game.craftCount >= 1) earned.push('first-spark')
  if (game.materials.length >= 10) earned.push('world-builder')
  if (game.materials.some((item) => item.generation >= 5)) earned.push('deep-chain')
  if (game.recipes.some((item) => item.source === 'local-ai')) earned.push('local-mind')
  if (game.favorites.length >= 3) earned.push('curator')
  if (game.completedChallenges.length >= 1) earned.push('daily-ritual')
  return earned
}

export function dailyChallenge(date = new Date()): { id: string; recipeKey: string; first: string; second: string; target: string; emoji: string } {
  const day = date.toISOString().slice(0, 10)
  const originRecipes = CORPUS_RECIPES.slice(0, 12)
  const selected = originRecipes[Number.parseInt(stableHash(day), 36) % originRecipes.length]
  return { id: `daily-${day}`, recipeKey: pairKey(selected.inputs[0], selected.inputs[1]), first: selected.inputs[0], second: selected.inputs[1], target: selected.name, emoji: selected.emoji }
}
