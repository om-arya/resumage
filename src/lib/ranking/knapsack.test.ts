import { describe, expect, it } from 'vitest'
import { computeSectionScore, fitToPageConstraints, orderSectionsForRender } from './knapsack'
import type { ResumeTemplate } from '../../types/template'
import type { Bullet, Entry, Section, Skill, SkillRow } from '../../types/resumeDb'

const template: ResumeTemplate = {
  id: 't1',
  name: 'Test',
  latexPreamble: '\\documentclass{article}\n\\begin{document}',
  latexPostamble: '\\end{document}',
  mainBodyLatex: '{{HEADER}}\n{{SECTIONS}}',
  sectionWrapperLatex: '\\section{{{SECTION_TITLE}}}\n{{SECTION_BODY}}',
  skillsSectionWrapperLatex: '\\section{{{SECTION_TITLE}}}\n{{SECTION_BODY}}',
  entryWrapperLatex: '\\entry{{{TITLE}}}\n{{BULLETS}}',
  bulletWrapperLatex: '\\item{{{TEXT}}}',
  bulletListWrapperLatex: '\\begin{itemize}\n{{BULLETS}}\n\\end{itemize}',
  skillRowWrapperLatex: '\\textbf{{{CATEGORY}}}: {{SKILLS_LIST}}',
  skillListSeparator: ', ',
  headerWrapperLatex: '\\name{{{NAME}}}',
}

const TS = null as unknown as Section['createdAt']

