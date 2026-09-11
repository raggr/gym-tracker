# Gym Tracker v4

A lightweight, mobile-first tracker for a three-day strength routine and conservative progressive overload. It is plain HTML, CSS and JavaScript, has no backend or build step, and remains compatible with GitHub Pages.

## Architecture

- `index.html` contains the four-section application shell.
- `styles.css` contains the warm charcoal/slate visual system and responsive layout.
- `app.js` contains routine definitions, rendering, IndexedDB access, draft/session workflows, progression, charts, editing and backup handling.
- `manifest.json`, `icon.svg` and `sw.js` provide the installable offline PWA.
- `.github/workflows/pages.yml` deploys the static folder to GitHub Pages.

## Current features

- Compact Workout, Progress, Body, and History & Data navigation
- “Up next” recommendation cycling through Day 1 → Day 2 → Day 3
- Automatic per-day workout drafts with Resume and Discard
- Explicit Done/Undo state for every set; copied values remain unconfirmed
- Partial-workout review that saves completed sets only
- In-place editing of saved workout dates, reps/seconds and loads
- Conservative, explained next-workout targets, plus persistent held targets
- Day-specific progress, personal bests and charts
- Precise load labels (`kg each`, `kg total`, `machine setting`) and nearby previous-set results
- Named Day 3 row/pulldown choices with separate progress; old combined records stay labelled as legacy and ambiguous
- Optional per-exercise rest timers that persist their finish time
- Persistent setup notes, session exercise notes and optional effort context
- Grouped workout history with reps before load and no `@` notation
- Body-weight, waist and body-fat estimate tracking
- Validated, duplicate-safe JSON import/export
- Installable PWA with a versioned offline cache
- The 20 August 2026 Day 1 baseline is seeded once on a genuinely new database

## Data storage and compatibility

All personal data stays in IndexedDB in the current browser. GitHub Pages hosts only the application files and does not receive or sync workout data.

The database remains `GymTrackerDB`. Database version 3 uses four stores:

- `workouts` — unchanged existing workout records; new saved sets add `completed: true`, while legacy sets without this field continue to count as recorded performance.
- `bodyMetrics` — body measurements introduced in database version 2.
- `drafts` — unfinished workouts keyed by day.
- `preferences` — setup notes, held targets, Day 3 choice, timer settings and the active timer.

The version-3 database migration is additive: it does not rename or recreate `workouts` or `bodyMetrics`.

New exports use backup version 4 and include all four stores. Version-2 workout-only and version-3 workout/body backups remain importable. Re-import uses stable creation identities to skip duplicate workouts and body entries; an imported draft never replaces an existing local draft.

Use **History & Data → Export JSON** periodically as a backup. Browser/site-data clearing can still erase local records.

## Publish with GitHub Pages

This tracked folder already contains the Pages workflow and `.nojekyll`. Push reviewed changes to `main`, then select **GitHub Actions** under the repository’s **Settings → Pages → Build and deployment**. No build configuration is required.

After deployment, open the Pages URL on the phone and use **Add to Home Screen** (iOS/Safari) or **Install app / Add to Home screen** (Android/Chrome).

## Local testing

Serve the folder over HTTP so IndexedDB and the service worker use a normal web origin:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Use a fresh port or a separate browser profile for disposable test data; do not import a real personal backup into a test origin.

## Deliberate limitations

- Data remains local to one browser/origin; there is no cloud sync.
- The rest timer restores elapsed time but does not promise locked-screen notifications.
- Effort feedback is context only and does not automatically change progression.
- Historical combined Day 3 “Row or lat pulldown” entries remain ambiguous by design.
- Exercise demonstrations, warm-up logging, abbreviated routines, nutrition, social features and emulator/video work remain deferred.
