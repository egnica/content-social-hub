# Level 4 Scheduling Engine

Level 4 adds real destination-specific scheduling on top of the verified Level 3 Facebook publisher.

The goal is not to build the full Calendar experience yet. The goal is to prove that one saved Facebook destination version can be scheduled for a real future release, the browser can be closed, AWS can wake the application at the correct time, the existing publishing safety checks can run again, and the exact scheduled result is persisted without creating duplicates.

The primary live-test destination for this phase is:

```text
Nicholas_Egner
-> GIGnovate
-> Facebook Page
-> Healthy
```

## Phase progress log

- Phase status: **IN PROGRESS**
- Opened: **September 29, 2026**
- Active phase document: `docs/LEVEL_4_SCHEDULING.md`
- Dependency: **Level 3 — First Publisher closed September 29, 2026**
- Live-test destination: `Nicholas_Egner -> GIGnovate`
- Next implementation rule: select the first task marked `READY`, complete only that task, record evidence here, and return the README handoff report
- Level 4 is not complete until Work reviews the final background-publishing evidence and updates the README

## Level 4 pass condition

Level 4 passes only after this real deployed flow works end to end:

```text
Create or open Master Content
-> use Master release time or destination override
-> Schedule the GIGnovate Facebook version
-> persist the exact destination revision and release instant
-> close the browser
-> AWS wakes the background worker at the scheduled time
-> worker reloads the saved schedule/version from MongoDB
-> worker revalidates account health and publishability
-> existing duplicate protection is preserved
-> Facebook accepts the post
-> schedule and publish-attempt state update durably
-> View Post opens the exact scheduled Facebook post
```

A browser timer, a client-side `setTimeout`, or a build-only test is not sufficient. The final checkpoint must prove background publishing while no browser is required.

## Current scheduling foundation already present

The repository already has several pieces Level 4 should build on rather than replace:

- clients already store a timezone, defaulting to `America/Chicago`
- Master Content already has a `defaultReleaseAt` field and a `datetime-local` control
- MongoDB is already the source of truth for application state
- platform versions already isolate destination-specific publishing state
- the Facebook publisher already rechecks ownership, Account Health, live validation, and idempotency before provider submission
- publish attempts are already durable MongoDB records
- the full native Calendar screen is intentionally still a later Level 6 feature

Two existing behaviors need explicit Level 4 treatment:

1. the current Master `datetime-local` value is converted in the operator/browser timezone rather than explicitly in the selected client's timezone
2. every Master Content save currently increments the Master revision, including schedule-only edits; scheduling metadata must not accidentally behave like a publish-content edit or create a new publishable revision

## Locked Level 4 architecture decisions

These decisions follow the README and the proven Level 3 publisher. Do not redesign the working publisher or add unrelated workflow features during this phase.

### MongoDB remains the scheduling source of truth

AWS wakes work; it does not become the authoritative application database.

A durable schedule record should identify at least:

- Master Content ID
- platform version ID
- exact platform-version revision being scheduled
- client ID
- social connection / destination ID
- platform
- resolved release instant in UTC
- IANA timezone used to interpret/display the human schedule
- whether the time came from the Master default or a destination override
- scheduling state
- AWS schedule identifier when one exists
- created / updated / dispatched timestamps
- failure or missed-schedule information when applicable

### Scheduling metadata is separate from publish-content revisions

Changing only a release date/time must not create a new content revision merely to represent a different clock time.

The scheduled job must bind to the exact publish-content revision that was valid when the schedule was created. If publishable content changes afterward, the schedule must become stale/invalid and require a deliberate reschedule rather than silently publishing edited content under the old schedule.

This separation is required to preserve the Level 3 idempotency rule: schedule edits must never create a loophole that republishes an already successful revision.

### Master time is a default, not an automatic schedule

Saving a Master default release date/time does not itself create an EventBridge schedule.

