import { extractParsedResume } from './heuristicResumeExtractor'
import type { ResumeParserProvider } from './provider'

export const heuristicResumeParser: ResumeParserProvider = {
  async parseResume(items) {
    return extractParsedResume(items)
  },
}

export function getResumeParserProvider(): ResumeParserProvider {
  return heuristicResumeParser
}
