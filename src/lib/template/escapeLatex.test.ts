import { describe, expect, it } from 'vitest'
import { escapeLatex } from './escapeLatex'

describe('escapeLatex', () => {
  it('escapes each LaTeX special character', () => {
    expect(escapeLatex('&%$#_{}~^')).toBe(
      '\\&\\%\\$\\#\\_\\{\\}\\textasciitilde{}\\textasciicircum{}',
    )
  })

  it('escapes backslashes', () => {
    expect(escapeLatex('a\\b')).toBe('a\\textbackslash{}b')
  })

  it('leaves plain text untouched', () => {
    expect(escapeLatex('Software Engineer at Acme')).toBe('Software Engineer at Acme')
  })

  it('handles an empty string', () => {
    expect(escapeLatex('')).toBe('')
  })
})
