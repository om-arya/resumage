import type { ResumeTextItem } from '../firebase/functionsApi'

export interface Line {
  page: number
  y: number
  x: number
  fontSize: number
  text: string
}

const SAME_LINE_Y_TOLERANCE = 2
/** A horizontal gap wider than this fraction of the font size gets a space inserted — pdf.js doesn't always embed one between runs. */
const WORD_GAP_RATIO = 0.2

/**
 * Reconstructs visual lines from pdf.js's individual text runs (one run per
 * style/font change within a line, not per line or word — a single visual
 * line is usually several runs). Runs are grouped by near-equal y (PDF y
 * increases upward) and joined left-to-right in x order.
 */
export function groupIntoLines(items: ResumeTextItem[]): Line[] {
  const sorted = [...items]
    .filter((item) => item.text.trim().length > 0)
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)

  const lines: Line[] = []
  let lineEndX = 0

  for (const item of sorted) {
    const current = lines[lines.length - 1]
    const sameLine = current && current.page === item.page && Math.abs(current.y - item.y) <= SAME_LINE_Y_TOLERANCE

    if (current && sameLine) {
      const gap = item.x - lineEndX
      const needsSpace = gap > current.fontSize * WORD_GAP_RATIO
      current.text += needsSpace ? ` ${item.text}` : item.text
      current.fontSize = Math.max(current.fontSize, item.fontSize)
    } else {
      lines.push({ page: item.page, y: item.y, x: item.x, fontSize: item.fontSize, text: item.text })
    }
    lineEndX = item.x + item.width
  }

  return lines
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() }))
    .filter((line) => line.text.length > 0)
}