The operator must deliberately use **Schedule** for a destination. The destination can use the Master default or an explicit destination override.

### Client timezone is authoritative for human-entered schedule times

The client's IANA timezone is the default scheduling timezone. Persist the resolved UTC instant plus the timezone used for interpretation/display.

Do not silently substitute the operator/browser timezone. Invalid client timezone data must block scheduling with a clear message rather than silently choosing another timezone.

### One current scheduled release per destination revision

The data model must prevent duplicate active schedules for the same platform-version revision.

Rescheduling should update/supersede the current schedule safely and preserve enough history to understand what changed. Cancelling is allowed only before provider submission begins.

### Reuse the proven publisher

The background path must call the same core Facebook publishing service and safety rules proven in Level 3 rather than building a second provider implementation.

The scheduled worker must preserve:

- destination/client ownership checks
- live Facebook validation
- Account Health recheck
- deterministic publish idempotency
- durable publish attempts/results
- private-S3 media handling
- text/link, image, and standard video support
- exact `View Post` result handling

### EventBridge Scheduler wakes the work

The first production path should prefer the smallest architecture that satisfies the pass condition:

```text
MongoDB scheduled release
-> EventBridge Scheduler one-time trigger
-> Lambda background worker
-> existing publishing service / provider logic
```

SQS remains available if the implementation demonstrates a concrete need for queued delivery or controlled technical retries. Do not add SQS only because it was listed as an available AWS component.

### No fake approval system in Level 4

Client approvals are Level 7. Do not invent placeholder approval records simply to schedule a post.

The scheduling/publishing worker should preserve a clean future approval gate, but Level 4 may schedule the current valid operator-controlled Facebook version without Level 7 approval workflow.

### Missed schedules do not silently publish late

If the scheduled time arrives and a human/permission/content blocker prevents submission — for example stale content, unhealthy account, missing capability, or invalid destination state — mark the release as missed / needs attention and do not silently publish it later.

Temporary technical failures may use a controlled retry policy only after duplicate-safety remains proven.

### Calendar remains Level 6

Level 4 may show schedule controls and destination scheduling state inside Master Content / the Facebook editor. Do not build the full Month / Week / List Calendar experience yet.

## Task queue

| ID | Status | Task | Evidence or dependency |
| --- | --- | --- | --- |
| L4-01 | `DONE` | Build scheduling data/timezone/revision foundation | Automated checks plus deployed Nicholas_Egner -> GIGnovate live verification passed September 29, 2026 |
| L4-02 | `MANUAL` | Add Schedule / Reschedule / Cancel controls | Implementation and automated checks complete; deployed live verification is required before `DONE` |
| L4-03 | `WAITING` | Add EventBridge Scheduler + Lambda infrastructure | Depends on proven application schedule records; includes AWS IAM/environment checkpoint |
| L4-04 | `WAITING` | Publish scheduled Facebook releases in the background | Depends on L4-03 worker path and must reuse Level 3 publishing safety |
| L4-05 | `WAITING` | Add missed-schedule and controlled retry behavior | Depends on real background dispatch path |
| L4-06 | `WAITING` | Run final browser-closed GIGnovate scheduling checkpoint | Depends on all prior Level 4 tasks; requires real deployed evidence before Work review |

There should normally be only one `READY` task.

## L4-01 — Scheduling Data, Timezone, and Revision Foundation

### Objective

Create the durable scheduling model and correct time/revision semantics before any EventBridge or background publishing work begins.

The task should make it possible for later Level 4 work to say exactly **what destination revision should publish, at what instant, in what client timezone**, without changing the working Level 3 publish path.

### Acceptance criteria

