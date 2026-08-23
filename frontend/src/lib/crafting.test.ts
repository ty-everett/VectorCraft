import { describe, expect, it } from 'vitest'
import {
  BASE_MATERIALS,
  fallbackMaterial,
  getSeedRecipe,
  initialGame,
  loadGame,
  pairKey,
  parseGeneratedMaterial,
  uniqueMaterial,
} from './crafting'

describe('crafting domain', () => {
  it('uses order-independent recipe keys', () => {
    expect(pairKey('Fire', 'Water')).toBe('fire::water')
    expect(pairKey('Water', 'Fire')).toBe('fire::water')
  })

  it('provides instant classic discoveries', () => {
    const water = BASE_MATERIALS[0]
    const fire = BASE_MATERIALS[1]
    expect(getSeedRecipe(water, fire)).toMatchObject({ name: 'Steam', emoji: '♨️' })
  })

  it('parses strict and lightly malformed model output', () => {
    expect(parseGeneratedMaterial('{"name":"glass forest","emoji":"🌲","description":"Crystal trees."}'))
      .toEqual({ name: 'Glass Forest', emoji: '🌲', description: 'Crystal trees.' })
    expect(parseGeneratedMaterial('name: moon bridge\nemoji: 🌉\ndescription: a silver crossing'))
      .toEqual({ name: 'Moon Bridge', emoji: '🌉', description: 'a silver crossing' })
    expect(parseGeneratedMaterial('OUTPUT: sky garden | 🌻 | Flowers carried by the wind.'))
      .toEqual({ name: 'Sky Garden', emoji: '🌻', description: 'Flowers carried by the wind.' })
    expect(parseGeneratedMaterial('The result is a glowing wind garden that floats above the ground.'))
      .toEqual({
        name: 'A Glowing Wind Garden',
        emoji: '✨',
        description: 'The result is a glowing wind garden that floats above the ground.',
      })
  })

  it('fails closed on unusable model output', () => {
    expect(parseGeneratedMaterial('I cannot answer that.')).toBeNull()
    expect(parseGeneratedMaterial('The following is a short description that summarizes the input and output.')).toBeNull()
    expect(parseGeneratedMaterial('NAME | EMOJI | SHORT DESCRIPTION')).toBeNull()
  })

  it('creates deterministic offline fallbacks and unique names', () => {
    const first = BASE_MATERIALS[0]
    const second = BASE_MATERIALS[4]
    expect(fallbackMaterial(first, second)).toEqual(fallbackMaterial(second, first))
    expect(uniqueMaterial({ name: 'Water', emoji: '💧', description: 'duplicate' }, BASE_MATERIALS).name).toBe('Water 2')
  })

  it('recovers safely from corrupt local progress', () => {
    expect(loadGame('{broken')).toEqual(initialGame())
  })
})
