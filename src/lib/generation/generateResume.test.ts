import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateResume } from './generateResume'
import { compileLatex } from '../firebase/functionsApi'
import { newResumeDbDocId, setResumeDbDoc } from '../firebase/firestoreCollection'
import { getOrComputeEmbedding } from '../ai/getOrComputeEmbedding'
import type { ResumeTemplate } from '../../types/template'
import type { Bullet, Entry, Section } from '../../types/resumeDb'

vi.mock('../firebase/functionsApi', () => ({ compileLatex: vi.fn() }))
vi.mock('../firebase/firestoreCollection', () => ({
  newResumeDbDocId: vi.fn(),
  setResumeDbDoc: vi.fn(),
}))
vi.mock('../ai/getOrComputeEmbedding', () => ({ getOrComputeEmbedding: vi.fn() }))

const mockedCompileLatex = vi.mocked(compileLatex)
const mockedNewResumeDbDocId = vi.mocked(newResumeDbDocId)
const mockedSetResumeDbDoc = vi.mocked(setResumeDbDoc)
const mockedGetOrComputeEmbedding = vi.mocked(getOrComputeEmbedding)

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

const section: Section = {
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
}

const entry: Entry = {
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
}

const bullet: Bullet = {
  id: 'b1',
  entryId: 'e1',
  sectionId: 's1',
  text: 'Did a thing',
  latex: '\\item{Did a thing}',
  isLatexOverridden: false,
  semanticText: '',
  semanticTextHash: '',
  embedding: null,
  mustInclude: false,
  order: 0,
  createdAt: TS,
  updatedAt: TS,
}