function makeSection(overrides: Partial<Section>): Section {
  return {
    id: 's1',
    displayName: 'Experience',
    latex: 'Experience',
    isLatexOverridden: false,
    semanticText: '',
    semanticTextHash: '',
    embedding: null,
    mustInclude: false,
    order: 0,
    sectionType: 'entries',
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

function makeEntry(overrides: Partial<Entry>): Entry {
  return {
    id: 'e1',
    sectionId: 's1',
    fields: { title: 'Engineer', organization: 'Acme', startDate: '', endDate: '', location: '' },
    latex: '\\entry{Engineer}\n{{BULLETS}}',
    isLatexOverridden: false,
    semanticText: '',
    semanticTextHash: '',
    embedding: null,
    mustInclude: false,
    order: 0,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

function longBulletLatex(char: string, length: number): string {
  return `\\item{${char.repeat(length)}}`
}

function makeBullet(overrides: Partial<Bullet>): Bullet {
  return {
    id: 'b1',
    entryId: 'e1',
    sectionId: 's1',
    text: 'Did a thing',
    latex: longBulletLatex('x', 100),
    isLatexOverridden: false,
    semanticText: '',
    semanticTextHash: '',
    embedding: null,
    mustInclude: false,
    order: 0,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

const jdEmbedding = [1, 0]
const HIGH = [1, 0] // cosine similarity 1 with jdEmbedding
const LOW = [0, 1] // cosine similarity 0 with jdEmbedding

const emptySkillRows: SkillRow[] = []
const emptySkills: Skill[] = []

describe('fitToPageConstraints', () => {
  it('keeps everything when the content already fits', () => {
    const section = makeSection({})
    const entry = makeEntry({})
    const bullets = [makeBullet({ id: 'b1' })]

    const result = fitToPageConstraints({
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets,
      skillRows: emptySkillRows,
      skills: emptySkills,
      jdEmbedding,
      maxPages: 1,
    })

    expect(result.includedItemIds.sections).toEqual(['s1'])
    expect(result.includedItemIds.entries).toEqual(['e1'])
    expect(result.includedItemIds.bullets).toEqual(['b1'])
    expect(result.estimatedPageCount).toBe(1)
  })

  it('drops the lowest-relevance optional bullets first, keeping the highest-scoring one', () => {
    const section = makeSection({})
    const entry = makeEntry({})
    const bullets = [
      makeBullet({ id: 'high', latex: longBulletLatex('a', 2000), embedding: HIGH }),
      makeBullet({ id: 'medium', latex: longBulletLatex('b', 2000), embedding: null }),
      makeBullet({ id: 'low', latex: longBulletLatex('c', 2000), embedding: LOW }),
    ]

    const result = fitToPageConstraints({
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets,
      skillRows: emptySkillRows,
      skills: emptySkills,
      jdEmbedding,
      maxPages: 1,
    })

    expect(result.includedItemIds.bullets).toEqual(['high'])
    expect(result.estimatedPageCount).toBe(1)
  })

  it('never removes a mustInclude bullet even when it scores lowest', () => {
    const section = makeSection({})
    const entry = makeEntry({})
    const bullets = [
      makeBullet({ id: 'must', latex: longBulletLatex('a', 2000), embedding: LOW, mustInclude: true }),
      makeBullet({ id: 'optional', latex: longBulletLatex('b', 2000), embedding: HIGH }),
    ]

    const result = fitToPageConstraints({
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets,
      skillRows: emptySkillRows,
      skills: emptySkills,
      jdEmbedding,
      maxPages: 1,
    })

    expect(result.includedItemIds.bullets).toContain('must')
    expect(result.includedItemIds.bullets).not.toContain('optional')
  })

  it('drops a whole low-scoring entry once there are no bullets left to remove', () => {
    // No bullets at all — pass 1 has nothing to work with, forcing pass 2 to
    // remove a whole entry based on the entries' own (bulky) latex.
    const section = makeSection({})
    const highEntry = makeEntry({
      id: 'e-high',
      latex: `\\entry{${'a'.repeat(2500)}}\n{{BULLETS}}`,
      embedding: HIGH,
    })
    const lowEntry = makeEntry({
      id: 'e-low',
      latex: `\\entry{${'b'.repeat(2500)}}\n{{BULLETS}}`,
      embedding: LOW,
    })

    const result = fitToPageConstraints({
      template,
      basicInfo: null,
      sections: [section],
      entries: [highEntry, lowEntry],
      bullets: [],
      skillRows: emptySkillRows,
      skills: emptySkills,
      jdEmbedding,
      maxPages: 1,
    })

    expect(result.includedItemIds.entries).toEqual(['e-high'])
  })

  it('prunes an optional section that ends up with no remaining content', () => {
    const lowSection = makeSection({ id: 's-low' })
    const highSection = makeSection({ id: 's-high' })
    const lowEntry = makeEntry({
      id: 'e-low',
      sectionId: 's-low',
      latex: `\\entry{${'a'.repeat(2500)}}\n{{BULLETS}}`,
      embedding: LOW,
    })
    const highEntry = makeEntry({
      id: 'e-high',
      sectionId: 's-high',
      latex: `\\entry{${'b'.repeat(2500)}}\n{{BULLETS}}`,
      embedding: HIGH,
    })

    const result = fitToPageConstraints({
      template,
      basicInfo: null,
      sections: [lowSection, highSection],
      entries: [lowEntry, highEntry],
      bullets: [],
      skillRows: emptySkillRows,
      skills: emptySkills,
      jdEmbedding,
      maxPages: 1,
    })

    expect(result.includedItemIds.sections).toEqual(['s-high'])
  })

  it('preserves original order among survivors instead of reordering by score', () => {
    const section = makeSection({})
    const entry = makeEntry({})
    const bullets = [
      makeBullet({ id: 'first', order: 0, embedding: LOW }),
      makeBullet({ id: 'second', order: 1, embedding: HIGH }),
    ]

    const result = fitToPageConstraints({
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets,
      skillRows: emptySkillRows,
      skills: emptySkills,
      jdEmbedding,
      maxPages: 1,
    })

    // Both are small enough to fit — order must stay [first, second], not re-sorted by score.
    expect(result.includedItemIds.bullets).toEqual(['first', 'second'])
  })

  it('populates a scoreBreakdown entry for every scored item', () => {
    const section = makeSection({})
    const entry = makeEntry({})
    const bullets = [makeBullet({ id: 'b1', embedding: HIGH })]

    const result = fitToPageConstraints({
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets,
      skillRows: emptySkillRows,
      skills: emptySkills,
      jdEmbedding,
      maxPages: 1,
    })

    expect(result.scoreBreakdown.b1).toBeCloseTo(1)
    expect(result.scoreBreakdown.e1).toBe(0)
  })
})

describe('computeSectionScore', () => {
  it('averages the scores of a section\'s included entries', () => {
    const section = makeSection({ id: 's1', sectionType: 'entries' })
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })]
    const includedItemIds = { sections: ['s1'], entries: ['e1', 'e2'], bullets: [], skills: [] }
    const scoreBreakdown = { e1: 1, e2: 0.5 }

    const score = computeSectionScore(section, includedItemIds, { entries, skillRows: [], skills: [] }, scoreBreakdown)

    expect(score).toBeCloseTo(0.75)
  })

  it('ignores entries excluded from the current includedItemIds', () => {
    const section = makeSection({ id: 's1', sectionType: 'entries' })
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })]
    const includedItemIds = { sections: ['s1'], entries: ['e1'], bullets: [], skills: [] }
    const scoreBreakdown = { e1: 1, e2: 0 }

    const score = computeSectionScore(section, includedItemIds, { entries, skillRows: [], skills: [] }, scoreBreakdown)

    expect(score).toBe(1)
  })

  it('scores a skills-type section from its skills, not entries', () => {
    const section = makeSection({ id: 's1', sectionType: 'skills' })
    const skillRows: SkillRow[] = [
      { id: 'r1', sectionId: 's1', categoryName: 'Languages', latex: '', isLatexOverridden: false, order: 0, createdAt: TS, updatedAt: TS },
    ]
    const skills: Skill[] = [
      { id: 'sk1', skillRowId: 'r1', displayName: 'TypeScript', semanticText: '', semanticTextHash: '', embedding: null, mustInclude: false, order: 0, createdAt: TS, updatedAt: TS },
    ]
    const includedItemIds = { sections: ['s1'], entries: [], bullets: [], skills: ['sk1'] }

    const score = computeSectionScore(section, includedItemIds, { entries: [], skillRows, skills }, { sk1: 0.8 })

    expect(score).toBe(0.8)
  })

  it('returns 0 for a section with no included content', () => {
    const section = makeSection({ id: 's1', sectionType: 'entries' })
    const includedItemIds = { sections: ['s1'], entries: [], bullets: [], skills: [] }

    const score = computeSectionScore(section, includedItemIds, { entries: [], skillRows: [], skills: [] }, {})

    expect(score).toBe(0)
  })
})

