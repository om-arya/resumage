import { hashText } from './hashText'
import { getOrComputeEmbedding } from '../ai/getOrComputeEmbedding'

export interface ComputeSemanticFieldsInput {
  /** Scopes the embedding cache per-user; combined with the text hash the key is fully content-addressed. */
  uid: string
  semanticText: string
  existingSemanticTextHash: string
  existingEmbedding: number[] | null
}

export interface SemanticFields {
  semanticText: string
  semanticTextHash: string
  embedding: number[] | null
}

/**
 * Generation checks: hash unchanged + embedding already present → reuse as-is
 * (no recompute, no cache hit needed). Otherwise falls through to the
 * IndexedDB-cached, worker-backed embedding computation (architecture.md §5).
 *
 * Embedding computation depends on a Web Worker + model download, both of
 * which can fail transiently — that must never block saving the underlying
 * resume item. On failure, `embedding` is `null` (not a stale prior value,
 * since that would silently pair the new hash with an out-of-date vector).
 */
export async function computeSemanticFields({
  uid,
  semanticText,
  existingSemanticTextHash,
  existingEmbedding,
}: ComputeSemanticFieldsInput): Promise<SemanticFields> {
  const semanticTextHash = hashText(semanticText)

  if (semanticTextHash === existingSemanticTextHash && existingEmbedding) {
    return { semanticText, semanticTextHash, embedding: existingEmbedding }
  }

  try {
    const embedding = await getOrComputeEmbedding(`${uid}:${semanticTextHash}`, semanticText)
    return { semanticText, semanticTextHash, embedding }
  } catch (err) {
    console.warn('Embedding computation failed; saving without an embedding.', err)
    return { semanticText, semanticTextHash, embedding: null }
  }
}
