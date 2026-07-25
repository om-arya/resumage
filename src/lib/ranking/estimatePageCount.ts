import { stripNoise } from '../semantic/ruleBasedExtractor'

/**
 * Calibrated for an 11pt single-column resume page (Jake's-Resume-style density):
 * roughly how many characters of visible text fit on one page. Deliberately a
 * rough client-side heuristic used to converge quickly during fitting — the
 * generation pipeline follows up with a real Tectonic compile to verify
 * (architecture.md §5's "10s-budget nuance").
 */
const CHARS_PER_PAGE = 3800

export function estimatePageCount(latex: string): number {
  const visibleLength = stripNoise(latex).length
  return Math.max(1, Math.ceil(visibleLength / CHARS_PER_PAGE))
}
