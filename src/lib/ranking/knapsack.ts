import { renderTemplate, type RenderTemplateData } from '../template/renderTemplate'
import { estimatePageCount } from './estimatePageCount'
import { computeRelevanceScore } from './scoreItem'
import type { ResumeTemplate } from '../../types/template'
import type { BasicInfo, Bullet, Entry, Section, SectionOrderMode, Skill, SkillRow } from '../../types/resumeDb'

export interface IncludedItemIds {
  sections: string[]
  entries: string[]
  bullets: string[]
  skills: string[]
}

/**
 * Removes exactly one item from `includedItemIds`: the lowest-relevance
 * optional (non-mustInclude) bullet if any remain, otherwise the
 * lowest-relevance optional whole entry/skill (dropping an entry also drops
 * its bullets). Returns the same object (no-op) if nothing is removable —
 * every mustInclude item is left untouched. Exported so both
 * `fitToPageConstraints`'s initial heuristic pass and the generation
 * pipeline's post-compile correction loop share one removal priority.
 */
export function removeLowestScoringOptionalItem(
  includedItemIds: IncludedItemIds,
  data: { entries: Entry[]; bullets: Bullet[]; skills: Skill[] },
  scoreBreakdown: Record<string, number>,
): IncludedItemIds {
  const includedBulletIds = new Set(includedItemIds.bullets)
  const removableBullets = data.bullets.filter(
    (bullet) => includedBulletIds.has(bullet.id) && !bullet.mustInclude,
  )
  if (removableBullets.length > 0) {
    const lowest = removableBullets.reduce((a, b) => (scoreBreakdown[a.id] <= scoreBreakdown[b.id] ? a : b))
    return { ...includedItemIds, bullets: includedItemIds.bullets.filter((id) => id !== lowest.id) }
  }

  const includedEntryIds = new Set(includedItemIds.entries)
  const includedSkillIds = new Set(includedItemIds.skills)
  const removableEntries = data.entries.filter(
    (entry) => includedEntryIds.has(entry.id) && !entry.mustInclude,
  )
  const removableSkills = data.skills.filter(
    (skill) => includedSkillIds.has(skill.id) && !skill.mustInclude,
  )
  const candidates: { id: string; kind: 'entry' | 'skill'; score: number }[] = [
    ...removableEntries.map((entry) => ({ id: entry.id, kind: 'entry' as const, score: scoreBreakdown[entry.id] })),
    ...removableSkills.map((skill) => ({ id: skill.id, kind: 'skill' as const, score: scoreBreakdown[skill.id] })),
  ]
  if (candidates.length === 0) return includedItemIds

  const lowest = candidates.reduce((a, b) => (a.score <= b.score ? a : b))
  if (lowest.kind === 'skill') {
    return { ...includedItemIds, skills: includedItemIds.skills.filter((id) => id !== lowest.id) }
  }
  return {
    ...includedItemIds,
    entries: includedItemIds.entries.filter((id) => id !== lowest.id),
    bullets: includedItemIds.bullets.filter(
      (id) => data.bullets.find((bullet) => bullet.id === id)?.entryId !== lowest.id,
    ),
  }
}

/** Drops non-mustInclude sections that ended up with no remaining entries/skills. */
export function pruneEmptySections(
  includedItemIds: IncludedItemIds,
  data: { sections: Section[]; entries: Entry[]; skillRows: SkillRow[]; skills: Skill[] },
): IncludedItemIds {
  const includedSectionIds = new Set(includedItemIds.sections)
  const includedEntryIds = new Set(includedItemIds.entries)
  const includedSkillIds = new Set(includedItemIds.skills)

  const keptSectionIds = includedItemIds.sections.filter((sectionId) => {
    const section = data.sections.find((s) => s.id === sectionId)
    if (!section || section.mustInclude) return true
    const hasContent =
      section.sectionType === 'entries'
        ? data.entries.some((entry) => entry.sectionId === section.id && includedEntryIds.has(entry.id))
        : data.skills.some(
            (skill) =>
              includedSkillIds.has(skill.id) &&
              data.skillRows.some((row) => row.id === skill.skillRowId && row.sectionId === section.id),
          )
    return hasContent
  })

  return { ...includedItemIds, sections: keptSectionIds.filter((id) => includedSectionIds.has(id)) }
}

