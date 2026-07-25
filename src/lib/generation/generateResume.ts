import { normalizeWhitespace } from '../semantic/ruleBasedExtractor'
import { hashText } from '../semantic/hashText'
import { getOrComputeEmbedding } from '../ai/getOrComputeEmbedding'
import { fitToPageConstraints, removeLowestScoringOptionalItem, pruneEmptySections } from '../ranking/knapsack'
import type { IncludedItemIds } from '../ranking/knapsack'
import { renderTemplate, type RenderTemplateData } from '../template/renderTemplate'
import { compileLatex } from '../firebase/functionsApi'
import { newResumeDbDocId, setResumeDbDoc } from '../firebase/firestoreCollection'
import type { ResumeTemplate } from '../../types/template'
import type { BasicInfo, Bullet, Entry, PageConstraints, Section, Skill, SkillRow } from '../../types/resumeDb'

/** M6 owns the page-constraint settings UI; until then every generation targets a single page. */
export const DEFAULT_PAGE_CONSTRAINTS: PageConstraints = {
  minPages: 1,
  maxPages: 1,
  minTopMarginIn: 0.5,
  maxTopMarginIn: 1,
  sideMarginIn: 0.5,
}

/** "Estimate, compile, and correct" — at most this many extra removal+recompile rounds if Tectonic disagrees with the heuristic. */
const MAX_CORRECTION_ITERATIONS = 2

export interface GenerateResumeInput {
  uid: string
  jobDescriptionText: string
  template: ResumeTemplate
  basicInfo: BasicInfo | null
  sections: Section[]
  entries: Entry[]
  bullets: Bullet[]
  skillRows: SkillRow[]
  skills: Skill[]
  maxPages?: number
}

export interface GenerateResumeResult {
  resumeId: string
  pdfStoragePath: string
  pageCount: number
  generatedLatex: string
  includedItemIds: IncludedItemIds
  warnings?: string
}

function filterData(input: GenerateResumeInput, ids: IncludedItemIds): RenderTemplateData {
  return {
    basicInfo: input.basicInfo,
    sections: input.sections.filter((section) => ids.sections.includes(section.id)),
    entries: input.entries.filter((entry) => ids.entries.includes(entry.id)),
    bullets: input.bullets.filter((bullet) => ids.bullets.includes(bullet.id)),
    skillRows: input.skillRows,
    skills: input.skills.filter((skill) => ids.skills.includes(skill.id)),
  }
}

/**
 * Full pipeline: embed the JD, deterministically fit resume content to the
 * page budget, compile via the Cloud Function, and correct (drop more
 * content, recompile) if the real compile disagrees with the client-side
 * page-count heuristic. Saves a GeneratedResume record on success.
 */
export async function generateResume(input: GenerateResumeInput): Promise<GenerateResumeResult> {
  const maxPages = input.maxPages ?? DEFAULT_PAGE_CONSTRAINTS.maxPages
  const jdSemanticText = normalizeWhitespace(input.jobDescriptionText)
  const jdHash = hashText(jdSemanticText)

  // Same resilience as computeSemanticFields.ts: embedding depends on a Web
  // Worker + model download, which can fail. An empty vector makes every
  // relevance score 0 (neutral) instead of blocking generation entirely.
  let jdEmbedding: number[] = []
  let embeddingWarning: string | undefined
  try {
    jdEmbedding = await getOrComputeEmbedding(`${input.uid}:jd:${jdHash}`, jdSemanticText)
  } catch (err) {
    console.warn('JD embedding failed; ranking will be unweighted for this generation.', err)
    embeddingWarning =
      'Could not compute a job-description embedding, so content ranking was skipped for this generation.'
  }

  const fit = fitToPageConstraints({
    template: input.template,
    basicInfo: input.basicInfo,
    sections: input.sections,
    entries: input.entries,
    bullets: input.bullets,
    skillRows: input.skillRows,
    skills: input.skills,
    jdEmbedding,
    maxPages,
  })

  const resumeId = newResumeDbDocId(input.uid, 'generatedResumes')
  let includedItemIds = fit.includedItemIds
  let generatedLatex = renderTemplate(input.template, filterData(input, includedItemIds))
  let compileResult = await compileLatex(generatedLatex, resumeId)

  for (let attempt = 0; attempt < MAX_CORRECTION_ITERATIONS && compileResult.pageCount > maxPages; attempt++) {
    const next = removeLowestScoringOptionalItem(
      includedItemIds,
      { entries: input.entries, bullets: input.bullets, skills: input.skills },
      fit.scoreBreakdown,
    )
    if (next === includedItemIds) break // nothing left to drop
    includedItemIds = pruneEmptySections(next, {
      sections: input.sections,
      entries: input.entries,
      skillRows: input.skillRows,
      skills: input.skills,
    })
    generatedLatex = renderTemplate(input.template, filterData(input, includedItemIds))
    compileResult = await compileLatex(generatedLatex, resumeId)
  }

  await setResumeDbDoc(input.uid, 'generatedResumes', resumeId, {
    jobDescriptionText: input.jobDescriptionText,
    jdSemanticText,
    templateId: input.template.id,
    sectionOrderMode: 'fixed',
    generatedLatex,
    pdfStoragePath: compileResult.pdfStoragePath,
    pageCount: compileResult.pageCount,
    includedItemIds,
    scoreBreakdown: fit.scoreBreakdown,
  })

  const warnings = [embeddingWarning, compileResult.warnings].filter(Boolean).join(' ') || undefined

  return {
    resumeId,
    pdfStoragePath: compileResult.pdfStoragePath,
    pageCount: compileResult.pageCount,
    generatedLatex,
    includedItemIds,
    warnings,
  }
}
