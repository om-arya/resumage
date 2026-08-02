import { describe, expect, it } from 'vitest'
import { extractParsedResume } from './heuristicResumeExtractor'
import type { ResumeTextItem } from '../firebase/functionsApi'

interface FixtureLine {
  text: string
  fontSize?: number
  /** Vertical gap from the previous line. Defaults to a "normal" line gap; use a large value at entry/section boundaries. */
  gapBefore?: number
  page?: number
}

const NORMAL_GAP = 14

/** One ResumeTextItem per line (already-joined text) — line reconstruction itself is lineGrouping.test.ts's job. */
function buildItems(lines: FixtureLine[]): ResumeTextItem[] {
  let y = 700
  let lastPage = 1
  return lines.map((line, index) => {
    const page = line.page ?? lastPage
    if (page !== lastPage) y = 700
    if (index > 0) y -= line.gapBefore ?? NORMAL_GAP
    lastPage = page
    return { text: line.text, x: 50, y, width: line.text.length * 5, fontSize: line.fontSize ?? 10, page }
  })
}

describe('extractParsedResume — bulleted resume with dated entries', () => {
  const items = buildItems([
    { text: 'John Doe', fontSize: 20 },
    { text: '123-456-7890 | john@example.com | linkedin.com/in/johndoe' },
    { text: 'EXPERIENCE', fontSize: 13, gapBefore: 32 },
    { text: 'Software Engineer Jan 2020 - Present' },
    { text: 'Acme Corp, San Francisco, CA' },
    { text: '• Built a thing that did stuff for users' },
    { text: '• Improved performance by 50% using caching' },
    { text: 'Senior Developer Jun 2018 - Dec 2019', gapBefore: 32 },
    { text: 'Globex Inc, Remote' },
    { text: '• Led a team of 4 engineers' },
    { text: '• Shipped feature X' },
    { text: 'EDUCATION', fontSize: 13, gapBefore: 32 },
    { text: 'B.S. Computer Science 2014 - 2018' },
    { text: 'State University, Anytown, USA' },
    { text: 'SKILLS', fontSize: 13, gapBefore: 32 },
    { text: 'Languages: JavaScript, TypeScript, Python' },
    { text: 'Frameworks: React, Node.js, Django' },
  ])
  const result = extractParsedResume(items)

  it('extracts the name from the largest-font preamble line, not the section headers', () => {
    expect(result.basicInfo.name).toBe('John Doe')
  })

  it('extracts email and phone from the contact line', () => {
    expect(result.basicInfo.email).toBe('john@example.com')
    expect(result.basicInfo.phone).toBe('123-456-7890')
  })

  it('extracts a link without also emitting the email domain as a bogus second link', () => {
    expect(result.basicInfo.links).toEqual([{ label: 'linkedin.com', url: 'https://linkedin.com/in/johndoe' }])
  })

  it('finds all three sections in order, titlecased', () => {
    expect(result.sections.map((s) => s.displayName)).toEqual(['Experience', 'Education', 'Skills'])
    expect(result.sections.map((s) => s.sectionType)).toEqual(['entries', 'entries', 'skills'])
  })

  it('splits Experience into two entries at the large vertical gap, each with its own dates/org/location/bullets', () => {
    const [job1, job2] = result.sections[0].entries
    expect(job1.fields).toEqual({
      title: 'Software Engineer',
      organization: 'Acme Corp',
      startDate: 'Jan 2020',
      endDate: 'Present',
      location: 'San Francisco, CA',
    })
    expect(job1.bullets).toEqual([
      'Built a thing that did stuff for users',
      'Improved performance by 50% using caching',
    ])
    expect(job2.fields).toEqual({
      title: 'Senior Developer',
      organization: 'Globex Inc',
      startDate: 'Jun 2018',
      endDate: 'Dec 2019',
      location: 'Remote',
    })
    expect(job2.bullets).toEqual(['Led a team of 4 engineers', 'Shipped feature X'])
  })

  it('parses a bulletless Education entry, splitting "Org, City, Country" into organization + location correctly', () => {
    expect(result.sections[1].entries).toEqual([
      {
        fields: {
          title: 'B.S. Computer Science',
          organization: 'State University',
          startDate: '2014',
          endDate: '2018',
          location: 'Anytown, USA',
        },
        bullets: [],
      },
    ])
  })

  it('parses labeled skill rows', () => {
    expect(result.sections[2].skillRows).toEqual([
      { categoryName: 'Languages', skills: ['JavaScript', 'TypeScript', 'Python'] },
      { categoryName: 'Frameworks', skills: ['React', 'Node.js', 'Django'] },
    ])
  })
})

