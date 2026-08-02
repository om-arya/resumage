import { groupIntoLines, type Line } from './lineGrouping'
import { containsDate, extractDateRange } from './dateExtraction'
import type { EntryFields, SectionType } from '../../types/resumeDb'
import type { ParsedBasicInfoFields, ParsedEntry, ParsedResume, ParsedSection, ParsedSkillRow } from './types'
import type { ResumeTextItem } from '../firebase/functionsApi'

const EMPTY_BASIC_INFO: ParsedBasicInfoFields = { name: '', email: '', phone: '', location: '', links: [] }

const BULLET_GLYPH_PATTERN = /^[•●▪◦‣∙○*·-]\s+/
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE_PATTERN = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
const URL_PATTERN = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?\b/i

const SECTION_KEYWORDS: { pattern: RegExp; sectionType: SectionType }[] = [
  { pattern: /^(work\s+)?experience$/i, sectionType: 'entries' },
  { pattern: /^employment(\s+history)?$/i, sectionType: 'entries' },
  { pattern: /^education$/i, sectionType: 'entries' },
  { pattern: /^projects?$/i, sectionType: 'entries' },
  { pattern: /^volunteer(ing)?(\s+experience)?$/i, sectionType: 'entries' },
  { pattern: /^leadership(\s+experience)?$/i, sectionType: 'entries' },
  { pattern: /^publications?$/i, sectionType: 'entries' },
  { pattern: /^certifications?$/i, sectionType: 'entries' },
  { pattern: /^(awards?|honors?)(\s*(and|&)\s*(awards?|honors?))?$/i, sectionType: 'entries' },
  { pattern: /^(technical\s+)?skills?$/i, sectionType: 'skills' },
  { pattern: /^(technologies|tech\s+stack|tools?)$/i, sectionType: 'skills' },
  { pattern: /^languages?$/i, sectionType: 'skills' },
  { pattern: /^interests?(\s*(and|&)\s*hobbies)?$/i, sectionType: 'skills' },
]

function stripBulletGlyph(text: string): string | null {
  const match = text.match(BULLET_GLYPH_PATTERN)
  return match ? text.slice(match[0].length).trim() : null
}

function computeBodyFontSize(lines: Line[]): number {
  const counts = new Map<number, number>()
  for (const line of lines) {
    const bucket = Math.round(line.fontSize * 2) / 2
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }
  let mode = 0
  let modeCount = 0
  for (const [size, count] of counts) {
    if (count > modeCount) {
      mode = size
      modeCount = count
    }
  }
  return mode || 10
}

function computeTypicalLineGap(lines: Line[]): number {
  const gaps: number[] = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].page !== lines[i - 1].page) continue
    const gap = lines[i - 1].y - lines[i].y
    if (gap > 0) gaps.push(gap)
  }
  if (gaps.length === 0) return 12
  gaps.sort((a, b) => a - b)
  return gaps[Math.floor(gaps.length / 2)]
}

type HeaderMatch =
  | { isHeader: false }
  | { isHeader: true; sectionType: SectionType; confidence: 'known' | 'guessed' }

/**
 * Known section names are trusted outright. Anything else only counts as a
 * header if it's short, isn't a bullet, and looks visually distinct (larger
 * than body text, or fully capitalized) — the common tells across resume
 * styles regardless of what the section is actually called.
 *
 * `maxFontSize` guards against the single most common false positive: a
 * resume's own name is very often the largest (and sometimes all-caps) text
 * on the page — larger than any section header — so the line carrying the
 * document's max font size is never guessed as a header, only ever matched
 * via a known keyword.
 */
function matchSectionHeader(line: Line, bodyFontSize: number, maxFontSize: number): HeaderMatch {
  const trimmed = line.text.trim()
  const known = SECTION_KEYWORDS.find(({ pattern }) => pattern.test(trimmed))
  if (known) return { isHeader: true, sectionType: known.sectionType, confidence: 'known' }

  if (BULLET_GLYPH_PATTERN.test(line.text)) return { isHeader: false }
  if (line.fontSize >= maxFontSize) return { isHeader: false }
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (wordCount === 0 || wordCount > 5) return { isHeader: false }

  const isLargerFont = line.fontSize >= bodyFontSize * 1.08
  const isAllCaps = /[A-Z]/.test(trimmed) && trimmed === trimmed.toUpperCase()
  if (isLargerFont || isAllCaps) {
    return { isHeader: true, sectionType: 'entries', confidence: 'guessed' }
  }
  return { isHeader: false }
}

