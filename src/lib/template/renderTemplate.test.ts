import { describe, expect, it } from 'vitest'
import { renderTemplate, type RenderTemplateData } from './renderTemplate'
import type { ResumeTemplate } from '../../types/template'
import type { Bullet, Entry, Section, Skill, SkillRow } from '../../types/resumeDb'

const template: ResumeTemplate = {
  id: 't1',
  name: 'Test Template',
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

// Timestamps are never read by renderTemplate — stub them out for fixtures.
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
    mustInclude: true,
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
    mustInclude: true,
    order: 0,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

function makeBullet(overrides: Partial<Bullet>): Bullet {
  return {
    id: 'b1',
    entryId: 'e1',
    sectionId: 's1',
    text: 'Did a thing',
    latex: '\\item{Did a thing}',
    isLatexOverridden: false,
    semanticText: '',
    semanticTextHash: '',
    embedding: null,
    mustInclude: true,
    order: 0,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

function makeSkillRow(overrides: Partial<SkillRow>): SkillRow {
  return {
    id: 'r1',
    sectionId: 's1',
    categoryName: 'Languages',
    latex: '\\textbf{Languages}: {{SKILLS_LIST}}',
    isLatexOverridden: false,
    order: 0,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

function makeSkill(overrides: Partial<Skill>): Skill {
  return {
    id: 'sk1',
    skillRowId: 'r1',
    displayName: 'Python',
    semanticText: '',
    semanticTextHash: '',
    embedding: null,
    mustInclude: true,
    order: 0,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  }
}

const emptyData: RenderTemplateData = {
  basicInfo: null,
  sections: [],
  entries: [],
  bullets: [],
  skillRows: [],
  skills: [],
}

describe('renderTemplate', () => {
  it('wraps the main body in the preamble and postamble', () => {
    const result = renderTemplate(template, emptyData)
    expect(result.startsWith(template.latexPreamble)).toBe(true)
    expect(result.trimEnd().endsWith(template.latexPostamble)).toBe(true)
  })

  it('substitutes the header from basicInfo.latex', () => {
    const result = renderTemplate(template, {
      ...emptyData,
      basicInfo: { fields: { name: 'Jane', email: '', phone: '', location: '', links: [] }, latex: '\\name{Jane}', isLatexOverridden: false },
    })
    expect(result).toContain('\\name{Jane}')
  })

  it('resolves an entry\'s {{BULLETS}} placeholder from its child bullets, in order', () => {
    const section = makeSection({})
    const entry = makeEntry({})
    const bullets = [
      makeBullet({ id: 'b2', order: 1, latex: '\\item{Second}' }),
      makeBullet({ id: 'b1', order: 0, latex: '\\item{First}' }),
    ]
    const result = renderTemplate(template, { ...emptyData, sections: [section], entries: [entry], bullets })
    const firstIndex = result.indexOf('\\item{First}')
    const secondIndex = result.indexOf('\\item{Second}')
    expect(firstIndex).toBeGreaterThan(-1)
    expect(secondIndex).toBeGreaterThan(firstIndex)
    expect(result).not.toContain('{{BULLETS}}')
  })

  it('renders an empty bullet list as an empty string, not a stray wrapper', () => {
    const section = makeSection({})
    const entry = makeEntry({})
    const result = renderTemplate(template, { ...emptyData, sections: [section], entries: [entry] })
    expect(result).not.toContain('\\begin{itemize}')
    expect(result).not.toContain('{{BULLETS}}')
  })

  it('resolves a skill row\'s {{SKILLS_LIST}} placeholder joined by the separator', () => {
    const section = makeSection({ sectionType: 'skills' })
    const skillRow = makeSkillRow({})
    const skills = [
      makeSkill({ id: 'sk2', order: 1, displayName: 'React' }),
      makeSkill({ id: 'sk1', order: 0, displayName: 'Python' }),
    ]
    const result = renderTemplate(template, { ...emptyData, sections: [section], skillRows: [skillRow], skills })
    expect(result).toContain('\\textbf{Languages}: Python, React')
  })

  it('renders sections in order and uses the section\'s own latex as the title', () => {
    const sections = [
      makeSection({ id: 's2', order: 1, displayName: 'Projects', latex: 'Projects' }),
      makeSection({ id: 's1', order: 0, displayName: 'Experience', latex: 'Experience' }),
    ]
    const result = renderTemplate(template, { ...emptyData, sections })
    const experienceIndex = result.indexOf('\\section{Experience}')
    const projectsIndex = result.indexOf('\\section{Projects}')
    expect(experienceIndex).toBeGreaterThan(-1)
    expect(projectsIndex).toBeGreaterThan(experienceIndex)
  })

  it('handles a fully empty resume gracefully', () => {
    expect(() => renderTemplate(template, emptyData)).not.toThrow()
  })
})
