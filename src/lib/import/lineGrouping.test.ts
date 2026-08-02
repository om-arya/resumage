import { describe, expect, it } from 'vitest'
import { groupIntoLines } from './lineGrouping'
import type { ResumeTextItem } from '../firebase/functionsApi'

function item(overrides: Partial<ResumeTextItem>): ResumeTextItem {
  return { text: '', x: 0, y: 0, width: 0, fontSize: 10, page: 1, ...overrides }
}

describe('groupIntoLines', () => {
  it('joins same-line fragments left to right, inserting a space across a real gap', () => {
    const items = [
      item({ text: 'Software', x: 0, width: 60, y: 100 }),
      item({ text: 'Engineer', x: 65, width: 60, y: 100 }), // gap after "Software" ⇒ needs a space
    ]

    expect(groupIntoLines(items)).toEqual([
      { page: 1, y: 100, x: 0, fontSize: 10, text: 'Software Engineer' },
    ])
  })

  it('does not double a space that is already embedded in a fragment', () => {
    const items = [item({ text: 'Software ', x: 0, width: 65, y: 100 }), item({ text: 'Engineer', x: 65, width: 60, y: 100 })]

    expect(groupIntoLines(items)[0].text).toBe('Software Engineer')
  })

  it('concatenates directly when fragments are flush (e.g. a bold run mid-word)', () => {
    const items = [item({ text: 'Java', x: 0, width: 30, y: 100 }), item({ text: 'Script', x: 30, width: 40, y: 100 })]

    expect(groupIntoLines(items)[0].text).toBe('JavaScript')
  })

  it('starts a new line when y differs beyond tolerance', () => {
    const items = [item({ text: 'Line one', y: 100 }), item({ text: 'Line two', y: 88 })]

    const lines = groupIntoLines(items)
    expect(lines).toHaveLength(2)
    expect(lines[0].text).toBe('Line one')
    expect(lines[1].text).toBe('Line two')
  })

  it('treats near-equal y (sub-pixel float noise) as the same line', () => {
    const items = [item({ text: 'Line', x: 0, width: 20, y: 100.4 }), item({ text: 'one', x: 22, width: 20, y: 99.8 })]

    expect(groupIntoLines(items)).toHaveLength(1)
  })

  it('keeps pages separate even if y coordinates coincide', () => {
    const items = [item({ text: 'Page one line', y: 100, page: 1 }), item({ text: 'Page two line', y: 100, page: 2 })]

    const lines = groupIntoLines(items)
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.page)).toEqual([1, 2])
  })

  it('orders lines top-to-bottom regardless of input order', () => {
    const items = [item({ text: 'Bottom', y: 50 }), item({ text: 'Top', y: 200 }), item({ text: 'Middle', y: 125 })]

    expect(groupIntoLines(items).map((l) => l.text)).toEqual(['Top', 'Middle', 'Bottom'])
  })

  it('drops whitespace-only items and trims the result', () => {
    const items = [item({ text: '  ', y: 100 }), item({ text: 'Real text', y: 90 })]

    expect(groupIntoLines(items)).toEqual([{ page: 1, y: 90, x: 0, fontSize: 10, text: 'Real text' }])
  })

  it('takes the largest font size among a line\'s fragments', () => {
    const items = [item({ text: 'Big ', x: 0, width: 20, fontSize: 16, y: 100 }), item({ text: 'small', x: 22, width: 30, fontSize: 10, y: 100 })]

    expect(groupIntoLines(items)[0].fontSize).toBe(16)
  })
})
