import { describe, expect, it } from 'vitest'
import {
  generateBasicInfoLatex,
  generateBulletLatex,
  generateEntryLatex,
  generateSectionLatex,
  generateSkillRowLatex,
} from './generateDefaultLatex'
import { JAKES_RESUME_TEMPLATE } from './jakesResumeTemplate'

describe('generateBasicInfoLatex', () => {
  it('fully resolves the header with escaped fields and joined links', () => {
    const latex = generateBasicInfoLatex(
      {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        location: 'Remote',
        links: [{ label: 'GitHub', url: 'https://github.com/jane' }],
      },
      JAKES_RESUME_TEMPLATE,
    )
    expect(latex).toContain('Jane Doe')
    expect(latex).toContain('555-0100')
    expect(latex).toContain('jane@example.com')
    expect(latex).toContain('Remote')
    expect(latex).toContain(String.raw`\href{https://github.com/jane}{\underline{GitHub}}`)
    expect(latex).not.toContain('{{')
  })

  it('omits links with a missing label or url', () => {
    const latex = generateBasicInfoLatex(
      {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        location: 'Remote',
        links: [{ label: '', url: 'https://omitted.test' }],
      },
      JAKES_RESUME_TEMPLATE,
    )
    expect(latex).not.toContain('omitted.test')
  })

  it('escapes special characters in fields', () => {
    const latex = generateBasicInfoLatex(
      { name: 'A & B', email: 'a@b.com', phone: '', location: '', links: [] },
      JAKES_RESUME_TEMPLATE,
    )
    expect(latex).toContain(String.raw`A \& B`)
  })
})

describe('generateSectionLatex', () => {
  it('escapes the section title and returns nothing else', () => {
    expect(generateSectionLatex('R&D')).toBe(String.raw`R\&D`)
  })
})

describe('generateEntryLatex', () => {
  it('resolves title/org/dates/location but leaves {{BULLETS}} unresolved', () => {
    const latex = generateEntryLatex(
      {
        title: 'Software Engineer',
        organization: 'Acme',
        startDate: 'Jan 2020',
        endDate: 'Present',
        location: 'Remote',
      },
      JAKES_RESUME_TEMPLATE,
    )
    expect(latex).toContain('Software Engineer')
    expect(latex).toContain('Acme')
    expect(latex).toContain('Jan 2020 -- Present')
    expect(latex).toContain('Remote')
    expect(latex).toContain('{{BULLETS}}')
  })

  it('uses a single date when only one is provided', () => {
    const latex = generateEntryLatex(
      { title: 'T', organization: 'O', startDate: '', endDate: '2024', location: 'L' },
      JAKES_RESUME_TEMPLATE,
    )
    expect(latex).toContain('2024')
    expect(latex).not.toContain('--')
  })
})

describe('generateBulletLatex', () => {
  it('wraps and escapes the bullet text', () => {
    const latex = generateBulletLatex('Improved throughput by 20% using caching', JAKES_RESUME_TEMPLATE)
    expect(latex).toContain(String.raw`Improved throughput by 20\% using caching`)
    expect(latex).toContain(String.raw`\resumeItem`)
  })
})

describe('generateSkillRowLatex', () => {
  it('resolves {{CATEGORY}} but leaves {{SKILLS_LIST}} unresolved', () => {
    const latex = generateSkillRowLatex('Languages', JAKES_RESUME_TEMPLATE)
    expect(latex).toContain('Languages')
    expect(latex).toContain('{{SKILLS_LIST}}')
  })
})
