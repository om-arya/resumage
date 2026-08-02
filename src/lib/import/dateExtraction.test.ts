import { describe, expect, it } from 'vitest'
import { containsDate, extractDateRange } from './dateExtraction'

describe('extractDateRange', () => {
  it('extracts a "Month YYYY - Month YYYY" range', () => {
    const result = extractDateRange('Software Engineer Jan 2020 - Mar 2022')
    expect(result.startDate).toBe('Jan 2020')
    expect(result.endDate).toBe('Mar 2022')
    expect(result.remaining).toBe('Software Engineer')
  })

  it('extracts a range ending in Present', () => {
    const result = extractDateRange('Engineer, Acme — June 2021 – Present')
    expect(result.startDate).toBe('June 2021')
    expect(result.endDate.toLowerCase()).toBe('present')
  })

  it('extracts a bare-year range', () => {
    const result = extractDateRange('University 2016 - 2020')
    expect(result.startDate).toBe('2016')
    expect(result.endDate).toBe('2020')
    expect(result.remaining).toBe('University')
  })

  it('extracts an MM/YYYY range', () => {
    const result = extractDateRange('01/2019 - 05/2021')
    expect(result.startDate).toBe('01/2019')
    expect(result.endDate).toBe('05/2021')
  })

  it('falls back to a single trailing date when there is no range', () => {
    const result = extractDateRange('AWS Certified Solutions Architect, 2023')
    expect(result.startDate).toBe('2023')
    expect(result.endDate).toBe('')
    expect(result.remaining).toBe('AWS Certified Solutions Architect,')
  })

  it('returns empty dates and the original text unchanged when nothing date-shaped is present', () => {
    const result = extractDateRange('Led a team of 5 engineers')
    expect(result.startDate).toBe('')
    expect(result.endDate).toBe('')
    expect(result.remaining).toBe('Led a team of 5 engineers')
  })
})

describe('containsDate', () => {
  it('detects a range', () => {
    expect(containsDate('2019 - 2021')).toBe(true)
  })

  it('detects a single month/year', () => {
    expect(containsDate('Graduated May 2020')).toBe(true)
  })

  it('returns false for text with no date', () => {
    expect(containsDate('Managed a cross-functional team')).toBe(false)
  })
})