/** For a header matched only by visual guesswork, sniff its content to correct entries-vs-skills. */
function refineGuessedSectionType(contentLines: Line[]): SectionType {
  if (contentLines.length === 0) return 'entries'
  if (contentLines.some((line) => containsDate(line.text))) return 'entries'
  const looksLikeSkillsList = contentLines.every((line) => {
    const text = stripBulletGlyph(line.text) ?? line.text
    return text.includes(':') || text.split(/[,;]/).length >= 2
  })
  return looksLikeSkillsList ? 'skills' : 'entries'
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

const TITLE_ORG_SEPARATORS = [/\s+at\s+/i, /\s*[|]\s*/, /\s*[—–]\s*/, /\s*,\s*/]

function splitTitleOrganization(text: string): { title: string; organization: string } {
  for (const separator of TITLE_ORG_SEPARATORS) {
    const parts = text.split(separator)
    if (parts.length >= 2 && parts[0].trim() && parts.slice(1).join('').trim()) {
      return { title: parts[0].trim(), organization: parts.slice(1).join(', ').trim() }
    }
  }
  return { title: text.trim(), organization: '' }
}

/**
 * "Organization, City, ST" is the overwhelmingly common comma-separated shape
 * for an entry's second line — so rather than guess where a location "starts"
 * with a regex, just split on commas: 2 segments is "Org, Location", 3 is
 * "Org, City, State/Country" (last two segments form the location).
 *
 * 4+ segments stops being plausible as "Org, City, State" — at that point it's
 * far more likely a flat comma list (a tech-stack/skills-used line some resumes
 * put under a job title), and mechanically taking "the last two segments" would
 * chop that list in half and scatter it across the organization/location cells.
 * Keep it together as one field instead — wrong field, but at least intact and
 * easy to fix in review, instead of silently corrupted.
 */
function splitOrganizationLocation(text: string): { organization: string; location: string } {
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 2) return { organization: parts[0], location: parts[1] }
  if (parts.length === 3) return { organization: parts.slice(0, -2).join(', '), location: parts.slice(-2).join(', ') }
  return { organization: text.trim(), location: '' }
}

/** One entry's title/org/dates/location from the 1+ lines above its bullets (or above the next entry, if bulletless). */
function parseEntryHeader(headerLines: Line[]): EntryFields {
  const combined = headerLines.map((line) => line.text).join(' ')
  const { startDate, endDate } = extractDateRange(combined)

  const linesWithoutDates = headerLines.map((line) => extractDateRange(line.text).remaining).filter(Boolean)
  const primary = linesWithoutDates[0] ?? ''
  const secondary = linesWithoutDates.slice(1).join(', ')

  const { title, organization: organizationFromPrimary } = splitTitleOrganization(primary)
  const { organization, location } = splitOrganizationLocation(organizationFromPrimary || secondary)

  return { title, organization, startDate, endDate, location }
}

/**
 * Groups an "entries" section's lines into entries. A run of bullet lines
 * always belongs to whichever entry is currently open; a non-bullet line
 * starts a new entry only when it's separated from the previous line by a
 * bigger-than-typical vertical gap — the same visual cue a reader uses,
 * and it works whether or not an entry actually has bullets.
 */
function parseEntriesSection(lines: Line[], typicalGap: number): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  let headerLines: Line[] = []
  let bulletLines: string[] = []
  let previousLine: Line | null = null

  function flush() {
    if (headerLines.length === 0 && bulletLines.length === 0) return
    entries.push({ fields: parseEntryHeader(headerLines), bullets: bulletLines })
    headerLines = []
    bulletLines = []
  }

  const ENTRY_GAP_RATIO = 1.5
  for (const line of lines) {
    const bulletText = stripBulletGlyph(line.text)
    if (bulletText !== null) {
      if (bulletText.length > 0) bulletLines.push(bulletText)
      previousLine = line
      continue
    }

    const gap = previousLine && previousLine.page === line.page ? previousLine.y - line.y : Number.POSITIVE_INFINITY
    if (gap > typicalGap * ENTRY_GAP_RATIO) flush()
    headerLines.push(line)
    previousLine = line
  }
  flush()

  return entries
}

