/**
 * A ResumeTemplate is pure data: wrapper LaTeX strings with `{{KEY}}` placeholders.
 * No template's structure (Jake's Resume included) is hardcoded in app logic —
 * `generateDefaultLatex`/`renderTemplate` are parameterized by whichever template is active.
 */
export interface ResumeTemplate {
  id: string
  name: string
  latexPreamble: string
  latexPostamble: string
  /** Placeholders: {{HEADER}}, {{SECTIONS}} */
  mainBodyLatex: string
  /** Placeholders: {{SECTION_TITLE}}, {{SECTION_BODY}} — used for 'entries'-type sections. */
  sectionWrapperLatex: string
  /**
   * Same placeholders, used for 'skills'-type sections instead. Split out from
   * sectionWrapperLatex because a skills section's rows are short single lines,
   * not full entries — sharing one wrapper meant either fighting per-row
   * \vspace hacks against list spacing tuned for entries, or reusing the same
   * itemize environment and inheriting its wrong-for-this-content-type spacing.
   */
  skillsSectionWrapperLatex: string
  /** Placeholders: {{TITLE}}, {{ORG}}, {{DATES}}, {{LOCATION}}, {{BULLETS}} */
  entryWrapperLatex: string
  /** Placeholders: {{TEXT}} */
  bulletWrapperLatex: string
  /** Placeholders: {{BULLETS}} (joined, already-wrapped bullet LaTeX) */
  bulletListWrapperLatex: string
  /** Placeholders: {{CATEGORY}}, {{SKILLS_LIST}} */
  skillRowWrapperLatex: string
  /** Joined between individual skill display names inside {{SKILLS_LIST}} */
  skillListSeparator: string
  /** Placeholders: {{NAME}}, {{EMAIL}}, {{PHONE}}, {{LOCATION}}, {{LINKS}} */
  headerWrapperLatex: string
  /** True only for the seeded Jake's Resume default — read-only so it always stays a known-good fallback. Duplicate it to customize. */
  isBuiltIn?: boolean
}
