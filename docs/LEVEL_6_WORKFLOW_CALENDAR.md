# Level 6 — Workflow + Calendar

Nicholas directed this level to open on November 23, 2026. The Calendar client selector already exists. The first feature is a one-client bulk spreadsheet flow; calendar views and operational workflows follow. This is the active plan and dated progress record. Level 6 is **OPEN**, not accepted as complete.

## Entry decision and retained exceptions

- TikTok is paused at Nicholas's request. It is not a Level 6 dependency and is not represented as a working publisher.
- Google Business publishing and scheduling are owner-reported working. `L5-GBP-08` final evidence review is deferred, not DONE; exact scheduled-result, browser-closed/reentry, post-link navigation and fresh full-suite evidence remain unrecorded in the Google phase document.
- YouTube and LinkedIn have manual live checkpoints in their phase documents. Do not infer live success from their code or a build. Company Page access remains blocked.
- The November 23 baseline has 370 passing and six failing Node tests (five Google publisher/scheduler and one Smart Media import), reproduced on untouched `main`; lint has three existing LinkedIn image warnings. Resolve these before accepting bulk draft/schedule writes or final Level 6 review. Record new checks separately.
- No imported file may publish directly. A selected client owns every row. All Clients can browse the eventual calendar but cannot import. Every account column must map to an exact connected account belonging to that client. Use the existing client timezone and per-destination scheduler, never a separate queue.

## Ordered task queue

| ID | Status | Objective | Pass condition |
| --- | --- | --- | --- |
| L6-01 | `MANUAL` | One-client `.xlsx` template and read-only preview | One-sheet design implemented locally; deployment and authenticated client-switch/template/preview smoke test still required |
| L6-02 | `WAITING` | Reviewed bulk draft creation | Explicit confirmation after validation creates Master Content and destination versions using existing models; safe duplicate/retry handling and media mapping |
| L6-03 | `WAITING` | Reviewed bulk scheduling | Schedule eligible destination versions on distinct client-local days/times through existing scheduler, with per-row results and no silent publication |
| L6-04 | `WAITING` | Visual Calendar | Month, week and list views of real destination releases, All Clients and selected-client scopes, useful detail/navigation |
| L6-05 | `WAITING` | Derived status and Content views | Source-of-truth status across drafts, scheduled, published, failed and review states; client/platform filters |
| L6-06 | `WAITING` | Needs Attention | Missed/failed schedules, account health and actionable notification/recovery visibility, including delivery/monitoring policy |
| L6-07 | `WAITING` | Dashboard operations | Selected-client summaries and All Clients row-per-client actionable counts/activity |
| L6-08 | `WAITING` | Level 6 review | Reconcile provider and baseline exceptions, live workflow evidence and owner acceptance; only then update overall README completion status |

## L6-01 — Spreadsheet template and preview

The owner-approved layout is one `Bulk Posts` sheet, one row per Master post. Columns: `post_key` (unique within file), `title`, `master_text`, optional `link_url`, optional `media_url`, `local_date` (`YYYY-MM-DD`), `local_time` (`HH:mm`, 24-hour), then one generated column per connected social account. Enter `X` to include an account or leave it blank to skip. The selected client owns the template; account IDs are bound in a hidden identity row, so Nicholas never needs to copy IDs. All selected accounts on a row share its client-local date and time. Dates/times are text; Excel date/formula cells are rejected to avoid silent timezone interpretation.

The preview labels Facebook/LinkedIn link cards when there is a link and no media URL. Google Business instead identifies its existing metadata-image fallback when there is a link and no media URL. These are intended import behaviors, not fetched media or verified live previews in L6-01. A supplied `media_url` takes priority. Instagram/YouTube selections without media are flagged. Actual remote media fetch, metadata-image import, provider compatibility, destination creation and scheduling remain L6-02/03 work.

Acceptance criteria:

1. Require an owner session, an active selected client, a valid `.xlsx` workbook, and bounded file/row sizes. Reject All Clients and a client mismatch before showing any preview.
2. Generate one sheet for the selected client with readable, exact account columns. Bind stable account IDs in the workbook's hidden identity row. `X` includes; blank skips. No copied account ID or second Destinations sheet is required.
3. Validate required headers, unique post keys, the client/connection identity, `X` selections, URLs and client-local future times. Report per-row errors, including nonexistent/ambiguous DST times. Never infer a destination from a platform name alone.
4. Show each Master post with its selected accounts, common time, chosen link/media behavior and errors; do not save, fetch remote media, schedule or publish from this endpoint or UI. Invalid rows remain visible for correction. Do not return credentials or connection secrets.
5. Run focused parser/template tests, lint, production build and the full suite; report known pre-existing failures distinctly. Record live browser/client verification as manual if not observed.

After L6-01 is supported by evidence, mark only L6-02 READY. Its write path must revisit media, destination validation, partial failure/retry and the baseline six failures before accepting drafts.

## Progress log

### November 23, 2026 — Owner-directed phase transition

- **Decision:** Nicholas explicitly opened Build Level 6 and paused TikTok. Google final review, YouTube/LinkedIn manual checks and the six baseline test failures remain visible exceptions, not completed work.
- **Task:** L6-01 was selected as the sole READY checkpoint, scoped to a read-only client-bound spreadsheet preview. It is now MANUAL pending deployed UI verification; L6-02+ remain WAITING.
- **Files:** `README.md`, `AGENTS.md`, Google phase record, this phase plan, and L6-01 application files as listed in a following entry.
- **Checks/live:** Transition itself requires documentation consistency and whitespace review. L6-01 automated and manual results are recorded in a following entry.
- **Git:** Local edits only until Nicholas separately authorizes a GitHub write.

