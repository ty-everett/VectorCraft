export const SEMANTIC_COLLAPSE_THRESHOLD = 0.86

export function cosineForNormalizedVectors(first: number[], second: number[]): number {
  if (first.length === 0 || second.length === 0) return 0
  return first.reduce((total, value, index) => total + value * (second[index] ?? 0), 0)
}

export function bestSemanticMatch(
  candidate: number[],
  vectors: Array<{ id: string; vector: number[] }>,
  threshold = SEMANTIC_COLLAPSE_THRESHOLD,
): { id: string; score: number } | undefined {
  const best = vectors
    .map(({ id, vector }) => ({ id, score: cosineForNormalizedVectors(candidate, vector) }))
    .sort((first, second) => second.score - first.score || first.id.localeCompare(second.id))[0]
  return best && best.score >= threshold ? best : undefined
}
