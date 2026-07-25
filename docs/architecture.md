# Resumage — Engineering Design

Resumage helps users maintain a master database of reusable resume content (sections, entries, bullets, skills, each with form fields + editable LaTeX + AI semantic representation) and generate a job-tailored, page-constrained resume as a compiled PDF from a user-editable LaTeX template, in under 10 seconds, using only free infrastructure (Firebase free tier, no paid AI APIs).

### Locked-in decisions

1. **LaTeX → PDF compilation**: a Firebase Cloud Function (2nd gen) bundling the **Tectonic** LaTeX engine (single static binary, no full TeX Live). Milestone 5.
2. **AI/semantic layer, MVP**: fully client-side, zero server AI cost.
   - Ranking: in-browser embeddings via `transformers.js` (`all-MiniLM-L6-v2`) + cosine similarity + deterministic knapsack page-fit.
   - Semantic-text generation (on save): deterministic rule-based LaTeX/date/icon stripping — no LLM call.
   - Both sit behind swappable provider interfaces so a local LLM (e.g. Ollama) can be plugged in later without touching callers.
3. **CRUD**: direct Firestore client SDK reads/writes, secured entirely by Firestore security rules — not routed through Cloud Functions. Cloud Functions are reserved for JD PDF text extraction and LaTeX compilation, the two operations that genuinely require a server.
4. **Firebase project**: bring-your-own. Enabling providers, `firebase login`/`firebase init`, and populating `.env.local` are user-run steps (see the root [`README.md`](../README.md)).

## 1. System Architecture

```
Browser (React SPA, Vite build, served via Firebase Hosting)
 ├─ Firebase Auth SDK ───────────► Firebase Authentication
 ├─ Firestore SDK (direct CRUD) ─► Cloud Firestore  (secured by rules, per-uid scoped)
 ├─ Storage SDK ──────────────────► Firebase Storage  (JD PDF uploads, compiled resume PDFs)
 ├─ Client-side AI layer (in-browser, no network), Milestone 3+:
 │    transformers.js (all-MiniLM-L6-v2, WASM) in a Web Worker
 │    → embeddings cached in IndexedDB + mirrored to Firestore doc fields
 │    → deterministic cosine-similarity ranking + knapsack page-fit (pure TS)
 └─ HTTPS Callable Cloud Functions (2nd gen), Milestone 5+:
      • extractJdText   — PDF → plain text (pdf-parse)
      • compileLatex    — LaTeX source → PDF via bundled Tectonic binary
```

## 2. Firestore Data Model (Milestone 2+)

Flat, top-level-under-user collections with FK fields, not deep subcollection chains:

```
users/{uid}                          (basicInfo embedded, createdAt)
users/{uid}/sections/{sectionId}
users/{uid}/entries/{entryId}         // sectionId FK, order
users/{uid}/bullets/{bulletId}        // entryId FK + denormalized sectionId, order
users/{uid}/skillRows/{skillRowId}    // sectionId FK, order
users/{uid}/skills/{skillId}          // skillRowId FK, order
users/{uid}/templates/{templateId}
users/{uid}/settings/pageConstraints  (singleton doc)
users/{uid}/generatedResumes/{resumeId}
```

The ranking pipeline must load a user's entire resume DB per generation run. Flat top-level-under-uid collections let that happen in one query per collection instead of N+1 nested reads or `collectionGroup` queries, and collapse Firestore security rules to one uniform wildcard rule (§9).

TypeScript interfaces live at `src/types/resumeDb.ts` (Milestone 2): `BasicInfo`, `Section`, `Entry`, `Bullet`, `SkillRow`, `Skill`, `PageConstraints`, `GeneratedResume`.

## 3. must-include + LaTeX-override state machine (Milestone 2)

Every entity with both simple fields and LaTeX (`BasicInfo`, `Section`, `Entry`, `Bullet`, `SkillRow`) carries `isLatexOverridden: boolean`.

- **Default** (`false`): `latex` auto-regenerates from fields on every save.
- **User edits LaTeX directly** → `isLatexOverridden = true`; stored verbatim; field saves stop touching `latex`.
- **User edits a simple field while overridden** → never silently overwrite. A warning dialog offers "save fields only, keep custom LaTeX" or "regenerate LaTeX from fields (discard custom LaTeX)".
- **Explicit "revert to auto-generated LaTeX"** → same as the regenerate branch.

Centralized in `src/hooks/useLatexOverridableEntity.ts`, consumed by every entity editor.

## 4. Semantic representation generation (Milestone 3)

`src/lib/semantic/ruleBasedExtractor.ts` — pure, subtraction-only: strip known noise (LaTeX commands via a brace-balanced parser, URLs/emails/phones, dates, layout glyphs), keep the rest verbatim, normalize whitespace.

Provider abstraction (`src/lib/semantic/provider.ts`) so a future `ollamaProvider.ts` can replace the rule-based one without touching callers.

## 5. Client-side embedding + ranking (Milestone 3/5)

