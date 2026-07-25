import { describe, expect, it } from 'vitest'
import { validateLatex } from './validateLatex'

describe('validateLatex', () => {
  it('accepts well-formed LaTeX with no errors', () => {
    expect(validateLatex(String.raw`\resumeItem{Improved throughput by 20\%}`)).toEqual([])
  })

  it('accepts an empty string', () => {
    expect(validateLatex('')).toEqual([])
  })

  it('flags unclosed opening braces', () => {
    const errors = validateLatex(String.raw`\textbf{Engineer`)
    expect(errors).toEqual(['1 unclosed \'{\' brace'])
  })

  it('flags an unmatched closing brace', () => {
    const errors = validateLatex(String.raw`Engineer}`)
    expect(errors).toEqual(["1 unmatched '}' with no opening brace"])
  })

  it('does not count escaped braces toward balance', () => {
    expect(validateLatex(String.raw`Literal \{ and \}`)).toEqual([])
  })

  it('flags an odd number of math-mode $ delimiters', () => {
    expect(validateLatex('Revenue grew $50k')).toEqual([
      "Unclosed math mode ('$' appears an odd number of times)",
    ])
  })

  it('accepts balanced $...$ math mode', () => {
    expect(validateLatex('Revenue grew $50k$ this year')).toEqual([])
  })

  it('accepts a matching \\begin/\\end environment pair', () => {
    expect(validateLatex(String.raw`\begin{itemize}\item{a}\end{itemize}`)).toEqual([])
  })

  it('flags a mismatched environment name', () => {
    const errors = validateLatex(String.raw`\begin{itemize}\end{enumerate}`)
    expect(errors).toContain('\\end{enumerate} does not match the most recent \\begin{...}')
  })

  it('flags an unclosed environment', () => {
    const errors = validateLatex(String.raw`\begin{itemize}\item{a}`)
    expect(errors).toContain('Unclosed environment: \\begin{itemize}')
  })

  it('flags \\write18 (shell escape)', () => {
    expect(validateLatex(String.raw`\write18{rm -rf /}`)).toContain('\\write18 is not permitted')
  })

  it('flags \\input and \\include', () => {
    const errors = validateLatex(String.raw`\input{secrets} \include{other}`)
    expect(errors).toContain('\\input is not permitted')
    expect(errors).toContain('\\include is not permitted')
  })

  it('does not false-positive on a longer command sharing a disallowed prefix', () => {
    expect(validateLatex(String.raw`\includegraphics{logo.png}`)).toEqual([])
  })

  it('collects multiple independent errors at once', () => {
    const errors = validateLatex(String.raw`\write18{evil} \textbf{unclosed`)
    expect(errors.length).toBeGreaterThan(1)
  })
})
