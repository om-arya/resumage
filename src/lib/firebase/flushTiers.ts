export type ResumeDbEntityCollection = 'sections' | 'entries' | 'bullets' | 'skillRows' | 'skills'

/**
 * Parent-before-child persist order for the Save button's batched flush.
 * A locally-added entity's FK fields (e.g. an entry's `sectionId`) may still
 * point at a not-yet-created parent's local id, so the parent's create must
 * finish (and resumeDbStore's `localIdMap` get its real id) before children
 * in the next tier are flushed.
 */
export const FLUSH_TIER: Record<ResumeDbEntityCollection, number> = {
  sections: 0,
  entries: 1,
  skillRows: 1,
  bullets: 2,
  skills: 2,
}
