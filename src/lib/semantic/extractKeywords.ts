import { CURATED_SKILL_DICTIONARY } from './skillDictionary'

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Case-insensitive, word-boundary-ish match of each dictionary term against `text`, deduped, dictionary-cased. */
export function extractKeywords(
  text: string,
  dictionary: string[] = CURATED_SKILL_DICTIONARY,
): string[] {
  const found: string[] = []
  for (const term of dictionary) {
    const pattern = new RegExp(`(?<![a-zA-Z0-9])${escapeRegExp(term)}(?![a-zA-Z0-9])`, 'i')
    if (pattern.test(text)) found.push(term)
  }
  return found
}