1. Add a dedicated MongoDB scheduling persistence layer / collection suitable for one current scheduled release per platform-version revision, with indexes that prevent duplicate active schedules for that revision.
2. A schedule record must be tied to the correct Master Content, client, platform version, platform-version revision, social connection/destination, and platform.
3. Store the resolved release instant as an absolute UTC date/time and retain the IANA timezone used for human interpretation/display.
4. Use the saved client timezone as the default schedule timezone; do not resolve `datetime-local` values using the operator/browser timezone when the client's timezone differs.
5. Invalid or unusable client timezone data must produce a blocking scheduling error rather than silently falling back to the browser timezone.
6. Preserve Master Content's existing `defaultReleaseAt` concept as a scheduling default only. Saving a default release time must not create an AWS schedule or publish anything.
7. Define destination override semantics so later UI can choose either the Master default release time or a destination-specific release time without modifying the destination's publish-content fields.
8. Schedule-only changes must not increment the platform-version publish revision or otherwise unlock an already successful revision for republishing.
9. Correct the Master revision behavior so a schedule-only Master change does not falsely behave like a publish-content change; publish-relevant Master edits must still advance the Master revision and preserve the Level 3 stale-version protection.
10. Define and implement pure scheduling state/validation helpers for at least: no release time, invalid/past release time, active schedule, cancelled/superseded schedule, stale content revision, and already-published revision.
11. Preserve the existing Level 3 publish result and idempotency records unchanged.
12. Add focused automated tests for timezone resolution, DST-sensitive conversion where practical, Master-default versus destination-override resolution, schedule-only revision behavior, and duplicate active-schedule prevention logic that can be isolated from MongoDB.
13. Run relevant syntax/lint/tests available in the environment and record exact results below.
14. No EventBridge Scheduler, Lambda invocation, SQS work, or Facebook provider publish request may be added in L4-01.

### Live/manual verification

After deployment, use a `Nicholas_Egner` Master Content item and its GIGnovate Facebook version:

1. confirm the client timezone is displayed/used for the release-time interpretation
2. save a future Master default release date/time and reopen the item
3. confirm the same intended client-local wall-clock time is preserved after reopening
4. confirm the Facebook publish-content revision does not change merely because scheduling metadata changed
5. change a real publish-content field and confirm the normal content/version revision protection still behaves as expected
6. confirm no Facebook post and no AWS timed schedule was created by this foundation task

## L4-02 — Schedule, Reschedule, and Cancel Controls

### Objective

Add deliberate destination-level scheduling actions using the L4-01 model, still without relying on the browser to execute the release.

Planned acceptance boundary:

- `Schedule` action for an unpublished Facebook destination revision
- choose Master default time or destination override
- clear display of client timezone and resolved release time
- final confirmation before scheduling
- durable schedule state visible after refresh/reopen
- reschedule safely replaces/supersedes the current active time
- cancel works only before dispatch begins
- editing publishable content after scheduling marks the schedule stale and prevents background release until deliberately rescheduled
- already-published revisions cannot be scheduled again
- no full Calendar UI

## L4-03 — EventBridge Scheduler and Lambda Infrastructure

### Objective

Create the AWS background execution path only after application schedule records are proven.

Planned acceptance boundary:

- one-time EventBridge Scheduler entries created from durable MongoDB schedule records
- stable unique AWS schedule naming
- Lambda target able to identify the exact scheduled-release record without embedding secrets in the event
- IAM roles use least practical privilege
- Amplify/app runtime can create/update/delete the required schedules without static AWS keys
- Lambda receives required server-side environment/secrets without committing them to Git
- deleting/rescheduling an application schedule cleans up or replaces the corresponding AWS schedule
- stop for Nicholas at any AWS IAM/environment configuration checkpoint that cannot be completed safely in code

## L4-04 — Background Facebook Scheduled Publishing

### Objective

Have the Lambda/background path execute a scheduled Facebook release through the proven Level 3 publisher.

Planned acceptance boundary:

- worker reloads the schedule, Master Content, platform version, and saved social connection from MongoDB
- exact scheduled platform-version revision is checked before submission
- stale/cancelled/already-published schedules are no-ops, not remote posts
- Account Health and publish validation rerun immediately before provider submission
- existing deterministic publish-attempt idempotency remains the duplicate barrier
- private S3 image/video publishing works from the background path
- successful remote post ID/URL and publish history persist exactly as Publish Now does
- schedule state reaches published/succeeded only after provider success

## L4-05 — Missed Schedules and Controlled Retry

### Objective

Make scheduled publishing fail safely and visibly without silently posting late or creating duplicates.

Planned acceptance boundary:

- human/permission/content blockers at release time become `Missed Schedule` / needs-attention state
- stale revision does not publish
- unhealthy/disconnected destination does not publish
- definitive provider failure remains visible and retryable under duplicate-safe rules
- ambiguous provider outcomes remain locked for review rather than blind retry
- any automatic technical retry window is bounded and justified by provider-result certainty
- cancellation/reschedule races cannot create a second remote post
- history records each meaningful scheduling transition

## L4-06 — Final Level 4 Live Checkpoint

### Objective

Prove scheduling works when the operator is not keeping the application open.

Required live verification with `Nicholas_Egner -> GIGnovate`:

1. create/open a clean unpublished Facebook destination version
2. choose a near-future release time in the client's timezone
3. schedule it and verify durable application state plus the corresponding AWS schedule
4. close the browser / leave the application idle before release time
5. after the scheduled time, reopen Content Social Hub
6. confirm Facebook published exactly one post
7. confirm schedule state and Publish History show the background result
8. confirm `View Post` opens the exact scheduled Facebook post
9. run at least one safe cancel or reschedule verification before dispatch
10. verify no duplicate post occurs through refresh, retry, or worker re-entry

When this task is complete, Work reviews the evidence. Only Work may mark Level 4 complete in the README and open Level 5.

## Progress entries

### September 29, 2026: Level 4 plan opened

- Level 3 was reviewed and closed after the real GIGnovate text/link, image, video, View Post, publish-history, and idempotency checkpoints passed.
- Reviewed the current scheduling-related repository state before defining the phase:
  - clients already persist a timezone
  - Master Content already persists `defaultReleaseAt`
  - the Master Content form currently converts `datetime-local` through the operator/browser timezone
  - all Master saves currently increment the Master revision, even when only release-time metadata changes
  - the Calendar route remains a Level 6 placeholder
  - Level 3 provides the proven Facebook publisher and durable attempt history that scheduled work must reuse
- Chose a separate durable scheduling boundary so clock-time changes cannot be confused with publish-content revisions.
- Chose EventBridge Scheduler -> Lambda as the first background path; SQS remains conditional on a demonstrated retry/queue need.
- Explicitly excluded the Level 6 visual calendar and Level 7 approval workflow from this phase.
- Marked only `L4-01` as `READY`.

### September 29, 2026: L4-01 implementation complete; live verification pending

- Task ID: `L4-01` — Scheduling Data, Timezone, and Revision Foundation.
- Outcome: implementation and automated verification completed; task moved to `MANUAL` until the deployed live checkpoint is completed with `Nicholas_Egner -> GIGnovate`.
- Files changed:
  - `lib/scheduling-logic.js`
  - `lib/scheduling.js`
  - `lib/data.js`
  - `components/master-content-form.js`
  - `tests/scheduling-logic.test.js`
  - `docs/LEVEL_4_SCHEDULING.md`
