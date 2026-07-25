import { describe, expect, it } from 'vitest'
import { ruleBasedProvider, getSemanticTextProvider } from './ruleBasedProvider'

describe('ruleBasedProvider', () => {
  it('generateSectionOrBulletSemanticText strips LaTeX noise from the source', async () => {
    const result = await ruleBasedProvider.generateSectionOrBulletSemanticText(
      String.raw`\resumeItem{Cut latency by 30\%}`,
    )
    expect(result).toBe('Cut latency by 30%')
  })

  it('generateSkillSemanticText passes plain text through unchanged', async () => {
    expect(await ruleBasedProvider.generateSkillSemanticText('Python')).toBe('Python')
  })

  it('generateEntrySemanticText composes a header with organization', async () => {
    const result = await ruleBasedProvider.generateEntrySemanticText(
      { title: 'Software Engineer', organization: 'Acme', startDate: '', endDate: '', location: '' },
      ['Built services with Python and React'],
    )
    expect(result).toBe('Software Engineer at Acme. Python, React')
  })

  it('generateEntrySemanticText omits "at" when organization is blank', async () => {
    const result = await ruleBasedProvider.generateEntrySemanticText(
      { title: 'Freelance Developer', organization: '', startDate: '', endDate: '', location: '' },
      [],
    )
    expect(result).toBe('Freelance Developer.')
  })

  it('generateEntrySemanticText omits the keyword list when none are found', async () => {
    const result = await ruleBasedProvider.generateEntrySemanticText(
      { title: 'Camp Counselor', organization: 'Camp Pine', startDate: '', endDate: '', location: '' },
      ['Led a bake sale fundraiser'],
    )
    expect(result).toBe('Camp Counselor at Camp Pine.')
  })
})

describe('getSemanticTextProvider', () => {
  it('returns the rule-based provider', () => {
    expect(getSemanticTextProvider()).toBe(ruleBasedProvider)
  })
})
