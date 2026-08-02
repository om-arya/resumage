import { describe, expect, it } from 'vitest'
import { JAKES_RESUME_TEMPLATE } from './jakesResumeTemplate'
import { renderTemplate } from './renderTemplate'
import { generateSectionLatex, generateSkillRowLatex } from './generateDefaultLatex'
import type { RenderTemplateData } from './renderTemplate'
import type { Section, SkillRow, Skill } from '../../types/resumeDb'

const TS = null as unknown as Section['createdAt']

/**
 * Regression test for a real production bug: skills sections are wrapped in
 * their own itemize (\resumeSkillsListStart/End) that requires \item just like
 * any other itemize — without one, "Something's wrong--perhaps a missing \item"
 * the moment a user actually generates a resume with a populated Skills section.
 */
describe("Jake's Resume — skills section produces valid, tightly-spaced itemize content", () => {
  it('emits one \\item per skill row inside its own (not the entries) itemize', () => {
    const section: Section = {
      id: 's1',
      displayName: 'Skills',
      latex: generateSectionLatex('Skills'),
      isLatexOverridden: false,
      semanticText: '',
      semanticTextHash: '',
      embedding: null,
      mustInclude: true,
      order: 0,
      sectionType: 'skills',
      createdAt: TS,
      updatedAt: TS,
    }
    const skillRow: SkillRow = {
      id: 'r1',
      sectionId: 's1',
      categoryName: 'Languages',
      latex: generateSkillRowLatex('Languages', JAKES_RESUME_TEMPLATE),
      isLatexOverridden: false,
      order: 0,
      createdAt: TS,
      updatedAt: TS,
    }
    const skill: Skill = {
      id: 'sk1',
      skillRowId: 'r1',
      displayName: 'TypeScript',
      semanticText: '',
      semanticTextHash: '',
      embedding: null,
      mustInclude: true,
      order: 0,
      createdAt: TS,
      updatedAt: TS,
    }

    const data: RenderTemplateData = {
      basicInfo: null,
      sections: [section],
      entries: [],
      bullets: [],
      skillRows: [skillRow],
      skills: [skill],
    }

    const result = renderTemplate(JAKES_RESUME_TEMPLATE, data)

    // The skills section's itemize block must contain a \item before its content.
    // (search after \begin{document} — the macro *definitions* earlier in the
    // preamble also contain the literal string \resumeSkillsListStart.)
    const bodyStart = result.indexOf('\\begin{document}')
    const sectionStart = result.indexOf('\\resumeSkillsListStart', bodyStart)
    const sectionEnd = result.indexOf('\\resumeSkillsListEnd', sectionStart)
    const sectionBody = result.slice(sectionStart, sectionEnd)
    expect(sectionBody).toMatch(/\\item\\small\{\\textbf\{Languages\}/)
    // ...and must NOT have gone into the entries itemize (the bug this class of test exists to catch).
    expect(result.slice(bodyStart)).not.toContain('\\resumeSubHeadingListStart\n    \\item\\small')
  })

  it('gives the skills itemize zero inter-item spacing, unlike the entries one', () => {
    expect(JAKES_RESUME_TEMPLATE.latexPreamble).toMatch(
      /\\resumeSkillsListStart\}\{\\begin\{itemize\}\[[^\]]*itemsep=0pt[^\]]*\]/,
    )
  })
})
