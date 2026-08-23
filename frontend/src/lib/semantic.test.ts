import { describe, expect, it } from 'vitest'
import { SEMANTIC_COLLAPSE_THRESHOLD, bestSemanticMatch, cosineForNormalizedVectors } from './semantic'

describe('semantic collapse', () => {
  it('computes cosine similarity for normalized embedding vectors', () => {
    expect(cosineForNormalizedVectors([1, 0], [1, 0])).toBe(1)
    expect(cosineForNormalizedVectors([1, 0], [0, 1])).toBe(0)
    expect(cosineForNormalizedVectors([], [1])).toBe(0)
  })

  it('collapses only at or above the production threshold', () => {
    const vectors = [{ id: 'near', vector: [0.9, 0.435889894] }, { id: 'far', vector: [0.2, 0.979795897] }]
    expect(bestSemanticMatch([1, 0], vectors)).toMatchObject({ id: 'near', score: 0.9 })
    expect(bestSemanticMatch([1, 0], [{ id: 'below', vector: [SEMANTIC_COLLAPSE_THRESHOLD - 0.001, 0] }])).toBeUndefined()
  })

  it('uses the stable id as a deterministic tie breaker', () => {
    expect(bestSemanticMatch([1], [{ id: 'zeta', vector: [1] }, { id: 'alpha', vector: [1] }])?.id).toBe('alpha')
  })
})
