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
\input{glyphtounicode}

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

\pdfgentounicode=1

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
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

\begin{document}`,
  latexPostamble: String.raw`
\end{document}`,
  mainBodyLatex: '{{HEADER}}\n{{SECTIONS}}',
  sectionWrapperLatex: String.raw`\section{{{SECTION_TITLE}}}
  \resumeSubHeadingListStart
{{SECTION_BODY}}
  \resumeSubHeadingListEnd`,
  entryWrapperLatex: String.raw`    \resumeSubheading
      {{{TITLE}}}{{{DATES}}}
      {{{ORG}}}{{{LOCATION}}}
{{BULLETS}}`,
  bulletWrapperLatex: String.raw`      \resumeItem{{{TEXT}}}`,
  bulletListWrapperLatex: String.raw`      \resumeItemListStart
{{BULLETS}}
      \resumeItemListEnd`,
  skillRowWrapperLatex: String.raw`    \textbf{{{CATEGORY}}}{: }{{SKILLS_LIST}} \\`,
  skillListSeparator: ', ',
  headerWrapperLatex: String.raw`\begin{center}
    \textbf{\Huge \scshape {{NAME}}} \\ \vspace{1pt}
    \small {{PHONE}} $|$ \href{mailto:{{EMAIL}}}{\underline{{{EMAIL}}}} $|$ {{LOCATION}} {{LINKS}}
\end{center}`,
}
