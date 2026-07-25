const LATEX_SPECIAL_CHARS: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
}

/** Escapes plain-text form-field input for safe insertion into generated LaTeX. */
export function escapeLatex(input: string): string {
  return input.replace(/[\\&%$#_{}~^]/g, (char) => LATEX_SPECIAL_CHARS[char] ?? char)
}
