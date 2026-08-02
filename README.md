# resumage

Plug in a set of experiences/bullet points and a job description and automatically cater a resume to the role.

Resumage maintains a master database of reusable resume content (sections, entries, bullets, skills — each with form fields, editable LaTeX, and an AI semantic representation), then generates a job-tailored, page-constrained resume as a compiled PDF from a user-editable LaTeX template.

See [`docs/architecture.md`](docs/architecture.md) for the full engineering design and milestone roadmap.

## Tech stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, Zustand
- **Backend**: Firebase Authentication, Firestore, Firebase Storage, Cloud Functions
- **Rendering** (later milestones): LaTeX (Tectonic) → PDF

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Connect a Firebase project

This project expects an existing Firebase project. These steps require your own Firebase/Google account and can't be automated:

1. Install the Firebase CLI if you don't have it: `npm install -g firebase-tools`
2. Log in: `firebase login`
3. In the [Firebase Console](https://console.firebase.google.com/), open your project and enable:
   - **Authentication** → Sign-in method → **Email/Password** provider
   - **Firestore Database**
   - **Storage**
4. From the project root, run `firebase init` and select Firestore + Storage, pointing at your existing project (this repo already has `firebase.json`, `firestore.rules`, `firestore.indexes.json`, and `storage.rules` — `firebase init` should detect and reuse them).
5. In the Firebase Console, go to **Project settings → General → Your apps**, add/select a Web app, and copy its SDK config.
6. Copy `.env.example` to `.env.local` and fill in the values from that SDK config:

```bash
cp .env.example .env.local
```

### 3. Run the app

```bash
npm run dev
```

Visiting the app while logged out redirects to `/login`. Sign up, log in, log out, and password reset are all wired up against your Firebase project.

Once logged in, `/resume-db` is your master resume database: basic info, sections (experience-style entries with bullets, or skill categories), all with drag-drop reordering, a "must include" flag, and per-item LaTeX you can either let auto-generate from the form fields or override by hand. Its "Import from PDF" button can auto-populate that database from an existing resume — parsed content shows up in a review checklist first, nothing is saved until you confirm and then hit the page's own Save button. `/templates` lets you customize the LaTeX template (Jake's Resume ships as a read-only default — duplicate it to edit). `/generate` produces a job-tailored PDF. Both PDF import and generation require the Cloud Functions below to be deployed first.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler with no emit |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run the test suite in watch mode |

## Deploying Firestore/Storage rules

Once `firebase init` has linked this repo to your project:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## Cloud Functions (PDF generation & import)

`/generate` calls two Cloud Functions — `extractJdText` (JD PDF → text) and `compileLatex` (LaTeX → PDF via a bundled [Tectonic](https://tectonic-typesetting.github.io/) binary). `/resume-db`'s "Import from PDF" calls a third, `parseResumePdf` (resume PDF → layout-aware text, for `src/lib/import`'s heuristic parser). Everything else in this app runs entirely on Firebase's free tier, but Cloud Functions (2nd gen) run on Cloud Run/Cloud Build, which **requires upgrading your Firebase project to the Blaze (pay-as-you-go) plan** — usage at this app's scale should stay within Firebase's free monthly quota (2M invocations, 400K GB-seconds), so the Blaze plan itself doesn't mean you'll be charged, just that billing is enabled.

1. In the [Firebase Console](https://console.firebase.google.com/), upgrade your project to the **Blaze** plan (Project settings → Usage and billing).
2. Install the functions' own dependencies (this also fetches the Tectonic binary via a `postinstall` script — a ~25MB download):

   ```bash
   cd functions
   npm install
   cd ..
   ```

3. Deploy:

   ```bash
   firebase deploy --only functions
   ```

If you ever need to re-fetch the Tectonic binary manually (e.g. the postinstall script failed), download `tectonic-0.16.9-x86_64-unknown-linux-musl.tar.gz` from the [Tectonic releases page](https://github.com/tectonic-typesetting/tectonic/releases), extract it, and place the `tectonic` binary at `functions/bin/tectonic` (executable).
