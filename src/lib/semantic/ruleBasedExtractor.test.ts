import { describe, expect, it } from 'vitest'
import {
  normalizeWhitespace,
  stripDates,
  stripLatexCommands,
  stripLayoutGlyphs,
  stripNoise,
  stripUrlsEmailsPhones,
} from './ruleBasedExtractor'

describe('stripLatexCommands', () => {
  it('unwraps a simple text-bearing command', () => {
    expect(stripLatexCommands('\\textbf{Software Engineer}')).toBe('Software Engineer ')
  })

  it('survives nesting and keeps only the visible text of \\href', () => {
    expect(stripLatexCommands('\\href{https://example.com}{\\textbf{My Site}}').trim()).toBe('My Site')
  })

  it('keeps all arguments of a multi-arg command like \\resumeSubheading', () => {
    const result = stripLatexCommands('\\resumeSubheading{Engineer}{2020}{Acme}{Remote}')
    expect(result).toContain('Engineer')
    expect(result).toContain('2020')
    expect(result).toContain('Acme')
    expect(result).toContain('Remote')
  })

  it('fully drops denylisted structural commands and their arguments', () => {
    expect(stripLatexCommands('\\vspace{-2pt}text\\hfill\\faIcon{envelope}').trim()).toBe('text')
  })

  it('drops \\\\ line breaks', () => {
    expect(stripLatexCommands('line one\\\\line two').replace(/\s+/g, ' ')).toBe('line oneline two')
  })

  it('un-escapes single-character escapes', () => {
    expect(stripLatexCommands('20\\% increase, R\\&D')).toBe('20% increase, R&D')
  })

  it('strips an unescaped % comment to end of line', () => {
    expect(stripLatexCommands('kept text % this is a comment').trim()).toBe('kept text')
  })

  it('does not treat an escaped \\% as a comment marker', () => {
    expect(stripLatexCommands('40\\% at Acme')).toBe('40% at Acme')
  })
})

describe('stripUrlsEmailsPhones', () => {
  it('strips a URL', () => {
    expect(stripUrlsEmailsPhones('Visit https://example.com/path today')).toBe('Visit   today')
  })

  it('strips an email address', () => {
    expect(stripUrlsEmailsPhones('Contact jane@example.com now')).toBe('Contact   now')
  })

  it('strips a phone number', () => {
    expect(stripUrlsEmailsPhones('Call 555-123-4567 now')).toBe('Call   now')
  })
})

describe('stripDates', () => {
  it('strips a month-year date', () => {
    expect(stripDates('Started January 2020 at Acme').replace(/\s+/g, ' ').trim()).toBe('Started at Acme')
  })

  it('strips a year range', () => {
    expect(stripDates('Acme 2020 - 2022').replace(/\s+/g, ' ').trim()).toBe('Acme')
  })

  it('strips a year-to-present range and leftover "Present"', () => {
    expect(stripDates('Acme 2020-Present').replace(/\s+/g, ' ').trim()).toBe('Acme')
  })

  it('strips a bare four-digit year', () => {
    expect(stripDates('Founded in 2019').replace(/\s+/g, ' ').trim()).toBe('Founded in')
  })
})

describe('stripLayoutGlyphs', () => {
  it('strips the Jake\'s-Resume $|$ separator', () => {
    expect(stripLayoutGlyphs('555-0100 $|$ jane@example.com').replace(/\s+/g, ' ').trim()).toBe(
      '555-0100 jane@example.com',
    )
  })

  it('strips standalone pipes and bullets', () => {
    expect(stripLayoutGlyphs('a | b • c').replace(/\s+/g, ' ').trim()).toBe('a b c')
  })
})

describe('normalizeWhitespace', () => {
  it('collapses repeated whitespace and trims', () => {
    expect(normalizeWhitespace('  a   b\n\nc  ')).toBe('a b c')
  })
})

describe('stripNoise', () => {
  it('runs the full pipeline on a realistic bullet fragment', () => {
    const latex = String.raw`\resumeItem{Improved API latency by 40\% at \href{https://acme.com}{Acme} in January 2020}`
    expect(stripNoise(latex)).toBe('Improved API latency by 40% at Acme in')
  })

  it('handles an empty string', () => {
    expect(stripNoise('')).toBe('')
  })
})
