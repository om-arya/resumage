import { describe, expect, it } from 'vitest'
import { selectActiveTemplate } from './templatesStore'
import { JAKES_RESUME_TEMPLATE } from '../lib/template/jakesResumeTemplate'
import type { ResumeTemplate } from '../types/template'

const custom: ResumeTemplate = { ...JAKES_RESUME_TEMPLATE, id: 'custom-1', name: 'Custom' }

describe('selectActiveTemplate', () => {
  it('returns the template matching activeTemplateId', () => {
    const result = selectActiveTemplate({
      templates: [JAKES_RESUME_TEMPLATE, custom],
      activeTemplateId: 'custom-1',
    })
    expect(result).toBe(custom)
  })

  it('falls back to the seed constant when no template matches (e.g. still loading)', () => {
    const result = selectActiveTemplate({
      templates: [],
      activeTemplateId: null,
    })
    expect(result).toBe(JAKES_RESUME_TEMPLATE)
  })

  it('falls back to the seed constant when activeTemplateId points at a missing template', () => {
    const result = selectActiveTemplate({
      templates: [custom],
      activeTemplateId: 'does-not-exist',
    })
    expect(result).toBe(JAKES_RESUME_TEMPLATE)
  })
})
