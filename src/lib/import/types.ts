import type { EntryFields, SectionType } from '../../types/resumeDb'

export interface ParsedBasicInfoFields {
  name: string
  email: string
  phone: string
  location: string
  links: { label: string; url: string }[]
}

export interface ParsedEntry {
  fields: EntryFields
  bullets: string[]
}

export interface ParsedSkillRow {
  categoryName: string
  skills: string[]
}

/** Reuses `EntryFields`/`SectionType` directly so confirmed items need no translation before hitting resumeDbStore's add actions. */
export interface ParsedSection {
  displayName: string
  sectionType: SectionType
  entries: ParsedEntry[]
  skillRows: ParsedSkillRow[]
}

export interface ParsedResume {
  basicInfo: ParsedBasicInfoFields
  sections: ParsedSection[]
}
