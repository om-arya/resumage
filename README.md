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

Once logged in, `/resume-db` is your master resume database: basic info, sections (experience-style entries with bullets, or skill categories), all with drag-drop reordering, a "must include" flag, and per-item LaTeX you can either let auto-generate from the form fields or override by hand.

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
