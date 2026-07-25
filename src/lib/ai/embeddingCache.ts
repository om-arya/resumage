import { get, set } from 'idb-keyval'

const KEY_PREFIX = 'resumage:embedding:'

/** Content-addressed IndexedDB cache — `cacheKey` should already encode the text's hash. */
export function getCachedEmbedding(cacheKey: string): Promise<number[] | undefined> {
  return get<number[]>(KEY_PREFIX + cacheKey)
}

export function setCachedEmbedding(cacheKey: string, embedding: number[]): Promise<void> {
  return set(KEY_PREFIX + cacheKey, embedding)
}
