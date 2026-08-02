import { MONTH_NAMES } from '../semantic/ruleBasedExtractor'

const DATE_TOKEN = `(?:${MONTH_NAMES})\\.?\\s+\\d{4}|\\d{1,2}\\/\\d{4}|\\b(?:19|20)\\d{2}\\b`
const DATE_RANGE_PATTERN = new RegExp(`(${DATE_TOKEN})\\s*(?:[-–—]|to)\\s*(${DATE_TOKEN}|present)`, 'i')
const SINGLE_DATE_PATTERN = new RegExp(DATE_TOKEN, 'i')

export interface ExtractedDateRange {
  startDate: string
  endDate: string
  /** `text` with the matched date range/token removed, for parsing whatever's left (title, org, etc). */
  remaining: string
}

/**
 * Pulls a date range (or a single trailing date) out of a line of text.
 * Reuses `MONTH_NAMES` from the semantic extractor's date-stripping regexes —
 * same vocabulary, but this captures the match instead of blanking it out.
 */
export function extractDateRange(text: string): ExtractedDateRange {
  const rangeMatch = text.match(DATE_RANGE_PATTERN)
  if (rangeMatch && rangeMatch.index !== undefined) {
    return {
      startDate: rangeMatch[1].trim(),
      endDate: rangeMatch[2].trim(),
      remaining: (text.slice(0, rangeMatch.index) + text.slice(rangeMatch.index + rangeMatch[0].length))
        .replace(/\s+/g, ' ')
        .trim(),
    }
  }

  const singleMatch = text.match(SINGLE_DATE_PATTERN)
  if (singleMatch && singleMatch.index !== undefined) {
    return {
      startDate: singleMatch[0].trim(),
      endDate: '',
      remaining: (text.slice(0, singleMatch.index) + text.slice(singleMatch.index + singleMatch[0].length))
        .replace(/\s+/g, ' ')
        .trim(),
    }
  }

  return { startDate: '', endDate: '', remaining: text }
}

/** Whether `text` contains anything date-shaped — used to decide entries-vs-skills for an unrecognized section header. */
export function containsDate(text: string): boolean {
  return DATE_RANGE_PATTERN.test(text) || SINGLE_DATE_PATTERN.test(text)
}