/** Average relevance score of a section's *included* children — used only to rank aiOptimized section order, never inclusion. */
export function computeSectionScore(
  section: Section,
  includedItemIds: IncludedItemIds,
  data: { entries: Entry[]; skillRows: SkillRow[]; skills: Skill[] },
  scoreBreakdown: Record<string, number>,
): number {
  const scores =
    section.sectionType === 'entries'
      ? data.entries
          .filter((entry) => entry.sectionId === section.id && includedItemIds.entries.includes(entry.id))
          .map((entry) => scoreBreakdown[entry.id] ?? 0)
      : data.skills
          .filter(
            (skill) =>
              includedItemIds.skills.includes(skill.id) &&
              data.skillRows.some((row) => row.id === skill.skillRowId && row.sectionId === section.id),
          )
          .map((skill) => scoreBreakdown[skill.id] ?? 0)
  if (scores.length === 0) return 0
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

/**
 * Returns `sections` re-indexed for rendering: unchanged in 'fixed' mode
 * (renderTemplate.ts sorts by each section's stored `order`, so the original
 * chronological order comes through untouched), or resequenced by descending
 * relevance score in 'aiOptimized' mode. Only the *returned* copies' `order`
 * changes — the underlying stored Section.order is never mutated, and entries/
 * bullets within a section are never reordered either way (same rationale as
 * `fitToPageConstraints`: content order shouldn't reshuffle based on JD match,
 * but which section leads is a reasonable thing to optimize).
 */
export function orderSectionsForRender(
  sections: Section[],
  mode: SectionOrderMode,
  includedItemIds: IncludedItemIds,
  data: { entries: Entry[]; skillRows: SkillRow[]; skills: Skill[] },
  scoreBreakdown: Record<string, number>,
): Section[] {
  if (mode === 'fixed') return sections
  return [...sections]
    .sort(
      (a, b) =>
        computeSectionScore(b, includedItemIds, data, scoreBreakdown) -
        computeSectionScore(a, includedItemIds, data, scoreBreakdown),
    )
    .map((section, index) => ({ ...section, order: index }))
}

export interface FitToPageConstraintsInput {
  template: ResumeTemplate
  basicInfo: BasicInfo | null
  sections: Section[]
  entries: Entry[]
  bullets: Bullet[]
  skillRows: SkillRow[]
  skills: Skill[]
  jdEmbedding: number[]
  /** Only `maxPages` is used here — minPages/margins are a future refinement (architecture.md §5's "adjust top margin" nuance), not implemented in Milestone 5. */
  maxPages: number
}

export interface FitToPageConstraintsResult {
  includedItemIds: IncludedItemIds
  estimatedPageCount: number
  scoreBreakdown: Record<string, number>
}

/**
 * Starts from "everything included" and removes the lowest-relevance optional
 * content until the estimated page count fits, in the order architecture.md
 * §5 specifies: bullets first, then whole entries/skills, then pruning
 * sections that ended up empty. Original chronological order within a section
 * is always preserved — only inclusion is decided by relevance, never
 * reordering (a resume's job history shouldn't reshuffle based on JD match).
 */
export function fitToPageConstraints({
  template,
  basicInfo,
  sections,
  entries,
  bullets,
  skillRows,
  skills,
  jdEmbedding,
  maxPages,
}: FitToPageConstraintsInput): FitToPageConstraintsResult {
  const scoreBreakdown: Record<string, number> = {}
  for (const bullet of bullets) scoreBreakdown[bullet.id] = computeRelevanceScore(bullet.embedding, jdEmbedding)
  for (const entry of entries) scoreBreakdown[entry.id] = computeRelevanceScore(entry.embedding, jdEmbedding)
  for (const skill of skills) scoreBreakdown[skill.id] = computeRelevanceScore(skill.embedding, jdEmbedding)

  let includedItemIds: IncludedItemIds = {
    sections: sections.map((section) => section.id),
    entries: entries.map((entry) => entry.id),
    bullets: bullets.map((bullet) => bullet.id),
    skills: skills.map((skill) => skill.id),
  }

  function render(ids: IncludedItemIds): string {
    const data: RenderTemplateData = {
      basicInfo,
      sections: sections.filter((section) => ids.sections.includes(section.id)),
      entries: entries.filter((entry) => ids.entries.includes(entry.id)),
      bullets: bullets.filter((bullet) => ids.bullets.includes(bullet.id)),
      skillRows,
      skills: skills.filter((skill) => ids.skills.includes(skill.id)),
    }
    return renderTemplate(template, data)
  }

  let pageCount = estimatePageCount(render(includedItemIds))
  while (pageCount > maxPages) {
    const next = removeLowestScoringOptionalItem(includedItemIds, { entries, bullets, skills }, scoreBreakdown)
    if (next === includedItemIds) break // nothing left that's removable
    includedItemIds = next
    pageCount = estimatePageCount(render(includedItemIds))
  }

  includedItemIds = pruneEmptySections(includedItemIds, { sections, entries, skillRows, skills })

  return {
    includedItemIds,
    estimatedPageCount: estimatePageCount(render(includedItemIds)),
    scoreBreakdown,
  }
}
