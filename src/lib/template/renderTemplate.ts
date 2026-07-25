import { substitutePlaceholders } from './substitutePlaceholders'
import type { ResumeTemplate } from '../../types/template'
import type { BasicInfo, Bullet, Entry, Section, Skill, SkillRow } from '../../types/resumeDb'

export interface RenderTemplateData {
  basicInfo: BasicInfo | null
  sections: Section[]
  entries: Entry[]
  bullets: Bullet[]
  skillRows: SkillRow[]
  skills: Skill[]
}

function byOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order)
}

function renderBulletList(template: ResumeTemplate, bullets: Bullet[]): string {
  if (bullets.length === 0) return ''
  const joined = byOrder(bullets)
    .map((bullet) => bullet.latex)
    .join('\n')
  return substitutePlaceholders(template.bulletListWrapperLatex, { BULLETS: joined })
}

function renderEntry(template: ResumeTemplate, entry: Entry, allBullets: Bullet[]): string {
  const bulletList = renderBulletList(
    template,
    allBullets.filter((bullet) => bullet.entryId === entry.id),
  )
  return substitutePlaceholders(entry.latex, { BULLETS: bulletList })
}

function renderSkillRow(template: ResumeTemplate, skillRow: SkillRow, allSkills: Skill[]): string {
  const skillsList = byOrder(allSkills.filter((skill) => skill.skillRowId === skillRow.id))
    .map((skill) => skill.displayName)
    .join(template.skillListSeparator)
  return substitutePlaceholders(skillRow.latex, { SKILLS_LIST: skillsList })
}

function renderSection(template: ResumeTemplate, section: Section, data: RenderTemplateData): string {
  const body =
    section.sectionType === 'entries'
      ? byOrder(data.entries.filter((entry) => entry.sectionId === section.id))
          .map((entry) => renderEntry(template, entry, data.bullets))
          .join('\n')
      : byOrder(data.skillRows.filter((row) => row.sectionId === section.id))
          .map((row) => renderSkillRow(template, row, data.skills))
          .join('\n')

  return substitutePlaceholders(template.sectionWrapperLatex, {
    SECTION_TITLE: section.latex,
    SECTION_BODY: body,
  })
}

/**
 * Assembles the full .tex document: bullets → entries/skill rows → sections →
 * mainBodyLatex → wrapped in preamble/postamble. Every piece renders from its
 * already-generated `.latex` field — no regeneration happens here (architecture.md §6).
 * Renders every section/entry/bullet/skill regardless of `mustInclude` — job-tailored
 * filtering is the generation pipeline's job (Milestone 5), not the template preview's.
 */
export function renderTemplate(template: ResumeTemplate, data: RenderTemplateData): string {
  const header = data.basicInfo?.latex ?? ''
  const sectionsLatex = byOrder(data.sections)
    .map((section) => renderSection(template, section, data))
    .join('\n\n')

  const mainBody = substitutePlaceholders(template.mainBodyLatex, {
    HEADER: header,
    SECTIONS: sectionsLatex,
  })

  return `${template.latexPreamble}\n${mainBody}\n${template.latexPostamble}`
}
