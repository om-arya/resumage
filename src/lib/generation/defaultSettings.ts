import type { GenerationSettings } from '../../types/resumeDb'

/** Used until a user saves their own preferences on the Settings page. */
export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  pageConstraints: {
    minPages: 1,
    maxPages: 1,
    minTopMarginIn: 0.5,
    maxTopMarginIn: 1,
    sideMarginIn: 0.5,
  },
  sectionOrderMode: 'fixed',
}