- Implemented a dedicated `scheduled_releases` MongoDB persistence layer with a partial unique index that permits only one active schedule for a platform-version revision, plus release-time, Master Content, and client query indexes.
- Schedule records bind Master Content ID, client ID, platform-version ID, exact platform-version revision, social connection/destination, provider account ID, platform, UTC release instant, IANA timezone, release source, state, AWS schedule placeholder, timestamps, and missed/failure placeholders.
- Added pure scheduling helpers for IANA timezone validation, client-local `datetime-local` -> UTC conversion, UTC -> client-local display, Master-default vs destination-override resolution, active-schedule conflict detection, Master publish-content change detection, and schedule-state validation.
- DST handling is explicit: nonexistent spring-forward wall times and ambiguous fall-back wall times are blocked rather than silently resolved to an unintended instant.
- Master release-time input now displays and resolves in the selected client's saved timezone instead of the operator/browser timezone. The UI explicitly shows the timezone and states that saving the Master default does not schedule or publish anything.
- Saving release-time metadata stores both the UTC instant and the IANA timezone used for scheduling semantics.
- Master revision increments are now limited to publish-relevant source changes: client, text, destination URL, content length, media/order, primary media, and default video thumbnail. Release-time-only changes, internal-title changes, and reuse metadata do not create a false publish-content revision.
- Destination scheduling metadata remains outside `platform_versions`, so schedule-only changes cannot increment the platform-version publish revision or unlock a successfully published revision.
- Existing Level 3 publishing/idempotency files and Facebook provider code were not changed.
- Automated checks run:
  - `node --check /tmp/l4/lib/scheduling-logic.js` — passed
  - `node --check /tmp/l4/lib/scheduling.js` — passed
  - `node --check /tmp/l4/lib/data.js` — passed
  - `node --check /tmp/l4/master-content-form.js` — passed
  - `node --experimental-default-type=module --test tests/scheduling-logic.test.js` — **8 tests passed, 0 failed**
- Focused tests cover valid/invalid IANA zones, winter/summer DST offsets, nonexistent and repeated DST wall times, UTC round-trip display, Master default versus destination override, schedule-only versus publish-content revision behavior, required schedule states, and duplicate active-schedule detection.
- Full `npm run lint`, `npm test`, and `npm run build` could not be executed in the isolated execution environment because the repository checkout and installed Next.js dependencies were not available there; the changed JavaScript files passed syntax checks and the new pure scheduling suite passed independently.
- Live-test status: still required after Amplify deploy. Verify the six L4-01 manual steps above with a `Nicholas_Egner` Master Content item and its GIGnovate Facebook version.
- Decisions made inside L4-01 scope:
  - MongoDB collection name: `scheduled_releases`
  - active schedule uniqueness is enforced by `{ platformVersionId, platformVersionRevision }` with `partialFilterExpression: { active: true }`
  - release source values are `master` and `destination_override`
  - destination override wall-clock data belongs to the schedule record, not the destination's publish-content fields
  - ambiguous/nonexistent DST wall times are blocking errors
- Blockers/manual steps: deployed Amplify verification is required before `L4-01` may become `DONE` and before `L4-02` becomes `READY`.
- Remaining work: complete the L4-01 live checkpoint; keep `L4-02` and all later Level 4 tasks `WAITING` until that evidence is recorded.

### September 29, 2026: L4-01 live checkpoint passed

- Task ID: `L4-01` — Scheduling Data, Timezone, and Revision Foundation.
- Outcome: deployed live verification passed with `Nicholas_Egner -> GIGnovate`; task is `DONE` and `L4-02` is now the sole `READY` task.
- Live verification completed:
  - the Master release-time control displayed `America/Chicago` as the authoritative client timezone
  - a future Master default release time was saved and preserved as the same client-local wall-clock value after reopening the item
  - changing only the release time from 8:00 AM to 8:15 AM did not create a stale Facebook-version warning or alter the destination publish revision
  - changing real publish content caused the Facebook destination to show `Update From Master`, proving the Master revision advanced and stale-version protection remained intact
  - no Facebook post was created by the scheduling-default changes
  - no AWS timed schedule exists in L4-01; AWS scheduling remains intentionally deferred to later Level 4 tasks
- Automated evidence remains: focused scheduling suite **8 passed, 0 failed**, with changed JavaScript syntax checks passed.
- Files changed for the completion record: `docs/LEVEL_4_SCHEDULING.md` only.
- Decisions: L4-01 architecture remains unchanged; the live test confirms the schedule-only/publish-content revision boundary works in the deployed application.
- Blockers/manual steps: none for L4-01.
- Remaining work: implement only `L4-02` — destination Schedule / Reschedule / Cancel controls. Keep L4-03 and later tasks `WAITING`.

