/**
 * Commands that carry no meaningful text of their own — the command and every
 * argument group immediately following it is dropped entirely.
 */
const DENYLIST_COMMANDS = new Set([
  'vspace',
  'hspace',
  'hfill',
  'faIcon',
  'includegraphics',
  'label',
  'resumeItemListStart',
  'resumeItemListEnd',
  'resumeSubHeadingListStart',
  'resumeSubHeadingListEnd',
])

/** Commands whose first argument is a non-text target (e.g. a URL) — only the last argument is kept. */
const KEEP_LAST_ARG_ONLY_COMMANDS = new Set(['href'])

interface BraceGroup {
  content: string
  endIndex: number
}

/** `input[startIndex]` must be `'{'`. Returns its (possibly nested) contents and the index just past the closing brace. */
function extractBraceGroup(input: string, startIndex: number): BraceGroup {
  let depth = 0
  for (let i = startIndex; i < input.length; i++) {
    if (input[i] === '{') depth++
    else if (input[i] === '}') {
      depth--
      if (depth === 0) {
        return { content: input.slice(startIndex + 1, i), endIndex: i + 1 }
      }
    }
  }
  return { content: input.slice(startIndex + 1), endIndex: input.length }
}

/**
 * Brace-balanced LaTeX command stripper. Unwraps text-bearing commands (keeping
 * their argument content), fully removes structural/no-text commands, and
 * un-escapes single-character escapes (`\&`, `\%`, `\$`, `\#`, `\_`, `\{`, `\}`).
 * Survives nesting like `\href{url}{\textbf{text}}`.
 */
export function stripLatexCommands(input: string): string {
  let result = ''
  let i = 0
  while (i < input.length) {
    const char = input[i]

    // An unescaped `%` starts a LaTeX comment to end of line. This must run
    // here — before `\%` escapes are resolved below — so an intentional
    // literal percent sign is never mistaken for a comment marker.
    if (char === '%') {
      const newlineIndex = input.indexOf('\n', i)
      i = newlineIndex === -1 ? input.length : newlineIndex
      continue
    }

    if (char !== '\\') {
      result += char
      i++
      continue
    }

    // `\\` is a LaTeX line break — pure noise.
    if (input[i + 1] === '\\') {
      i += 2
      continue
    }

    let j = i + 1
    while (j < input.length && /[a-zA-Z]/.test(input[j])) j++
    const command = input.slice(i + 1, j)

    // Zero-length command name: a single-character escape like `\&` or `\{`.
    if (command.length === 0) {
      if (j < input.length) {
        result += input[j]
        i = j + 1
      } else {
        i = j
      }
      continue
    }

    i = j
    // Skip optional `[...]` options (e.g. `\includegraphics[width=1in]{...}`).
    while (i < input.length && input[i] === '[') {
      const closeIndex = input.indexOf(']', i)
      i = closeIndex === -1 ? input.length : closeIndex + 1
    }

    const args: string[] = []
    while (i < input.length && input[i] === '{') {
      const group = extractBraceGroup(input, i)
      args.push(group.content)
      i = group.endIndex
    }

    if (DENYLIST_COMMANDS.has(command)) continue

    const keptArgs = KEEP_LAST_ARG_ONLY_COMMANDS.has(command) && args.length > 0 ? [args[args.length - 1]] : args
    for (const arg of keptArgs) {
      result += stripLatexCommands(arg) + ' '
    }
  }
  return result
}

const URL_PATTERN = /\bhttps?:\/\/\S+/gi
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const PHONE_PATTERN = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g

export function stripUrlsEmailsPhones(input: string): string {
  return input.replace(URL_PATTERN, ' ').replace(EMAIL_PATTERN, ' ').replace(PHONE_PATTERN, ' ')
}

const MONTH_NAMES =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
const DATE_PATTERNS = [
  // "January 2020", "Jan 2020"
  new RegExp(`\\b(?:${MONTH_NAMES})\\.?\\s+\\d{4}\\b`, 'gi'),
  // "01/2020", "1/2020"
  /\b\d{1,2}\/\d{4}\b/g,
  // "2020 - 2022", "2020–2022", "2020—Present", "2020-Present"
  new RegExp(`\\b\\d{4}\\s*[-–—]\\s*(?:\\d{4}|present)\\b`, 'gi'),
  // standalone "Present" left over from a stripped range
  /\bpresent\b/gi,
  // bare four-digit years
  /\b(19|20)\d{2}\b/g,
]

export function stripDates(input: string): string {
  return DATE_PATTERNS.reduce((text, pattern) => text.replace(pattern, ' '), input)
}

export function stripLayoutGlyphs(input: string): string {
  return input
    .replace(/\$\|\$/g, ' ') // Jake's-Resume-style " $|$ " separators
    .replace(/[|•]/g, ' ')
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

/** Full pipeline: subtraction-only noise stripping, keeping everything else verbatim. */
export function stripNoise(input: string): string {
  return normalizeWhitespace(stripLayoutGlyphs(stripDates(stripUrlsEmailsPhones(stripLatexCommands(input)))))
}
