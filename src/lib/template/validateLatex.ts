/**
 * Commands that enable file I/O or shell execution — never permitted in
 * user-authored LaTeX fragments, regardless of what a future compile step
 * might otherwise allow. Matches architecture.md §7's "shell-escape stays
 * disabled" guarantee with a client-side backstop.
 */
const DISALLOWED_COMMANDS = [
  'write18',
  'write',
  'immediate',
  'input',
  'include',
  'openin',
  'openout',
  'closein',
  'closeout',
  'read',
  'catcode',
  'csname',
  'special',
  'directlua',
]

function findUnescaped(latex: string, target: '{' | '}' | '$'): number[] {
  const positions: number[] = []
  for (let i = 0; i < latex.length; i++) {
    if (latex[i] === '\\') {
      i++ // skip the escaped character, whatever it is
      continue
    }
    if (latex[i] === target) positions.push(i)
  }
  return positions
}

function checkBalancedBraces(latex: string): string[] {
  let depth = 0
  let unmatchedClosing = 0
  for (const i of findUnescaped(latex, '{').concat(findUnescaped(latex, '}')).sort((a, b) => a - b)) {
    if (latex[i] === '{') depth++
    else if (depth > 0) depth--
    else unmatchedClosing++
  }
  const errors: string[] = []
  if (depth > 0) errors.push(`${depth} unclosed '{' brace${depth === 1 ? '' : 's'}`)
  if (unmatchedClosing > 0) {
    errors.push(`${unmatchedClosing} unmatched '}' with no opening brace${unmatchedClosing === 1 ? '' : 's'}`)
  }
  return errors
}

function checkBalancedMathMode(latex: string): string[] {
  const count = findUnescaped(latex, '$').length
  return count % 2 !== 0 ? ["Unclosed math mode ('$' appears an odd number of times)"] : []
}

function checkBalancedEnvironments(latex: string): string[] {
  const stack: string[] = []
  const errors: string[] = []
  const pattern = /\\(begin|end)\{([^}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(latex))) {
    const [, kind, name] = match
    if (kind === 'begin') {
      stack.push(name)
    } else if (stack.length === 0 || stack.pop() !== name) {
      errors.push(`\\end{${name}} does not match the most recent \\begin{...}`)
    }
  }
  if (stack.length > 0) {
    errors.push(`Unclosed environment${stack.length === 1 ? '' : 's'}: ${stack.map((name) => `\\begin{${name}}`).join(', ')}`)
  }
  return errors
}

function checkDisallowedCommands(latex: string): string[] {
  const found = DISALLOWED_COMMANDS.filter((command) => new RegExp(`\\\\${command}\\b`).test(latex))
  return found.map((command) => `\\${command} is not permitted`)
}

/** Static, client-side LaTeX validation — not a real compile check, just structural + safety guards. */
export function validateLatex(latex: string): string[] {
  return [
    ...checkBalancedBraces(latex),
    ...checkBalancedMathMode(latex),
    ...checkBalancedEnvironments(latex),
    ...checkDisallowedCommands(latex),
  ]
}