### September 29, 2026: L4-02 implementation checkpoint

- Task ID: `L4-02` — Schedule / Reschedule / Cancel controls.
- Outcome: implementation and automated verification completed; task moved to `MANUAL` until the deployed live checkpoint is completed with `Nicholas_Egner -> GIGnovate`.
- Files changed:
  - `lib/scheduling-logic.js`
  - `lib/scheduling.js`
  - `app/api/platform-versions/[id]/schedule/route.js`
  - `components/facebook-schedule-controls.js`
  - `components/facebook-platform-editor.js`
  - `app/(app)/content/[id]/page.js`
  - `tests/scheduling-logic.test.js`
  - `docs/LEVEL_4_SCHEDULING.md`
- Implemented destination-level `Schedule`, `Reschedule`, and `Cancel Schedule` controls for saved Facebook revisions.
- Scheduling can use the saved Master default release time or an explicit Facebook destination override without changing publish-content fields or destination revision solely for timing.
- The UI displays the client IANA timezone, resolved client-local wall time, and resolved UTC instant and requires a final confirmation before Schedule, Reschedule, or Cancel.
- Schedule state is persisted in `scheduled_releases` and reloaded through an authenticated destination schedule endpoint after refresh/reopen.
- Rescheduling conditionally supersedes the prior active record, preserves linkage/history, and creates a new schedule bound to the current Facebook revision.
- Cancellation is allowed only while the release remains active in `scheduled` state and dispatch has not begun.
- Saving edited Facebook content increments the destination revision; an older active schedule is then evaluated and displayed as `stale_content_revision`, requiring deliberate rescheduling to bind the new revision.
- Already-published destination revisions are blocked from scheduling again.
- No browser timer, EventBridge schedule, Lambda worker, SQS path, Facebook provider submission, or full Calendar UI was added in L4-02.
- Automated checks run before application to the repository:
  - changed/new L4-02 JavaScript syntax checks — passed
  - `node --experimental-default-type=module --test tests/scheduling-logic.test.js` — **9 tests passed, 0 failed**
- Focused scheduling coverage now includes the rule that only an active `scheduled` release with no dispatch timestamp may be rescheduled or cancelled, in addition to the L4-01 timezone, DST, revision, state, and duplicate-schedule tests.
- Live-test status: still required after Amplify deploy.
- Required live checkpoint: using `Nicholas_Egner -> GIGnovate`, verify a future Master-default schedule persists after refresh, reschedule to a destination override, edit/save Facebook content and confirm the old schedule becomes stale, deliberately reschedule the current revision, cancel before dispatch, and confirm an already-published revision cannot be scheduled again. No Facebook post should be created by these timing-only checks.
- Decisions made inside L4-02 scope:
  - schedule controls live inside the existing Facebook destination editor rather than creating the Level 6 Calendar early
  - reschedule creates a new durable schedule record and marks the prior one `superseded` rather than overwriting history
  - cancel and reschedule use conditional MongoDB transitions so a release that has begun dispatch cannot be changed by a stale UI action
  - L4-02 persists application schedule records only; AWS schedule identifiers remain null until L4-03
- Blockers/manual steps: deployed Amplify verification is required before `L4-02` may become `DONE` and before `L4-03` becomes `READY`.
- Remaining work: complete the L4-02 live checkpoint; keep `L4-03` and all later Level 4 tasks `WAITING` until that evidence is recorded.

Future implementation agents must append a dated entry containing task ID, outcome, files changed, checks/tests run, test results, live-test status, decisions, blockers/manual steps, and remaining work. Update only the selected task's status when supported by evidence. Do not declare Level 4 complete without Work review.
