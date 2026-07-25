import type { ResumeTemplate } from '../../types/template'
import type { BasicInfoFields, EntryFields } from '../../types/resumeDb'
import { substitutePlaceholders } from './substitutePlaceholders'
import { escapeLatex } from './escapeLatex'

function generateLinksLatex(links: BasicInfoFields['links']): string {
  return links
    .filter((link) => link.label && link.url)
    .map((link) => String.raw`$|$ \href{${link.url}}{\underline{${escapeLatex(link.label)}}}`)
    .join(' ')
}

/** BasicInfo has no children — its default LaTeX is fully resolved. */
export function generateBasicInfoLatex(fields: BasicInfoFields, template: ResumeTemplate): string {
  return substitutePlaceholders(template.headerWrapperLatex, {
    NAME: escapeLatex(fields.name),
    EMAIL: escapeLatex(fields.email),
    PHONE: escapeLatex(fields.phone),
    LOCATION: escapeLatex(fields.location),
    LINKS: generateLinksLatex(fields.links),
  })
}

/** A Section's only own field is its title; {{SECTION_BODY}} is resolved at render time from its entries/skill rows. */
export function generateSectionLatex(displayName: string): string {
  return escapeLatex(displayName)
}

/**
 * Entries have children (bullets) rendered separately, so {{BULLETS}} is
 * deliberately left unresolved here for the render pass to fill in later.
 */
export function generateEntryLatex(fields: EntryFields, template: ResumeTemplate): string {
  const dates =
    fields.startDate && fields.endDate
      ? `${escapeLatex(fields.startDate)} -- ${escapeLatex(fields.endDate)}`
      : escapeLatex(fields.startDate || fields.endDate)

  return substitutePlaceholders(template.entryWrapperLatex, {
    TITLE: escapeLatex(fields.title),
    ORG: escapeLatex(fields.organization),
    DATES: dates,
    LOCATION: escapeLatex(fields.location),
  })
}

export function generateBulletLatex(text: string, template: ResumeTemplate): string {
  return substitutePlaceholders(template.bulletWrapperLatex, { TEXT: escapeLatex(text) })
}

/** {{SKILLS_LIST}} is left unresolved — filled in at render time from this row's Skill children. */
export function generateSkillRowLatex(categoryName: string, template: ResumeTemplate): string {
  return substitutePlaceholders(template.skillRowWrapperLatex, {
    CATEGORY: escapeLatex(categoryName),
  })
}