function parseSkillsSection(lines: Line[]): ParsedSkillRow[] {
  const rows: ParsedSkillRow[] = []
  for (const line of lines) {
    const text = stripBulletGlyph(line.text) ?? line.text
    const colonIndex = text.indexOf(':')
    const categoryName = colonIndex !== -1 ? text.slice(0, colonIndex).trim() : ''
    const skillsText = colonIndex !== -1 ? text.slice(colonIndex + 1) : text
    const skills = skillsText
      .split(/[,•|;]/)
      .map((skill) => skill.trim())
      .filter(Boolean)
    if (skills.length > 0) rows.push({ categoryName, skills })
  }
  return rows
}

function parseBasicInfo(preambleLines: Line[]): ParsedBasicInfoFields {
  if (preambleLines.length === 0) return EMPTY_BASIC_INFO

  const name = [...preambleLines].sort((a, b) => b.fontSize - a.fontSize)[0].text.trim()
  const combined = preambleLines.map((line) => line.text).join(' ')
  const email = combined.match(EMAIL_PATTERN)?.[0] ?? ''
  const phone = combined.match(PHONE_PATTERN)?.[0] ?? ''

  const links: { label: string; url: string }[] = []
  for (const match of combined.matchAll(new RegExp(URL_PATTERN, 'gi'))) {
    const url = match[0]
    // The domain half of an email address (e.g. "example.com" in "john@example.com")
    // matches the URL pattern too — don't surface it as a second, bogus link.
    if (email && email.includes(url)) continue
    const label = url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
    links.push({ label, url: url.startsWith('http') ? url : `https://${url}` })
  }

  const remainderLine = preambleLines.find(
    (line) =>
      line.text !== name &&
      !line.text.includes(email) &&
      !PHONE_PATTERN.test(line.text) &&
      !URL_PATTERN.test(line.text),
  )
  const location = remainderLine?.text.trim() ?? ''

  return { name, email, phone, location, links }
}

/** Pure orchestration: layout-aware text items in, a fully-structured (still unconfirmed) resume draft out. */
export function extractParsedResume(items: ResumeTextItem[]): ParsedResume {
  const lines = groupIntoLines(items)
  if (lines.length === 0) return { basicInfo: EMPTY_BASIC_INFO, sections: [] }

  const bodyFontSize = computeBodyFontSize(lines)
  const typicalGap = computeTypicalLineGap(lines)
  const maxFontSize = Math.max(...lines.map((line) => line.fontSize))

  let firstHeaderIndex = lines.findIndex((line) => matchSectionHeader(line, bodyFontSize, maxFontSize).isHeader)
  if (firstHeaderIndex === -1) firstHeaderIndex = lines.length

  const basicInfo = parseBasicInfo(lines.slice(0, firstHeaderIndex))

  const sections: ParsedSection[] = []
  let i = firstHeaderIndex
  while (i < lines.length) {
    const headerMatch = matchSectionHeader(lines[i], bodyFontSize, maxFontSize)
    if (!headerMatch.isHeader) {
      i++
      continue
    }

    let j = i + 1
    while (j < lines.length && !matchSectionHeader(lines[j], bodyFontSize, maxFontSize).isHeader) j++
    const contentLines = lines.slice(i + 1, j)

    const sectionType =
      headerMatch.confidence === 'known' ? headerMatch.sectionType : refineGuessedSectionType(contentLines)

    sections.push({
      displayName: titleCase(lines[i].text.trim()),
      sectionType,
      entries: sectionType === 'entries' ? parseEntriesSection(contentLines, typicalGap) : [],
      skillRows: sectionType === 'skills' ? parseSkillsSection(contentLines) : [],
    })
    i = j
  }

  return { basicInfo, sections }
}
