import type { EntryFields } from '../../types/resumeDb'

/**
 * Swappable semantic-text generation backend. `ruleBasedProvider` (deterministic,
 * zero-cost) implements this now; a future `ollamaProvider.ts` could replace it
 * with real paraphrasing without any caller (resumeDbStore) changing.
 */
export interface SemanticTextProvider {
  /** Section/Bullet: derive semantic text directly from their LaTeX source. */
  generateSectionOrBulletSemanticText(latex: string): Promise<string>
  /** Skill: derive semantic text from its plain display name. */
  generateSkillSemanticText(displayName: string): Promise<string>
  /** Entry: compose from its fields plus keywords found in its bullets. */
  generateEntrySemanticText(fields: EntryFields, bulletTexts: string[]): Promise<string>
}
