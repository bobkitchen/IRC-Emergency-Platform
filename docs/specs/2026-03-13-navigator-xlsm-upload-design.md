# Navigator XLSM Upload — Design Spec

**Date:** 2026-03-13
**Status:** Draft
**Scope:** Self-service XLSM upload on the admin page that parses Navigator task data and deploys it to the live site.

---

## Problem

The Navigator's task data comes from a master Roadmap XLSM spreadsheet. Currently, updating the live site requires manual CSV extraction, running Python/Node scripts locally, and committing JSON files by hand. This blocks non-technical updates and makes the feedback loop slow.

## Solution

Add a "Navigator Data" tab to the existing admin page (`irc-admin/`) where the user can drag-and-drop the Roadmap XLSM. The browser parses it client-side, shows a preview with diff and warnings, and on confirmation commits the updated JSON directly to the GitHub repo — triggering CI to redeploy the Navigator.

---

## User Flow

1. Navigate to `irc-admin/` → enter password at the gate
2. Switch to the **Navigator Data** tab
3. Drag-and-drop (or file-pick) the Roadmap XLSM
4. Browser parses all sheets client-side using SheetJS
5. Preview screen appears with:
   - Per-sector summary (task count, resource count, URLs vs no-URL)
   - Diff vs current live data (sectors/tasks/resources added/removed)
   - Questions about unrecognized sheets or unfamiliar column formats
   - Warnings about missing expected sheets or resources without URLs
6. Resolve any questions → click **Confirm & Deploy**
7. Page commits `process-data.json`, `resource-index.json`, and `search-chunks.json` to GitHub via REST API
8. CI triggers, Navigator redeploys with the new data
9. Success message with link to the GitHub Actions run

---

## Authentication

### Admin Page Password Gate

The password gate protects the **entire admin page** (all tabs, including the existing Classification import). This is a change in behavior — currently the admin page has no auth.

- On load, if not authenticated this session, a password prompt appears
- A SHA-256 hash of the correct password is stored in the page source (not plaintext)
- User input is hashed client-side and compared
- On success, a flag is set in `sessionStorage` (persists across refreshes, clears on browser close)
- The password is provided by the project owner and stored only as a hash in source

### GitHub PAT

- A fine-grained Personal Access Token (Contents read/write on `IRC-Emergency-Platform`) is embedded in the page source
- The token is encrypted using the admin password as the key (AES-GCM via Web Crypto API)
- Decrypted at runtime only after successful password entry — never visible in plaintext in the source
- The PAT is provided by the project owner and stored only in encrypted form
- **Important:** The PAT and password must never appear in plaintext in any committed file (including this spec). They are provided out-of-band during implementation.

---

## Parsing Logic

### Sheet Handling — Three Buckets

**Recognized sheets:** Match known XLSM sheet names. The parser uses display names (with spaces and special characters as they appear in the workbook), not CSV filename equivalents. Known sheets and their sector mappings:

| XLSM Sheet Name | Sector | Parser Format |
|---|---|---|
| RMiE | Response Management | RMiE format |
| Response Management, Response Management (WIP) | Response Management | Response Mgmt format |
| Finance | Finance | Standard |
| People & Culture | People & Culture | Standard |
| PCiE | People & Culture | PCiE format |
| Supply Chain | Supply Chain | Standard |
| Safety & Security | Safety & Security | S&S format |
| Safeguarding | Safeguarding | Safeguarding format |
| Technical Programs | Technical Programs | Standard |
| MEAL | MEAL | Standard |
| Grants | Grants | Standard |
| Partnerships | Partnerships | Standard |
| Integra Launch | Integra Launch | Integra format |
| EmU Services | (special) | EmU format |
| Preparedness Library | (special) | Preparedness format |

**Sector merging:** After parsing, certain sheets are merged into a single sector:
- `People & Culture` + `PCiE` → merged into **People & Culture** sector
- `Response Management` + `RMiE` → merged into **Response Management** sector

This matches the existing merge logic in `build-data.mjs` (lines 815-850).

**Unrecognized sheets:** Don't match any known name. Surfaced in the preview as a question: *"Sheet 'Comms' was found but isn't a known sector. Would you like to add it as a new sector?"* If yes, the parser attempts to detect the column format by scanning the header row for familiar patterns (Tasks, Subtasks, Resources, Box Link). If the format doesn't match any known layout, a column-mapping prompt appears.

**Missing expected sheets:** Known sectors not found in the XLSM. Shown as a warning in the preview.

### Column Format Detection

Six known parser formats (matching `build-data.mjs`):

1. **RMiE format** — Counter, Response Stage, New/Existing Office, Classification, Responsible, Priority, Key Milestone, Status, Tasks, Subtasks, Resources, Box Link
2. **Response Management format** — similar to RMiE with different column offsets
3. **Standard format** (Finance, Supply Chain, Technical Programs, MEAL, Grants, Partnerships) — Task ID, Task Title, Subtask, Resource Link
4. **PCiE format** — variant of standard with different column positions
5. **Safeguarding format** — variant with additional columns
6. **Integra format** — variant specific to Integra Launch