### November 23, 2026 — L6-01 local implementation

- **Historical local outcome before owner design review:** The first local implementation used two sheets with explicit account IDs and previewed text/link posts. This was superseded by Nicholas's one-sheet X/blank layout below. All Clients and inactive clients remain unable to import; the owner-only endpoint remains read-only.
- **Files changed:** `app/(app)/calendar/page.js`, `app/api/calendar/bulk-preview/route.js`, `components/calendar-bulk-preview.js`, `components/ui.module.css`, `lib/bulk-calendar-preview.js`, `tests/bulk-calendar-preview.test.js`, `package.json`, `package-lock.json`, `README.md`, `AGENTS.md`, this phase document and `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`.
- **Checks:** Node 24.22.3 focused `node --test tests/bulk-calendar-preview.test.js`: 3 passed. `npm run lint`: zero errors, three existing LinkedIn image warnings. `npm run build`: passed, dynamic `/calendar` and `/api/calendar/bulk-preview` included. Full `npm test`: 373 passed, six failed out of 379; the same six known Google/Smart Media failures were reproduced on untouched `main` before this work. `git diff --check`: pending final review.
- **Live/manual:** No authenticated deployed UI test or client MongoDB check was performed. After explicit commit/push approval and deployment, select an active client on `/calendar`, download the template, copy an exact account ID, preview a valid two-row workbook with dates on different days, then check foreign account, malformed time and All Clients rejection. Confirm no drafts or schedules were created. This verifies the read-only flow only.
- **Decisions then:** Template cells were text to avoid interpreting Excel timezone dates or formulas. L6-02 must define media references/provider-specific validation and safe import retries before writes. The later one-sheet decision supersedes copied account IDs.
- **Blockers/remaining:** L6-01 is MANUAL until deployed smoke verification. The six existing failing tests and provider evidence exceptions remain; resolve before bulk draft/schedule writes. L6-02 is the only task that should become READY after acceptance. No Level 6 completion claim.
- **Git:** Local uncommitted work; no GitHub write authorized by the phase transition request.

### November 23, 2026 — L6-01 owner-approved one-sheet revision

- **Decision/outcome:** Nicholas reviewed an example workbook and approved one row per Master post, optional link/media URLs, common date/time, and a column per selected client's connected account. `X` includes an account; blank skips. Facebook/LinkedIn use link preview intent with a bare link; Google Business uses the existing metadata-image fallback at import when there is a link and no explicit media. The local template/preview was revised accordingly. Its hidden identity row binds exact client and account IDs without exposing them in the visible columns. No drafts, media imports or schedules are created.
- **Files changed:** `lib/bulk-calendar-preview.js`, `components/calendar-bulk-preview.js`, `app/api/calendar/bulk-preview/route.js`, `tests/bulk-calendar-preview.test.js`, this phase record and `README.md`.
- **Checks:** Focused `node --test tests/bulk-calendar-preview.test.js` passed 5/5, covering X/blank account selection, client/foreign account identity, unknown columns, duplicate keys, invalid selections/URLs, DST/formula/date negatives and media-required destination. `npm run lint` passed with zero errors and three existing LinkedIn image warnings; `npm run build` passed. Full `npm test` reported 375 passed / six failed out of 381, the same known Google publisher/scheduler and Smart Media baseline failures recorded above; no new preview failures. `git diff --check` passed. A final focused rerun after the unknown-column guard passed 5/5.
- **Live/manual:** Authenticated deployed UI, downloaded account headers, example workbook upload, client switching, and absence of created drafts/schedules remain unverified. L6-01 remains MANUAL. L6-02 remains WAITING; its media fetch/provider validation and existing six failing tests are prerequisites to writes.
- **Git:** Local uncommitted changes only; no commit/push approval in this exchange.

### November 23, 2026 — L6-01 deployed preview feedback and local URL-cell correction

- **Outcome:** Nicholas's deployed screenshot confirms a selected Nicholas_Egner client, an uploaded one-sheet workbook accepted for row preview, three exact account selections and a future client-local release time. Row 3 failed because `link_url` was not stored as a plain string. The workbook itself was not supplied, so its exact cell type remains unverified. Locally, URL columns now accept Excel hyperlink cells by reading their actual destination URL; other non-text cells remain rejected, and URL protocol/length validation still applies. Preview remains read-only. Task remains MANUAL until a valid deployed preview, client-switch rejection and absence-of-writes checks are observed.
- **Files changed:** `lib/bulk-calendar-preview.js`, `tests/bulk-calendar-preview.test.js`, this phase document.
- **Checks/results:** Focused preview tests passed 6/6, including linked URL, media URL and unsafe hyperlink cases. Lint passed with zero errors and three existing LinkedIn image warnings. Production build passed. Full suite still exited with failures from the documented Google publisher/scheduler and Smart Media baseline; new bulk preview tests passed. `git diff --check` passed.
- **Live/manual:** No authenticated live test of this correction; the deployed application had the original plain-string URL rule at the time of the screenshot. Nicholas can clear an unintended `link_url` cell or re-enter an intended URL as plain text to continue testing before redeployment. No draft creation, media fetch, schedule or publish was observed in the screenshot, but absence of writes was not independently checked.
- **Decision/blockers/next:** Keep Excel date/formula rejection and exact client/account binding. L6-02 remains WAITING; after L6-01 live acceptance it is the sole task to mark READY. Nicholas explicitly authorized commit and push of this correction after local review.
