import { embedText } from './embeddingWorkerClient'
import { getCachedEmbedding, setCachedEmbedding } from './embeddingCache'

/** IndexedDB-cached, content-addressed by `cacheKey` (expected to encode the text's hash). */
export async function getOrComputeEmbedding(cacheKey: string, text: string): Promise<number[]> {
  const cached = await getCachedEmbedding(cacheKey)
  if (cached) return cached

  const embedding = await embedText(text)
  await setCachedEmbedding(cacheKey, embedding)
  return embedding
}
