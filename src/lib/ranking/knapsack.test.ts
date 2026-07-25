import { describe, expect, it } from 'vitest'
import { fitToPageConstraints } from './knapsack'
import type { ResumeTemplate } from '../../types/template'
import type { Bullet, Entry, Section, Skill, SkillRow } from '../../types/resumeDb'

const template: ResumeTemplate = {
  id: 't1',
  name: 'Test',
  latexPreamble: '\\documentclass{article}\n\\begin{document}',
  latexPostamble: '\\end{document}',
  mainBodyLatex: '{{HEADER}}\n{{SECTIONS}}',
  sectionWrapperLatex: '\\section{{{SECTION_TITLE}}}\n{{SECTION_BODY}}',
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
