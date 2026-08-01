import type { Timestamp } from 'firebase/firestore'

export interface BasicInfoFields {
  name: string
  email: string
  phone: string
  location: string
  links: { label: string; url: string }[]
}

export interface BasicInfo {
  fields: BasicInfoFields
  latex: string
  isLatexOverridden: boolean
}

export type SectionType = 'entries' | 'skills'

export interface Section {
  id: string
  displayName: string
  latex: string
  isLatexOverridden: boolean
  semanticText: string
  semanticTextHash: string
  embedding: number[] | null
  mustInclude: boolean
  order: number
  sectionType: SectionType
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface EntryFields {
  title: string
  organization: string
  startDate: string
  endDate: string
  location: string
}

export interface Entry {
  id: string
  sectionId: string
  fields: EntryFields
  latex: string
  isLatexOverridden: boolean
  semanticText: string
  semanticTextHash: string
  embedding: number[] | null
  mustInclude: boolean
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Bullet {
  id: string
  entryId: string
  sectionId: string
  text: string
  latex: string
  isLatexOverridden: boolean
  semanticText: string
  semanticTextHash: string
  embedding: number[] | null
  mustInclude: boolean
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SkillRow {
  id: string
  sectionId: string
  categoryName: string
  latex: string
  isLatexOverridden: boolean
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Skill {
  id: string
  skillRowId: string
  displayName: string
  semanticText: string
  semanticTextHash: string
  embedding: number[] | null
  mustInclude: boolean
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PageConstraints {
  minPages: number
  maxPages: number
  minTopMarginIn: number
  maxTopMarginIn: number
  sideMarginIn: number
}

export type SectionOrderMode = 'fixed' | 'aiOptimized'

/** Per-user generation defaults (Milestone 6), embedded on the `users/{uid}` doc. */
export interface GenerationSettings {
  pageConstraints: PageConstraints
  sectionOrderMode: SectionOrderMode
}

export interface GeneratedResume {
  id: string
  jobDescriptionText: string
  jdSemanticText: string
  templateId: string
  sectionOrderMode: SectionOrderMode
  generatedLatex: string
  pdfStoragePath: string
  pageCount: number
  includedItemIds: {
    sections: string[]
    entries: string[]
    bullets: string[]
    skills: string[]
  }
  scoreBreakdown?: Record<string, number>
  createdAt: Timestamp
}

/** Entities whose `latex` is either auto-generated from `fields` or user-overridden verbatim. */
export type LatexOverridableEntity = BasicInfo | Section | Entry | Bullet | SkillRow