The parser checks header rows against all known layouts. If headers look different (new columns, reordered, renamed), it pauses and shows what it found with a column-mapping UI rather than guessing wrong.

### Hyperlink Extraction

SheetJS reads hyperlinks from XLSM cells via the `cell.l` property. For each cell with both display text and a hyperlink, we capture:
- Resource name (display text)
- URL (hyperlink target)
- Sector (from sheet name)
- Task title (from the task column in the same row)

**Testing note:** SheetJS Community Edition has known limitations with some XLSM hyperlink formats. During implementation, validate hyperlink extraction against the actual Roadmap XLSM and compare output with the existing `resource-index.json` generated by the Python script. If gaps are found, investigate SheetJS options (`cellStyles`, `cellHTML`) or document known limitations.

### Deduplication Rules

- If a resource appears on both a subtask row and its parent task, it only lives on the subtask level
- Resources are deduped by URL within a task
- These rules match the cleanup applied in the March 2026 resource fixes

### Output

Three JSON objects:

- **`process-data.json`** — contains `metadata`, `sectors` (tasks, subtasks, resources, phases, contacts), `guidelines`, `annexes`, `emuServices`, and `preparednessLibrary`
- **`resource-index.json`** — flat list of all hyperlinked resources with task/sector mappings
- **`search-chunks.json`** — RAG search chunks for Ask Albert, generated from the parsed task data

**Non-sector data handling:** The `guidelines`, `annexes`, `emuServices`, and `preparednessLibrary` fields are parsed from the corresponding sheets in the XLSM (EmU Services, Preparedness Library, plus any Guidelines/Annexes data). If those sheets are absent from the uploaded XLSM, the existing values from the current live `process-data.json` are carried forward so no data is lost.

**Metadata block:** The output includes a `metadata` object with `buildDate`, `totalSectors`, `totalTasks`, `totalResources`, and `source: "admin-upload"` to distinguish from script-generated builds.

---

## Preview Screen

### Header Stats
Total sectors parsed / Total tasks / Total resources with URLs / Resources without URLs

### Per-Sector Cards
Each sector gets a card showing:
- Sector name and task count
- Resource count (clickable URLs vs name-only)
- Contact info from sheet header rows (if present)
- Expandable section to spot-check sample tasks

### Questions Panel
Unrecognized sheets and format issues appear as interactive prompts. The Confirm button is disabled until all questions are answered.

### Diff Summary
Fetches the current live `process-data.json` from the GitHub repo and shows a comparison:
- Sectors added / removed
- Tasks added / removed (by count per sector)
- Resources added / removed
- e.g. *"Finance: 16 → 22 tasks (+6), 34 → 51 resources (+17)"*

### Actions
- **Confirm & Deploy** — commits JSON to GitHub, triggers CI
- **Download JSON** — saves files locally for manual inspection
- **Cancel** — discard and start over

---

## GitHub Commit Mechanism

Uses the GitHub REST API directly (fetch calls, no SDK):

1. `GET /repos/{owner}/{repo}/git/ref/heads/main` — get current branch SHA
2. `GET /repos/{owner}/{repo}/git/commits/{sha}` — get the tree SHA
3. `POST /repos/{owner}/{repo}/git/blobs` — create blobs for all three JSON files
4. `POST /repos/{owner}/{repo}/git/trees` — create new tree with updated files at:
   - `apps/navigator/src/data/process-data.json`
   - `apps/navigator/src/data/resource-index.json`
   - `apps/navigator/src/data/search-chunks.json`
5. `POST /repos/{owner}/{repo}/git/commits` — create commit with message: *"data: update Navigator tasks from Roadmap XLSM (YYYY-MM-DD)"*
6. `PATCH /repos/{owner}/{repo}/git/refs/heads/main` — update branch ref

**Data flow through CI:** The commit lands in `apps/navigator/src/data/`. When CI runs `build-data.mjs`, it detects no CSV files in the `csv/` directory and skips regeneration — preserving the just-committed JSON files. Vite then builds from `src/data/` and deploys `dist/`. This chain is validated and working today.

On failure: show error, offer retry or JSON download as fallback.

---

## Files Changed

### Modified
- `apps/admin/index.html` — add password gate (covers entire page), add Navigator Data tab

### Added
- `apps/admin/navigator-upload.js` — XLSM parsing (port of all six parser formats from build-data.mjs + hyperlink extraction from extract-links-from-xlsm.py), search chunk generation, preview rendering, GitHub commit logic

### External Dependency
- SheetJS (`xlsx`) loaded via CDN for XLSM parsing. Bundle locally in `apps/admin/` as a fallback for offline use.

### No Changes To
- Navigator app (continues reading process-data.json at build time)
- CI pipeline (still triggered by push to main)
- Shared package
- Classification, CRF Calculator, or Landing apps

---

## Out of Scope

- Multi-user access control (single password gate is sufficient)
- Version history / rollback UI (git history serves this purpose; rollback can be added later)
- Editing individual tasks through the UI (the spreadsheet remains the source of truth)
- The `enrich-tasks-with-resources.py` fuzzy matching script (deprecated — not used)