describe('extractParsedResume — unconventional headers and comma-list skills', () => {
  const items = buildItems([
    { text: 'Jane Smith', fontSize: 18 },
    { text: 'San Francisco, CA' },
    { text: 'jane@example.com' },
    { text: 'STUFF I KNOW', gapBefore: 32 },
    { text: 'Python, JavaScript, Go, Rust' },
    { text: 'Docker, Kubernetes, AWS' },
    { text: 'Selected Projects', fontSize: 12, gapBefore: 32 },
    { text: 'Resume Parser Tool Mar 2023' },
    { text: '• Built a heuristic PDF parser' },
    { text: '• Wrote 40+ deterministic tests' },
  ])
  const result = extractParsedResume(items)

  it('falls back to the first non-name, non-contact preamble line as location', () => {
    expect(result.basicInfo.location).toBe('San Francisco, CA')
  })

  it('detects an all-caps non-keyword header and reclassifies it as skills by sniffing its comma-list content', () => {
    const section = result.sections.find((s) => s.displayName === 'Stuff I Know')
    expect(section?.sectionType).toBe('skills')
    expect(section?.skillRows).toEqual([
      { categoryName: '', skills: ['Python', 'JavaScript', 'Go', 'Rust'] },
      { categoryName: '', skills: ['Docker', 'Kubernetes', 'AWS'] },
    ])
  })

  it('detects a larger-font non-keyword header and confirms entries via a single (non-range) date', () => {
    const section = result.sections.find((s) => s.displayName === 'Selected Projects')
    expect(section?.sectionType).toBe('entries')
    expect(section?.entries).toEqual([
      {
        fields: { title: 'Resume Parser Tool', organization: '', startDate: 'Mar 2023', endDate: '', location: '' },
        bullets: ['Built a heuristic PDF parser', 'Wrote 40+ deterministic tests'],
      },
    ])
  })
})

describe('extractParsedResume — edge cases', () => {
  it('returns empty output for no text items', () => {
    expect(extractParsedResume([])).toEqual({ basicInfo: { name: '', email: '', phone: '', location: '', links: [] }, sections: [] })
  })

  it('never mistakes an all-caps name for a section header', () => {
    const items = buildItems([
      { text: 'JANE SMITH', fontSize: 18 },
      { text: 'jane@example.com' },
      { text: 'EXPERIENCE', fontSize: 13, gapBefore: 32 },
      { text: 'Engineer Jan 2020 - Present' },
      { text: '• Did engineering things' },
    ])

    const result = extractParsedResume(items)
    expect(result.basicInfo.name).toBe('JANE SMITH')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].displayName).toBe('Experience')
  })

  it('treats a whole resume with no recognizable section header as pure preamble, not a crash', () => {
    const items = buildItems([{ text: 'Just a name', fontSize: 14 }, { text: 'some body text' }])
    const result = extractParsedResume(items)
    expect(result.sections).toEqual([])
    expect(result.basicInfo.name).toBe('Just a name')
  })

  it('keeps a flat tech-stack line intact in organization instead of splitting it in half into location', () => {
    // Regression test: a job's "tech stack" line (6 comma-separated entries) was
    // getting mechanically chopped by the old "last two segments = location"
    // rule, scattering skills across the organization AND location cells.
    const items = buildItems([
      { text: 'Jordan Lee', fontSize: 18 },
      { text: 'jordan@example.com' },
      { text: 'EXPERIENCE', fontSize: 13, gapBefore: 32 },
      { text: 'Software Engineer Intern May 2026 -- Aug 2026' },
      { text: 'Kubernetes, Java, Spring Boot, MongoDB, Angular, TypeScript' },
      { text: '• Built things' },
    ])

    const result = extractParsedResume(items)
    const entry = result.sections[0].entries[0]
    expect(entry.fields.organization).toBe('Kubernetes, Java, Spring Boot, MongoDB, Angular, TypeScript')
    expect(entry.fields.location).toBe('')
  })
})