- **Model loading**: `src/lib/ai/embeddingModel.ts` lazily loads `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`, WASM) on first use.
- **Worker**: inference runs in `src/workers/embedding.worker.ts`.
- **Cache**: computed once per save, stored in both the Firestore doc (`embedding`, `semanticTextHash`) and IndexedDB. Generation checks IndexedDB → Firestore field → recomputes only if the hash is stale.
- **Pure functions**: `cosineSimilarity.ts`, `scoreItem.ts`, `knapsack.ts` (`fitToPageConstraints`, removal order: lowest-value bullets → entries → reorder → adjust top margin).
- **10s-budget nuance**: `estimatePageCount` is a calibrated client-side heuristic used to converge quickly, followed by one real Tectonic compile to verify, plus at most 1–2 correction iterations if it disagrees.

## 6. Template system (Milestone 4)

No hardcoded Jake's-Resume logic anywhere. Jake's Resume is a seeded `ResumeTemplate` data document with placeholder wrapper strings (`{{HEADER}}`, `{{SECTIONS}}`, `{{TITLE}}`, `{{BULLETS}}`, etc.). `renderTemplate.ts` does pure `{{KEY}}` substitution. A new template later is just a new data document — zero app-code changes.

## 7. Cloud Functions (Milestone 5)

Two `onCall` functions only:
- **`extractJdText({ storagePath }) → { text }`** — `pdf-parse` over an uploaded JD PDF.
- **`compileLatex({ latexSource, resumeId? }) → { pdfStoragePath, pageCount, warnings? }`** — runs Tectonic, uploads the PDF, returns its Storage path.

Both verify `request.auth`. Tectonic bundling: pin a release binary via a `postinstall` script into `functions/bin/tectonic`, shell-escape disabled.

## 8. Frontend architecture

**State management: Zustand** — selector-based subscriptions, trivial `onSnapshot → store.setState` colocation, no Context cascading-provider ceremony or Redux boilerplate.

Folder structure, routing, and component hierarchy: see `src/` — `lib/firebase`, `stores`, `hooks`, `components/{common,layout,auth,resume-editor,generation}`, `pages`, `types`, `utils`.

## 9. Security

**Firestore rules** (flat structure → one uniform wildcard rule) and **Storage rules** (per-uid path prefix) — see `firestore.rules` / `storage.rules` at the repo root. Route guards (`ProtectedRoute`/`PublicOnlyRoute`) are UX only; the real boundary is rules + Cloud Function auth checks. Field-level rule validation, rate limiting, and App Check are deferred to Milestone 7.

## 10. Resume import (auto-parse) — Milestone 9

Upload an existing resume PDF to auto-populate the Resume DB instead of starting blank. Reuses `extractJdText` (§7) unchanged for PDF→text. `heuristicResumeParser.ts` (`src/lib/import/`) structures it deterministically — no paid APIs, no LLM — behind a `ResumeParserProvider` interface, the same swappable pattern as §4.

Parse-then-review, never a silent write: the parse is an in-memory draft; a checklist UI lets the user toggle/edit before import, and only confirmed items go through the existing `resumeDbStore` CRUD actions, so they get default-LaTeX and semantic/embedding generation exactly like hand-typed content.

## 11. Milestone Roadmap

- **M1 (done)** — scaffolding, Firebase wiring, full auth flow (sign up/log in/log out/reset password).
- **M2 (done)** — Resume DB CRUD (§2/§3), template-driven default-LaTeX generation, drag-drop reordering, local draft-then-Save editing model.
- **M3 (done)** — Semantic extractor (§4) wired to every save; embeddings via Web Worker, cached in IndexedDB + Firestore, hash-gated. No ranking UI yet.
- **M4 (done)** — Templates are real Firestore documents, not hardcoded; Jake's Resume auto-seeds and becomes active; `/templates` provides CRUD plus a live LaTeX-source preview editor.
- **M5 (done)** — Generation pipeline: Cloud Functions `extractJdText`/`compileLatex` (§7, bundled Tectonic — deploying is a user-run step, needs the Blaze plan), deterministic ranking/knapsack (§5), `/generate` UI.
- **M6** — PDF preview, LaTeX source viewer, section-order/page-constraint settings UI.
- **M7** — Security hardening: field-level rules, rate limiting/App Check, function auth audit.
- **M8** — Remaining test coverage (§12) + CI (GitHub Actions: lint/typecheck/unit, optional emulator integration job).
- **M9** — Resume upload + auto-parse into the Resume DB (§10): review-before-import, no separate data path.

## 12. Testing Strategy

- **Unit (Vitest, no DOM)**: `cosineSimilarity`, `computeRelevanceScore`, `fitToPageConstraints`, `generateSemanticText`, `substitutePlaceholders`/`renderTemplate`, `generateDefaultLatex`, `validation.ts`, `authErrorMessages.ts`, `heuristicResumeParser` (fixture resumes of varying layouts).
- **Component (Vitest + RTL + jsdom)**: auth forms, route guards, entry/bullet editor override-warning flow, generation stepper. Mock `firebase/auth` and Zustand stores.
- **Cloud Function tests**: Firebase Emulator Suite driving `extractJdText`/`compileLatex` with fixtures.
- **Integration**: `@firebase/rules-unit-testing` for cross-user Firestore rule isolation; fixture-based full-pipeline test (M5+) with a stubbed deterministic embedding provider.