describe('generateResume', () => {
  beforeEach(() => {
    mockedCompileLatex.mockReset()
    mockedNewResumeDbDocId.mockReset().mockReturnValue('resume-1')
    mockedSetResumeDbDoc.mockReset().mockResolvedValue(undefined)
    mockedGetOrComputeEmbedding.mockReset().mockResolvedValue([1, 0])
  })

  it('compiles once and saves the record when the first compile already fits', async () => {
    mockedCompileLatex.mockResolvedValue({ pdfStoragePath: 'users/u1/generatedPdfs/resume-1.pdf', pageCount: 1 })

    const result = await generateResume({
      uid: 'u1',
      jobDescriptionText: 'Looking for a software engineer',
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets: [bullet],
      skillRows: [],
      skills: [],
    })

    expect(mockedCompileLatex).toHaveBeenCalledTimes(1)
    expect(result.pageCount).toBe(1)
    expect(result.resumeId).toBe('resume-1')
    expect(result.includedItemIds.bullets).toEqual(['b1'])
    expect(mockedSetResumeDbDoc).toHaveBeenCalledWith(
      'u1',
      'generatedResumes',
      'resume-1',
      expect.objectContaining({ pageCount: 1, pdfStoragePath: 'users/u1/generatedPdfs/resume-1.pdf' }),
    )
  })

  it('drops another item and recompiles when the real compile overflows the page budget', async () => {
    mockedCompileLatex
      .mockResolvedValueOnce({ pdfStoragePath: 'users/u1/generatedPdfs/resume-1.pdf', pageCount: 2 })
      .mockResolvedValueOnce({ pdfStoragePath: 'users/u1/generatedPdfs/resume-1.pdf', pageCount: 1 })

    const result = await generateResume({
      uid: 'u1',
      jobDescriptionText: 'Looking for a software engineer',
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets: [bullet],
      skillRows: [],
      skills: [],
    })

    expect(mockedCompileLatex).toHaveBeenCalledTimes(2)
    expect(result.pageCount).toBe(1)
    // The only removable bullet was dropped on the correction pass.
    expect(result.includedItemIds.bullets).toEqual([])
  })

  it('stops correcting after the max iterations even if still over budget', async () => {
    mockedCompileLatex.mockResolvedValue({ pdfStoragePath: 'users/u1/generatedPdfs/resume-1.pdf', pageCount: 5 })

    const result = await generateResume({
      uid: 'u1',
      jobDescriptionText: 'Looking for a software engineer',
      template,
      basicInfo: null,
      sections: [section],
      entries: [{ ...entry, mustInclude: true }],
      bullets: [{ ...bullet, mustInclude: true }],
      skillRows: [],
      skills: [],
    })

    // mustInclude entry/bullet — nothing removable, so it gives up after the first attempt.
    expect(mockedCompileLatex).toHaveBeenCalledTimes(1)
    expect(result.pageCount).toBe(5)
  })

  it('embeds the job description text with a content-addressed cache key', async () => {
    mockedCompileLatex.mockResolvedValue({ pdfStoragePath: 'p', pageCount: 1 })

    await generateResume({
      uid: 'u1',
      jobDescriptionText: '  Some job description  ',
      template,
      basicInfo: null,
      sections: [],
      entries: [],
      bullets: [],
      skillRows: [],
      skills: [],
    })

    expect(mockedGetOrComputeEmbedding).toHaveBeenCalledWith(
      expect.stringMatching(/^u1:jd:/),
      'Some job description',
    )
  })

  it('still generates (with unweighted ranking) when JD embedding fails, instead of throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockedGetOrComputeEmbedding.mockRejectedValue(new Error('worker unavailable'))
    mockedCompileLatex.mockResolvedValue({ pdfStoragePath: 'p', pageCount: 1 })

    const result = await generateResume({
      uid: 'u1',
      jobDescriptionText: 'Some job description',
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets: [bullet],
      skillRows: [],
      skills: [],
    })

    expect(result.pageCount).toBe(1)
    expect(result.warnings).toMatch(/ranking was skipped/)
    warnSpy.mockRestore()
  })

  it('defaults sectionOrderMode to fixed and persists whatever mode was used', async () => {
    mockedCompileLatex.mockResolvedValue({ pdfStoragePath: 'p', pageCount: 1 })

    await generateResume({
      uid: 'u1',
      jobDescriptionText: 'Looking for a software engineer',
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets: [bullet],
      skillRows: [],
      skills: [],
    })

    expect(mockedSetResumeDbDoc).toHaveBeenCalledWith(
      'u1',
      'generatedResumes',
      'resume-1',
      expect.objectContaining({ sectionOrderMode: 'fixed' }),
    )
  })

  it('reorders sections by relevance when sectionOrderMode is aiOptimized, without touching entry/bullet order', async () => {
    mockedCompileLatex.mockResolvedValue({ pdfStoragePath: 'p', pageCount: 1 })
    mockedGetOrComputeEmbedding.mockResolvedValue([1, 0]) // jd embedding

    const lowSection: Section = { ...section, id: 's-low', order: 0 }
    const highSection: Section = { ...section, id: 's-high', order: 1 }
    // orthogonal → score 0
    const lowEntry: Entry = { ...entry, id: 'e-low', sectionId: 's-low', embedding: [0, 1], latex: '\\entry{LowEntry}\n{{BULLETS}}' }
    // parallel → score 1
    const highEntry: Entry = { ...entry, id: 'e-high', sectionId: 's-high', embedding: [1, 0], latex: '\\entry{HighEntry}\n{{BULLETS}}' }

    const result = await generateResume({
      uid: 'u1',
      jobDescriptionText: 'Looking for a software engineer',
      template,
      basicInfo: null,
      sections: [lowSection, highSection],
      entries: [lowEntry, highEntry],
      bullets: [],
      skillRows: [],
      skills: [],
      sectionOrderMode: 'aiOptimized',
    })

    const highIndex = result.generatedLatex.indexOf('HighEntry')
    const lowIndex = result.generatedLatex.indexOf('LowEntry')
    expect(highIndex).toBeGreaterThanOrEqual(0)
    expect(highIndex).toBeLessThan(lowIndex)
    expect(mockedSetResumeDbDoc).toHaveBeenCalledWith(
      'u1',
      'generatedResumes',
      'resume-1',
      expect.objectContaining({ sectionOrderMode: 'aiOptimized' }),
    )
  })

  it('warns when the result comes in under the configured minimum page count', async () => {
    mockedCompileLatex.mockResolvedValue({ pdfStoragePath: 'p', pageCount: 1 })

    const result = await generateResume({
      uid: 'u1',
      jobDescriptionText: 'Looking for a software engineer',
      template,
      basicInfo: null,
      sections: [section],
      entries: [entry],
      bullets: [bullet],
      skillRows: [],
      skills: [],
      minPages: 2,
    })

    expect(result.warnings).toMatch(/under your target minimum of 2/)
  })
})