describe('orderSectionsForRender', () => {
  it("leaves the array untouched in 'fixed' mode", () => {
    const sections = [makeSection({ id: 's-a', order: 0 }), makeSection({ id: 's-b', order: 1 })]

    const result = orderSectionsForRender(
      sections,
      'fixed',
      { sections: ['s-a', 's-b'], entries: [], bullets: [], skills: [] },
      { entries: [], skillRows: [], skills: [] },
      {},
    )

    expect(result).toBe(sections)
  })

  it("resequences by descending score in 'aiOptimized' mode, without mutating the stored order", () => {
    const lowSection = makeSection({ id: 's-low', order: 0 })
    const highSection = makeSection({ id: 's-high', order: 1 })
    const lowEntry = makeEntry({ id: 'e-low', sectionId: 's-low' })
    const highEntry = makeEntry({ id: 'e-high', sectionId: 's-high' })
    const includedItemIds = {
      sections: ['s-low', 's-high'],
      entries: ['e-low', 'e-high'],
      bullets: [],
      skills: [],
    }
    const scoreBreakdown = { 'e-low': 0, 'e-high': 1 }

    const result = orderSectionsForRender(
      [lowSection, highSection],
      'aiOptimized',
      includedItemIds,
      { entries: [lowEntry, highEntry], skillRows: [], skills: [] },
      scoreBreakdown,
    )

    expect(result.map((s) => s.id)).toEqual(['s-high', 's-low'])
    expect(result[0].order).toBe(0)
    expect(result[1].order).toBe(1)
    // The original Section objects passed in are untouched.
    expect(lowSection.order).toBe(0)
    expect(highSection.order).toBe(1)
  })
})
