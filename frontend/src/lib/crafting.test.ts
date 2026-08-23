import { describe, expect, it } from 'vitest'
import type { SavedGame } from '../types'
import {
  BASE_MATERIALS,
  achievementsFor,
  dailyChallenge,
  fallbackMaterial,
  getCorpusRecipe,
  initialGame,
  loadGame,
  materialId,
  mergeGames,
  modelAssistedMaterial,
  pairKey,
  parseGeneratedMaterial,
  recipeId,
  stableHash,
} from './crafting'

describe('crafting domain', () => {
  it('uses order-independent recipe keys and stable identifiers', () => {
    expect(pairKey('Fire', 'Water')).toBe('fire::water')
    expect(pairKey('Water', 'Fire')).toBe('fire::water')
    expect(stableHash('fire::water')).toBe(stableHash('fire::water'))
    expect(materialId('Glass Forest')).toBe(materialId('Glass Forest'))
    expect(recipeId(pairKey('Fire', 'Water'))).toBe(recipeId(pairKey('Water', 'Fire')))
  })

  it('provides instant deterministic corpus discoveries', () => {
    const water = BASE_MATERIALS[0]
    const fire = BASE_MATERIALS[1]
    expect(getCorpusRecipe(water, fire)).toMatchObject({ name: 'Steam', emoji: '♨️' })
    expect(getCorpusRecipe(fire, water)).toEqual(getCorpusRecipe(water, fire))
  })

  it('parses strict and lightly malformed model output', () => {
    expect(parseGeneratedMaterial('{"name":"glass forest","emoji":"🌲","description":"Crystal trees."}'))
      .toEqual({ name: 'Glass Forest', emoji: '🌲', description: 'Crystal trees.' })
    expect(parseGeneratedMaterial('name: moon bridge\nemoji: 🌉\ndescription: a silver crossing'))
      .toEqual({ name: 'Moon Bridge', emoji: '🌉', description: 'a silver crossing' })
    expect(parseGeneratedMaterial('OUTPUT: sky garden | 🌻 | Flowers carried by the wind.'))
      .toEqual({ name: 'Sky Garden', emoji: '🌻', description: 'Flowers carried by the wind.' })
  })

  it('fails closed on unusable model output', () => {
    expect(parseGeneratedMaterial('I cannot answer that.')).toBeNull()
    expect(parseGeneratedMaterial('The following is a short description that summarizes the input and output.')).toBeNull()
    expect(parseGeneratedMaterial('NAME | EMOJI | SHORT DESCRIPTION')).toBeNull()
    expect(parseGeneratedMaterial('INPUT | ✨ | Fire + Water')).toBeNull()
    expect(parseGeneratedMaterial('The Fire Is The | ✨ | Sentence fragment')).toBeNull()
  })

  it('creates order-independent deterministic local outputs', () => {
    const first = BASE_MATERIALS[0]
    const second = BASE_MATERIALS[4]
    expect(fallbackMaterial(first, second)).toEqual(fallbackMaterial(second, first))
    expect(modelAssistedMaterial('completion A', first, second)).toEqual(modelAssistedMaterial('completion B', first, second))
    expect(modelAssistedMaterial('completion A', first, second)).toEqual(modelAssistedMaterial('completion A', second, first))
    expect(modelAssistedMaterial('', first, second)).toBeNull()
  })

  it('migrates v1 progress and recovers safely from corrupt progress', () => {
    const legacy = JSON.stringify({
      version: 1,
      materials: [...BASE_MATERIALS, { id: 'steam', name: 'Steam', emoji: '♨️', description: 'Vapor.', discoveredAt: 20, parents: ['water', 'fire'], source: 'seed' }],
      recipes: [{ key: 'fire::water', inputs: ['fire', 'water'], outputId: 'steam', source: 'seed', craftedAt: 20 }],
      craftCount: 1,
    })
    const migrated = loadGame(null, legacy)
    expect(migrated.version).toBe(2)
    expect(migrated.materials.find((item) => item.id === 'steam')).toMatchObject({ generation: 1, source: 'corpus' })
    expect(migrated.recipes[0]).toMatchObject({ id: recipeId('fire::water'), craftCount: 1, source: 'corpus' })
    expect(loadGame('{broken')).toEqual(initialGame())
  })

  it('merges worlds without duplicating identities or recipe keys', () => {
    const current = initialGame()
    const incoming: SavedGame = { ...initialGame(), craftCount: 3, favorites: ['fire'], achievements: ['first-spark'] }
    const merged = mergeGames(current, incoming)
    expect(merged.materials).toHaveLength(BASE_MATERIALS.length)
    expect(merged.craftCount).toBe(3)
    expect(merged.favorites).toEqual(['fire'])
  })

  it('keeps daily challenges deterministic by UTC date', () => {
    const date = new Date('2026-08-23T12:00:00Z')
    expect(dailyChallenge(date)).toEqual(dailyChallenge(date))
    expect(dailyChallenge(date).id).toBe('daily-2026-08-23')
  })

  it('awards progression achievements from saved state', () => {
    const game: SavedGame = { ...initialGame(), craftCount: 1, favorites: ['water', 'fire', 'earth'] }
    expect(achievementsFor(game)).toEqual(expect.arrayContaining(['first-spark', 'curator']))
  })
})
