import type { SemanticTextProvider } from './provider'
import { stripNoise, normalizeWhitespace } from './ruleBasedExtractor'
import { extractKeywords } from './extractKeywords'

export const ruleBasedProvider: SemanticTextProvider = {
  async generateSectionOrBulletSemanticText(latex) {
    return stripNoise(latex)
  },

  async generateSkillSemanticText(displayName) {
    return stripNoise(displayName)
  },

  async generateEntrySemanticText(fields, bulletTexts) {
    const header = fields.organization ? `${fields.title} at ${fields.organization}.` : `${fields.title}.`
    const keywords = extractKeywords(bulletTexts.join(' '))
    return normalizeWhitespace(keywords.length > 0 ? `${header} ${keywords.join(', ')}` : header)
  },
}

export function getSemanticTextProvider(): SemanticTextProvider {
  return ruleBasedProvider
}
