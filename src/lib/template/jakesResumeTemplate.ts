import type { ResumeTemplate } from '../../types/template'

/**
 * Seeded default template ("Jake's Resume"), represented as data — not code.
 * This is a stand-in for the Firestore-backed template document that
 * Milestone 4 (Template CRUD) will introduce; the shape is already
 * `ResumeTemplate`, so migrating it into Firestore later is a data move,
 * not an app-code change.
 */
export const JAKES_RESUME_TEMPLATE: ResumeTemplate = {
  id: 'jakes-resume',
  name: "Jake's Resume",
  latexPreamble: String.raw`\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage[english]{babel}
\usepackage{tabularx}

\pagestyle{empty}

\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

\newcommand{\resumeItem}[1]{
  \item\small{#1 \vspace{-2pt}}
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{\textwidth}{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
% An explicit Unicode bullet, not itemize's OT1/T1-encoded \textbullet default —
% under Tectonic's XeTeX engine that default's glyph lookup can silently fall
% back to a plain hyphen instead of rendering a round bullet. XeTeX reads UTF-8
% natively, so a literal bullet character here sidesteps the lookup entirely.
\newcommand{\resumeItemListStart}{\begin{itemize}[label=•]}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

% Skill rows are short single lines, not full entries — resumeSubHeadingListStart's
% default itemize spacing (tuned for resumeSubheading's much taller tabular blocks)
% leaves visibly too much gap between them. itemsep/parsep/topsep=0pt makes each
% row's own \item contribute zero extra space, independent of any \vspace tuning.
\newcommand{\resumeSkillsListStart}{\begin{itemize}[leftmargin=0.15in, label={}, itemsep=0pt, parsep=0pt, topsep=0pt]}
\newcommand{\resumeSkillsListEnd}{\end{itemize}}

\begin{document}`,
  latexPostamble: String.raw`
\end{document}`,
  mainBodyLatex: '{{HEADER}}\n{{SECTIONS}}',
  sectionWrapperLatex: String.raw`\section{{{SECTION_TITLE}}}
  \resumeSubHeadingListStart
{{SECTION_BODY}}
  \resumeSubHeadingListEnd`,
  skillsSectionWrapperLatex: String.raw`\section{{{SECTION_TITLE}}}
  \resumeSkillsListStart
{{SECTION_BODY}}
  \resumeSkillsListEnd`,
  entryWrapperLatex: String.raw`    \resumeSubheading
      {{{TITLE}}}{{{DATES}}}
      {{{ORG}}}{{{LOCATION}}}
{{BULLETS}}`,
  bulletWrapperLatex: String.raw`      \resumeItem{{{TEXT}}}`,
  bulletListWrapperLatex: String.raw`      \resumeItemListStart
{{BULLETS}}
      \resumeItemListEnd`,
  // \item is still required — resumeSkillsListStart is still an itemize
  // environment, and content inside one with no \item at all is exactly
  // "Something's wrong--perhaps a missing \item." \small matches every other
  // wrapper's font size; no \vspace hack needed since the environment itself
  // now declares zero inter-item spacing.
  skillRowWrapperLatex: String.raw`    \item\small{\textbf{{{CATEGORY}}}{: }{{SKILLS_LIST}}}`,
  skillListSeparator: ', ',
  headerWrapperLatex: String.raw`\begin{center}
    \textbf{\Huge \scshape {{NAME}}} \\ \vspace{1pt}
    \small {{PHONE}} $|$ \href{mailto:{{EMAIL}}}{\underline{{{EMAIL}}}} $|$ {{LOCATION}} {{LINKS}}
\end{center}`,
}
