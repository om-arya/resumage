/**
 * Deterministic, non-cryptographic hash (djb2-xor variant) used purely as a
 * cache/staleness key for `semanticTextHash` — collision resistance at scale
 * doesn't matter here, only "did the text change since last save."
 */
export function hashText(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}
