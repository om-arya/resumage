import type { ResumeTextItem } from '../firebase/functionsApi'
import type { ParsedResume } from './types'

/**
 * Swappable resume-parsing backend, mirroring semantic/provider.ts's pattern.
 * `heuristicResumeParser.ts` (deterministic, layout-aware, zero-cost) implements
 * this now; a future LLM-backed provider could replace it without any caller change.
 */
export interface ResumeParserProvider {
  parseResume(items: ResumeTextItem[]): Promise<ParsedResume>
}
