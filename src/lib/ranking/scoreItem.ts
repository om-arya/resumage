import { cosineSimilarity } from './cosineSimilarity'

/**
 * An item with no embedding (e.g. computation failed and never retried — see
 * computeSemanticFields.ts) scores 0: neutral-low, never crashes, never wins a
 * relevance comparison it hasn't earned.
 */
export function computeRelevanceScore(itemEmbedding: number[] | null, jdEmbedding: number[]): number {
  if (!itemEmbedding) return 0
  return cosineSimilarity(itemEmbedding, jdEmbedding)
}
