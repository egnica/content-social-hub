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
| L4-02 | `DONE` | Add Schedule / Reschedule / Cancel controls | Automated checks plus deployed Nicholas_Egner -> GIGnovate live verification passed September 29, 2026 |
| L4-03 | `DONE` | Add EventBridge Scheduler + Lambda infrastructure | Deployed create/wake/reschedule/cancel verification passed September 29, 2026 |
| L4-04 | `DONE` | Publish scheduled Facebook releases in the background | Deployed GIGnovate text/link, image, video, View Post, processing, and stale-revision no-op verification passed September 29, 2026 |
| L4-05 | `DONE` | Add missed-schedule and controlled retry behavior | Deployed GIGnovate stale-revision release became Missed Schedule; CloudWatch confirmed `missed / stale_content_revision` September 30, 2026 |
| L4-06 | `READY` | Run final browser-closed GIGnovate scheduling checkpoint | All prior Level 4 tasks are complete; final browser-closed evidence and Work review remain |

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
- reschedule safely replaces/supersede the current active time
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

### September 29, 2026: L4-02 live checkpoint passed

- Task ID: `L4-02` — Schedule / Reschedule / Cancel controls.
- Outcome: deployed live verification passed with `Nicholas_Egner -> GIGnovate`; task is `DONE` and `L4-03` is now the sole `READY` task.
- Live verification completed:
  - an unpublished Facebook Revision 5 showed `America/Chicago` as the authoritative client timezone and resolved the Master default `2026-09-30 08:15` to `2026-09-30T13:15:00.000Z`
  - the Schedule confirmation explicitly bound Revision 5, release time, timezone, UTC instant, and Master-default source before persistence
  - the destination was rescheduled from the Master default to a Facebook-specific `08:30` override, resolving to `2026-09-30T13:30:00.000Z`
  - editing and saving Facebook-specific text advanced the destination to Revision 6 while the Revision 5 schedule became visibly `Stale schedule` and warned that the older schedule would not release the edited content
  - deliberately rescheduling bound the `08:30` destination override to Revision 6 and returned the schedule to an active `Scheduled` state
  - cancelling Revision 6 returned the destination to a `Cancelled` state; after refresh/reopen the cancellation remained persisted and the normal `Schedule` action was available again
  - a previously published Facebook revision displayed the already-published blocking message and disabled scheduling
  - Publish History remained empty for the scheduling-only test item; no Facebook post was created by Schedule, Reschedule, stale-revision handling, or Cancel
- Automated evidence remains: changed/new L4-02 JavaScript syntax checks passed and the focused scheduling suite is **9 passed, 0 failed**.
- Files changed for this completion record: `docs/LEVEL_4_SCHEDULING.md` only.
- Decisions:
  - the revision-binding safety model is validated: publish-content edits require a deliberate reschedule rather than silently retargeting an existing schedule
  - the current scheduling UI is functionally acceptable for the working version, but it is visually more complex than desired; defer simplification/polish until the end-to-end scheduling path is proven so UI changes do not interrupt Level 4 infrastructure work
- Blockers/manual steps: none for L4-02.
- Remaining work: implement only `L4-03` — EventBridge Scheduler + Lambda infrastructure. Stop at any AWS IAM/environment configuration checkpoint requiring Nicholas; keep `L4-04` and later tasks `WAITING`.

### September 29, 2026: L4-03 implementation checkpoint

- Task ID: `L4-03` — EventBridge Scheduler and Lambda Infrastructure.
- Outcome: repository implementation and automated/AWS validation completed; task moved to `MANUAL` at the required AWS deployment/environment checkpoint. `L4-04` remains `WAITING`.
- Files changed:
  - `.env.example`
  - `app/api/platform-versions/[id]/schedule/route.js`
  - `components/facebook-schedule-controls.js`
  - `infrastructure/level4-scheduling.yaml`
  - `lib/aws-scheduler-logic.js`
  - `lib/aws-scheduler.js`
  - `lib/schedule-infrastructure.js`
  - `tests/aws-scheduler-logic.test.js`
  - `docs/LEVEL_4_SCHEDULING.md`
- Implemented one-time EventBridge Scheduler definitions from the durable MongoDB schedule record using the already-resolved UTC release instant. AWS schedule names are stable and destination-specific: `csh-facebook-<platformVersionId>`.
- Scheduler definitions use `at(UTC-time)`, `FlexibleTimeWindow: OFF`, `ActionAfterCompletion: DELETE`, and a target payload containing only the exact `scheduledReleaseId`. No OAuth token, MongoDB credential, social content, or other secret is embedded in the Scheduler event.
- EventBridge Scheduler automatic target retry is deliberately set to zero in L4-03. Controlled technical retry behavior remains owned by `L4-05`, where it can be designed around the proven publish-result/idempotency semantics rather than introduced implicitly at the wake-up layer.
- The authenticated destination schedule route now wraps the proven L4-02 MongoDB transitions with AWS create/update/delete operations. Create/reschedule/cancel include compensating cleanup/rollback so a failed AWS operation does not intentionally leave application schedule state claiming a transition that the timed trigger did not complete.
- Stable-name create handles an orphaned/conflicting Scheduler entry by replacing its full one-time definition rather than creating a second timed trigger.
- Rescheduling replaces the same destination-specific AWS schedule name while the MongoDB scheduling history still records the superseded application schedule and its replacement.
- Cancelling removes the AWS schedule before the operation is treated as complete; an already-absent AWS schedule is accepted as cleanup success.
- Added `infrastructure/level4-scheduling.yaml`, which defines:
  - a dedicated `content-social-hub` EventBridge Scheduler group
  - a Node.js 24 Lambda placeholder worker that accepts/logs only `scheduledReleaseId` and does **not** call Facebook
  - a retained Secrets Manager container for worker configuration so future background credentials are not committed to Git
  - a Lambda execution role limited to worker logging plus access to that one worker secret
  - a Scheduler target role limited to invoking the one worker Lambda, with `aws:SourceAccount` and exact schedule-group `aws:SourceArn` trust conditions
  - a policy attachment for the existing Amplify compute role allowing only Scheduler Create/Update/Delete on `content-social-hub/csh-facebook-*`, plus `iam:PassRole` for the one Scheduler target role with `iam:PassedToService = scheduler.amazonaws.com`
- The application continues using AWS temporary credentials from the Amplify compute role; no static AWS access key/secret key variables were added.
- `.env.example` now documents only the non-secret application-side Scheduler identifiers: `SCHEDULER_GROUP_NAME`, `SCHEDULED_RELEASE_WORKER_ARN`, and `SCHEDULER_TARGET_ROLE_ARN`. Worker secret values remain outside Git.
- The scheduling UI copy now reflects that a deliberate Schedule/Reschedule action creates or updates the AWS timed trigger while still making clear that L4-03 does not publish to Facebook.
- Automated checks run:
  - `node --check /mnt/data/l403/lib/aws-scheduler-logic.js` — passed
  - `node --check /mnt/data/l403/lib/aws-scheduler.js` — passed
  - `node --check /mnt/data/l403/lib/schedule-infrastructure.js` — passed
  - `node --check /mnt/data/l403/app/api/platform-versions/[id]/schedule/route.js` — passed
  - `node --experimental-default-type=module --test /mnt/data/l403/tests/aws-scheduler-logic.test.js` — **4 tests passed, 0 failed**
  - AWS CloudFormation `ValidateTemplate` on `infrastructure/level4-scheduling.yaml` in `us-east-2` — passed; template reports `CAPABILITY_IAM` as expected
  - AWS IAM Access Analyzer validation of the scoped Amplify Scheduler policy, Scheduler-to-Lambda invoke policy, and worker secret policy — **0 findings**
- IAM policy-generation check: the required `uvx iam-policy-autopilot@latest --version` check was attempted twice, but the isolated environment could not resolve `pypi.org`; no policy was uploaded or applied. The fallback used the named Scheduler/Lambda/Secrets Manager operations and current AWS service-authorization documentation, followed by Access Analyzer validation.
- Full `npm run lint`, `npm test`, and `npm run build` were not run in the isolated execution environment because a full repository checkout with installed application dependencies was not available. The L4-03 JavaScript syntax checks and new pure scheduling tests passed independently.
- Live/AWS preflight observations before any mutation:
  - the existing Amplify app uses `content-social-hub-amplify-compute-role`
  - that role currently has only the previously verified private-S3 access policy
  - `us-east-2` had no Content Social Hub Lambda function and no application EventBridge Scheduler entries before L4-03 deployment
  - the Amplify app currently has no Scheduler environment variables configured
  - the current Amplify build specification copies server environment variables into `.env.production`, so the three new Scheduler variables must be added there as part of the deployment checkpoint
- Live-test status: **not yet complete**. No AWS resources were created or modified during this implementation chat, and no Facebook publish request was made.
- Required manual/AWS checkpoint for Nicholas before `L4-03` can become `DONE`:
  1. deploy `infrastructure/level4-scheduling.yaml` in `us-east-2` using the existing Amplify compute-role name
  2. capture the stack outputs for schedule group, worker Lambda ARN, Scheduler target-role ARN, and worker-secret ARN
  3. keep worker secrets in the retained Secrets Manager resource; do not copy secret values into Git or client-visible environment variables
  4. add `SCHEDULER_GROUP_NAME`, `SCHEDULED_RELEASE_WORKER_ARN`, and `SCHEDULER_TARGET_ROLE_ARN` to the Amplify app and its `.env.production` build-spec copy list, then redeploy the application
  5. with `Nicholas_Egner -> GIGnovate`, schedule a safe unpublished destination for a future time and verify one AWS schedule exists under the expected stable name and points at the placeholder worker
  6. reschedule it and verify the same AWS schedule name is replaced with the new UTC instant rather than duplicated
  7. cancel it before dispatch and verify the AWS schedule is deleted while MongoDB retains the cancelled history
  8. run one near-future infrastructure-only wake-up and verify the Lambda logs the exact scheduled-release ID and **does not create a Facebook post**
- Decisions made inside L4-03 scope:
  - MongoDB remains authoritative; EventBridge Scheduler only holds the timed wake-up
  - one stable AWS schedule exists per destination/platform-version, while application history can contain superseded schedule records
  - the Lambda event contains only the MongoDB scheduled-release identifier
  - the L4-03 Lambda is intentionally a non-publishing placeholder; provider submission remains `L4-04`
  - SQS remains deferred because L4-03 does not yet demonstrate a concrete queue/retry need
  - current repository lockfile constraints prevent adding a new direct Scheduler SDK dependency without safely regenerating `package-lock.json`; the isolated Scheduler transport therefore uses the AWS credential-provider and SigV4 packages already pinned transitively by the existing AWS SDK dependency tree. This boundary is isolated in `lib/aws-scheduler.js`.
- Blockers/manual steps: AWS stack deployment, Amplify environment/build-spec configuration, application redeploy, and real Scheduler/Lambda verification are required before `L4-03` can become `DONE`.
- Remaining work: complete only the L4-03 manual checkpoint. Keep `L4-04`, `L4-05`, and `L4-06` `WAITING` until the infrastructure evidence above is recorded.

### September 29, 2026: L4-03 live checkpoint passed

- Task ID: `L4-03` — EventBridge Scheduler and Lambda Infrastructure.
- Outcome: deployed infrastructure and application-path verification passed with `Nicholas_Egner -> GIGnovate`; task is `DONE` and `L4-04` is now the sole `READY` task.
- Files changed during the live correction/checkpoint:
  - `.env.example`
  - `infrastructure/level4-scheduling.yaml`
  - `lib/aws-scheduler-logic.js`
  - `lib/aws-scheduler.js`
  - `tests/aws-scheduler-logic.test.js`
  - `docs/LEVEL_4_SCHEDULING.md`
- AWS infrastructure deployed in `us-east-2` with CloudFormation stack `content-social-hub-level4-scheduling`; stack reached `CREATE_COMPLETE` and later `UPDATE_COMPLETE` after the manager-Lambda correction.
- The initial direct Amplify -> EventBridge Scheduler design failed live because Amplify's SSR session policy explicitly denied `iam:PassRole` even though the compute-role policy allowed it. The architecture was corrected to `Amplify -> scheduler-manager Lambda -> EventBridge Scheduler`, with Amplify limited to `lambda:InvokeFunction` on that one manager function. The manager role alone owns scoped Scheduler Create/Update/Delete plus `iam:PassRole` for the one Scheduler target role.
- The worker Lambda remains an L4-03 placeholder: it validates/logs only `scheduledReleaseId` and contains no Facebook submission logic.
- Live verification completed:
  - Amplify deployment job `81` succeeded after the manager-Lambda correction, and job `82` succeeded after the expired one-time reschedule fallback fix
  - scheduling Facebook Revision 6 for `2026-09-29 20:56 America/Chicago` created exactly one AWS schedule named `csh-facebook-6abc356c9b523f147ecbf422`
  - the AWS schedule resolved to `at(2026-09-30T01:56:00)`, targeted `content-social-hub-scheduled-release-worker`, carried only `{"scheduledReleaseId":"6abc6bc04703f32fd49bf19b"}`, used zero automatic retries, and auto-deleted after execution
  - the placeholder worker was invoked at `2026-09-30T01:56:30Z` and logged the exact scheduled-release ID; no Facebook post or Publish History entry was created, as required for L4-03
  - because one-time schedules auto-delete after firing, rescheduling the past application record initially produced `ResourceNotFoundException`; the app transport was corrected so only that specific missing-schedule case recreates the same stable schedule name
  - rescheduling Revision 6 to `2026-09-29 21:20 America/Chicago` then created exactly one schedule with the same stable AWS name, updated expression `at(2026-09-30T02:20:00)`, and replacement Mongo schedule ID `6abc7081e14044c0e1f6ea65`
  - cancelling the 9:20 PM release returned the application state to `Cancelled` and AWS `ListSchedules` confirmed **0 remaining schedules**
- Automated and infrastructure checks:
  - focused Scheduler/manager suite reached **7 tests passed, 0 failed** after the reschedule fallback coverage was added
  - changed JavaScript syntax checks passed
  - CloudFormation `ValidateTemplate` passed for the corrected manager-Lambda template
  - the scheduler-manager direct create -> update -> delete infrastructure test passed with one stable schedule and zero remaining schedules after delete
  - Amplify job `82` passed build, deploy, and verify for commit `6cf763b0d478ceab5be723ca3130d61256902826`
- Decisions:
  - the scheduler-manager Lambda is now the permanent least-privilege boundary for application schedule management because Amplify SSR session credentials cannot perform the required `iam:PassRole`
  - EventBridge still directly wakes the scheduled-release worker at release time; the manager is only the control-plane path for create/update/delete
  - a missing AWS schedule during deliberate reschedule is recoverable by recreating the same stable schedule name; other manager/AWS errors still fail and preserve the compensating MongoDB rollback behavior
  - no Facebook publishing behavior was added in L4-03; provider submission remains entirely owned by `L4-04`
- Live-test status: complete for L4-03.
- Blockers/manual steps: none remaining for L4-03.
- Remaining work: implement only `L4-04` — Background Facebook Scheduled Publishing. Keep `L4-05` and `L4-06` `WAITING`.

### September 29, 2026: L4-04 implementation checkpoint

- Task ID: `L4-04` — Background Facebook Scheduled Publishing.
- Outcome: repository implementation and focused automated verification completed; task moved to `MANUAL` until the AWS/Amplify configuration and deployed Facebook background-publishing checkpoint are completed. `L4-05` remains `WAITING`.
- Files changed:
  - `.env.example`
  - `app/api/internal/scheduled-releases/dispatch/route.js`
  - `app/api/platform-versions/[id]/route.js`
  - `infrastructure/level4-scheduling.yaml`
  - `lib/scheduled-release-dispatch-logic.js`
  - `lib/scheduled-release-dispatch.js`
  - `lib/scheduled-release-guard.js`
  - `tests/scheduled-release-dispatch-logic.test.js`
  - `docs/LEVEL_4_SCHEDULING.md`
- Implemented an authenticated server-side scheduled-release dispatch path that reloads the durable `scheduled_releases` record and Facebook platform version from MongoDB before doing provider work.
- The dispatch path treats missing/inactive, cancelled, superseded, stale-revision, already-published, destination-mismatch, and concurrent-claim cases as no-op outcomes rather than remote Facebook submissions.
- A release is atomically claimed from `scheduled` to `dispatching` before provider work. The platform version is reloaded after the claim and its revision is checked again before entering the proven Level 3 publisher.
- Platform-version edits and Reset From Master are blocked while that destination has an active `dispatching` release. An edit that wins before the claim advances the revision and is caught by the post-claim stale-revision check, closing the normal application edit race without creating a second Facebook publisher.
- The background path calls the existing `publishFacebookTextLinkVersion` and `checkFacebookVideoPublishStatus` services. Account Health, live publish validation, deterministic submission-key idempotency, durable `publish_attempts`, private-S3 image/video transfer, provider IDs/URLs, and `View Post` persistence therefore remain the Level 3 code path rather than being duplicated inside Lambda.
- Successful provider completion marks the schedule `succeeded`, deactivates it, and copies the publish-attempt/provider references onto the schedule only after the existing publisher reports success.
- Standard video processing is handled without resubmission: a `processing` result leaves the schedule `dispatching`, and the worker polls the existing video attempt through `checkFacebookVideoPublishStatus` until success/failure or the bounded worker polling window ends.
- The internal dispatch route uses a bearer token whose raw value is expected only in the existing worker Secrets Manager configuration. Amplify stores only `SCHEDULED_RELEASE_DISPATCH_TOKEN_SHA256`, and the route compares the presented token using SHA-256 plus `timingSafeEqual`.
- Updated the inline Node.js 24 scheduled-release worker to load `dispatchUrl` and `dispatchToken` from the retained worker secret, call the authenticated application dispatch route, poll only recorded video-processing state, log outcome/reason, and return on `succeeded`/`noop`. Worker timeout is 900 seconds and memory is 512 MB to allow bounded standard-video processing checks.
- EventBridge Scheduler target retries remain at zero in L4-04. General missed-schedule classification and controlled automatic technical retries remain intentionally deferred to `L4-05`.
- SQS remains deferred because L4-04 still does not demonstrate a concrete queue requirement.
- Automated checks run in the isolated environment:
  - `node --check /mnt/data/l404/lib/scheduled-release-dispatch-logic.js` — passed
  - `node --check /mnt/data/l404/lib/scheduled-release-dispatch.js` — passed
  - `node --check /mnt/data/l404/lib/scheduled-release-guard.js` — passed
  - `node --check /mnt/data/l404/app/api/internal/scheduled-releases/dispatch/route.js` — passed
  - `node --check` on the updated platform-version route — passed
  - extracted CloudFormation inline scheduled-worker JavaScript `node --check` — passed
  - `node --experimental-default-type=module --test /mnt/data/l404/tests/scheduled-release-dispatch-logic.test.js` — **8 tests passed, 0 failed**
  - CloudFormation YAML parse/sanity check — passed; the worker definition resolves to timeout `900`, memory `512`, and contains the authenticated dispatch configuration path
- Focused tests cover valid schedule IDs, atomic-claim eligibility, cancelled/superseded no-op behavior, stale revision no-op, already-published no-op, video-processing refresh rather than resubmission, publish-result classification, and successful schedule result persistence fields.
- Full `npm run lint`, full repository `npm test`, and `npm run build` were not run because the execution container could not resolve GitHub to clone the repository and did not contain the application's installed dependency tree. The new/changed JavaScript available in the isolated workspace passed syntax checks and the focused pure suite passed independently.
- Read-only AWS preflight before any L4-04 infrastructure mutation confirmed:
  - CloudFormation stack `content-social-hub-level4-scheduling` is currently `UPDATE_COMPLETE`
  - the deployed scheduled-release worker is still the L4-03 30-second placeholder until this template update is deployed
  - the retained worker configuration secret exists
  - there were zero active EventBridge schedules at the preflight check
- Live-test status: **not yet complete**. No AWS resources or secret values were modified during L4-04 implementation, and no Facebook provider request was triggered by this implementation chat.
- Required manual/AWS checkpoint before `L4-04` may become `DONE`:
  1. generate a strong random worker bearer token and compute its SHA-256 hex digest
  2. add `SCHEDULED_RELEASE_DISPATCH_TOKEN_SHA256=<digest>` to the Amplify app and ensure the build specification copies it into the server `.env.production` alongside the other server variables
  3. populate the existing `content-social-hub/scheduled-release-worker` Secrets Manager value with JSON containing `dispatchUrl` set to the production internal dispatch endpoint and the raw `dispatchToken`; optional `processingPollSeconds` and `maxProcessingWaitSeconds` may retain the documented defaults
  4. deploy the updated `infrastructure/level4-scheduling.yaml` stack in `us-east-2` so the scheduled worker is replaced with the L4-04 dispatcher
  5. redeploy Amplify so the protected internal route and dispatch-token hash are live together
  6. with `Nicholas_Egner -> GIGnovate`, schedule a clean unpublished Facebook text/link release for the near future and verify one remote post, schedule `succeeded`, durable Publish History, provider ID/URL, and exact `View Post`
  7. repeat the background path with private-S3 image content and a standard private-S3 video so the L4-04 media acceptance boundary is proven through the same Level 3 publisher; video must refresh the existing processing attempt rather than submit a duplicate
  8. safely exercise stale, cancelled, and already-published scheduled records and confirm the worker returns a no-op without a new Facebook post
- Decisions made inside L4-04 scope:
  - the Lambda remains an AWS wake/execution wrapper; Facebook provider logic remains exclusively in the proven application publisher
  - the raw dispatch bearer token belongs only in Secrets Manager; Amplify stores only its SHA-256 digest
  - destination editing is blocked only while the release is actually `dispatching`; schedule/reschedule/cancel semantics before dispatch remain unchanged
  - generic retry/missed classification is not being pulled forward from L4-05
- Blockers/manual steps: AWS secret configuration, Amplify environment/build-spec update, CloudFormation deployment, Amplify deployment, and real GIGnovate background publishing verification are still required.
- Remaining work: complete only the L4-04 manual checkpoint and record live evidence here. Keep `L4-05` and `L4-06` `WAITING` until that evidence supports the status transition.

### September 29, 2026: L4-04 live checkpoint passed

- Task ID: `L4-04` — Background Facebook Scheduled Publishing.
- Outcome: deployed AWS/Amplify configuration and real `Nicholas_Egner -> GIGnovate` verification passed; task is `DONE` and `L4-05` is now the sole `READY` task.
- Files changed for this completion record: `docs/LEVEL_4_SCHEDULING.md` only.
- Deployment/configuration evidence:
  - the existing `content-social-hub/scheduled-release-worker` secret was populated with the production dispatch URL and raw bearer token; no secret value was committed or exposed in the repository
  - Amplify received only `SCHEDULED_RELEASE_DISPATCH_TOKEN_SHA256`, and deployment job `89` succeeded for the L4-04 application commit
  - CloudFormation stack `content-social-hub-level4-scheduling` updated successfully to the L4-04 worker; deployed Lambda configuration is Node.js 24, timeout `900`, memory `512`
- Live text/link checkpoint:
  - Facebook Revision 6 was scheduled for `2026-09-29 22:28 America/Chicago` / `2026-09-30T03:28:00Z`
  - EventBridge invoked the worker once; CloudWatch recorded zero Lambda errors and the worker logged `outcome: succeeded`, `reason: published` at `03:28:46Z`
  - after refresh, Content Social Hub showed `Succeeded`, durable Publish History, and `View Post`; the link opened the exact GIGnovate Facebook post
- Live image checkpoint:
  - a clean Revision 1 image destination was scheduled for `2026-09-29 22:36 America/Chicago` / `2026-09-30T03:36:00Z`
  - EventBridge invoked the worker once with zero Lambda errors; the worker logged `outcome: succeeded`, `reason: published` at `03:36:22Z`
  - Publish History recorded `Succeeded Revision 1 image`, and `View Post` opened the exact Facebook image post, proving the private-S3 image background path
- Live standard-video checkpoint:
  - a clean Revision 1 video destination was scheduled for `2026-09-29 22:43 America/Chicago` / `2026-09-30T03:43:00Z`
  - the worker submitted exactly one recorded video attempt, then logged `processing / video_processing` at `03:43:27Z`, `03:43:33Z`, and `03:43:38Z` without resubmitting
  - the same invocation logged `succeeded / published` at `03:43:44Z`; Lambda completed with zero errors in about 25 seconds
  - after refresh, Content Social Hub showed `Facebook video is live on GIGnovate`, `Succeeded Revision 1 video`, and `View Post` opened the exact live Facebook video
- Live stale-revision safety checkpoint:
  - Facebook Revision 3 was scheduled for `2026-09-29 22:52 America/Chicago` / `2026-09-30T03:52:00Z`
  - Facebook-specific content was edited and saved before release, advancing the current destination to Revision 4 while leaving the schedule bound to Revision 3; the UI displayed `Stale schedule`
  - at `03:52:09Z` the worker woke and logged `outcome: noop`, `reason: stale_content_revision`
  - Content Social Hub still showed no Facebook Publish History attempt for that item, and EventBridge auto-deleted the one-time schedule; no remote post was submitted
- Additional no-op/duplicate-safety evidence:
  - focused L4-04 tests cover cancelled/superseded and already-published no-op behavior
  - the prior deployed L4-02/L4-03 checkpoints already proved cancellation removes the AWS schedule before dispatch and already-published revisions cannot be scheduled again through the application
  - deterministic Level 3 publish-attempt idempotency remained the provider-submission duplicate barrier throughout all successful background tests
- Automated evidence remains: changed/new L4-04 JavaScript syntax checks passed, CloudFormation worker sanity checks passed, and `tests/scheduled-release-dispatch-logic.test.js` remains **8 passed, 0 failed**.
- Live-test status: complete for L4-04. Text/link, private-S3 image, private-S3 standard video, exact `View Post`, video processing without duplicate submission, and stale-revision no-op behavior are all proven in the deployed path.
- Decisions: the L4-04 architecture remains unchanged; Lambda is only the wake/execution wrapper and the existing Level 3 publisher remains the single Facebook provider implementation. Missed-schedule classification and controlled retry remain explicitly owned by L4-05.
- Blockers/manual steps: none remaining for L4-04.
- Remaining work: implement only `L4-05` — Missed Schedules and Controlled Retry. Keep `L4-06` `WAITING` until L4-05 is complete.

### September 29, 2026: L4-05 implementation checkpoint

- Task ID: `L4-05` — Missed Schedules and Controlled Retry.
- Outcome: repository implementation and focused automated verification completed; task moved to `MANUAL` pending deployed verification with `Nicholas_Egner -> GIGnovate`. `L4-06` remains `WAITING`.
- Files changed:
  - `lib/scheduled-release-dispatch-logic.js`
  - `lib/scheduled-release-dispatch.js`
  - `lib/scheduling-logic.js`
  - `components/facebook-schedule-controls.js`
  - `tests/scheduled-release-dispatch-logic.test.js`
  - `docs/LEVEL_4_SCHEDULING.md`
- Human, permission, content, destination, and revision blockers at release time now transition the durable schedule into `missed` / `Missed Schedule` instead of leaving a past active schedule or silently publishing late. The stale-revision path remains a no-provider-submit path and now records the missed outcome.
- Definitive provider failures remain visible and duplicate-safe. A definitive non-transient failure becomes `failed` and deactivates the schedule so the operator may deliberately retry later after fixing the issue under the existing Level 3 submission-key rules.
- Automatic retry is intentionally narrow: only a `PublishProviderError` whose recorded attempt is definitively `failed`, whose provider error is explicitly transient, and whose Level 3 submission key was therefore safely released may retry automatically.
- The automatic technical retry window is bounded to **2 retries**, **5 seconds apart**, inside the already claimed worker dispatch. The schedule remains `dispatching` during that window, so stale UI actions cannot cancel/reschedule the destination while an automatic retry is in progress.
- Ambiguous/unknown provider outcomes and publish conflicts become `review_required`, remain active as a lock, preserve the recorded publish-attempt/provider references, and are no-ops on worker re-entry. They are never blindly retried, protecting against duplicate Facebook posts when the provider may already have accepted the request.
- Runtime transition history is now appended for release-time claim, automatic retry scheduled/started, and terminal `succeeded`, `missed`, `failed`, or `review_required` outcomes. Existing reschedule/cancel history remains preserved through the durable schedule-record chain from L4-02.
- The Facebook scheduling UI now distinguishes `Publishing`, `Missed Schedule`, `Publish failed`, `Review required`, and `Succeeded`, surfaces retry count plus missed/failure details, and explains that ambiguous outcomes are locked rather than automatically retried.
- No SQS, second scheduler, second Facebook publisher, Level 6 Calendar work, or Level 7 approval state was added. EventBridge target retries remain zero; the bounded retry policy lives beside the proven provider-result/idempotency semantics in the application dispatch path.
- Existing Level 3 `publish_attempts`, deterministic submission key, private-S3 provider transfer, and provider-result handling were not changed.
- Automated checks run:
  - `node --check /tmp/l405/lib/scheduled-release-dispatch-logic.js` — passed
  - `node --check /tmp/l405/lib/scheduled-release-dispatch.js` — passed
  - `node --check /tmp/l405/lib/scheduling-logic.js` — passed
  - `node --check /tmp/l405/components/facebook-schedule-controls.js` — passed
  - `node --check /tmp/l405/tests/scheduled-release-dispatch-logic.test.js` — passed
  - `node --experimental-default-type=module --test /tmp/l405/tests/scheduled-release-dispatch-logic.test.js` — **16 tests passed, 0 failed**
- Focused coverage includes stale/unavailable missed classification, review-required worker re-entry lock, human/validation blockers, definitive transient retry eligibility, retry exhaustion, definitive non-transient failure, ambiguous-provider locking, terminal schedule-state presentation, existing video-processing refresh, and success persistence.
- Full `npm run lint`, full repository `npm test`, and `npm run build` were not run because the execution container cannot resolve GitHub to clone the repository and does not contain the application's installed dependency tree. The changed JavaScript passed syntax checks and the focused pure suite passed independently.
- Live-test status: **still required after Amplify deploy**. Use `Nicholas_Egner -> GIGnovate` to verify:
  1. a normal near-future unpublished Facebook release still succeeds through the background path after this change
  2. a scheduled revision edited before release becomes `Missed Schedule` with a stale-revision reason when the worker wakes and creates no Facebook post
  3. the missed state and transition details survive refresh/reopen and the current corrected revision can be deliberately scheduled again
  4. if a real definitive provider failure or transient provider error occurs naturally, confirm the resulting `failed` or bounded-retry history matches the recorded certainty; do not intentionally manufacture an ambiguous remote-provider submission solely for testing
  5. confirm no duplicate Facebook post occurs through worker re-entry or refresh
- Decisions made inside L4-05 scope:
  - no SQS is justified yet; the bounded retry fits safely inside the single already-claimed worker invocation
  - retry maximum is two automatic retries with a five-second delay
  - provider certainty governs retry eligibility, not merely whether an HTTP/API error occurred
  - `review_required` deliberately remains an active lock until the uncertain provider result is reviewed; it cannot be rescheduled or automatically retried
  - video status-read uncertainty is not converted into a fresh video submission; the existing provider attempt remains the source of truth
- Blockers/manual steps: Amplify deployment and the deployed GIGnovate missed-schedule regression checkpoint are required before `L4-05` may become `DONE`.
- Remaining work: complete only the L4-05 live checkpoint. If it passes, record that evidence, mark `L4-05` `DONE`, and make `L4-06` the sole `READY` task. Do not begin L4-06 in this implementation chat.

### September 30, 2026: L4-05 live checkpoint passed

- Task ID: `L4-05` — Missed Schedules and Controlled Retry.
- Outcome: deployed live verification passed with `Nicholas_Egner -> GIGnovate`; task is `DONE` and `L4-06` is now the sole `READY` task.
- Files changed for the completion record: `docs/LEVEL_4_SCHEDULING.md` only.
- Deployment evidence:
  - Amplify job `91` for commit `1c7c5bbf1ad68a278b176aa3d213f1e08ca8835d` passed build, deploy, and verify with the L4-05 implementation
  - Amplify job `92` for the then-current documentation checkpoint also passed build, deploy, and verify
- Live missed-schedule checkpoint:
  - a GIGnovate Facebook Revision 1 release was scheduled for `2026-09-30 09:14 America/Chicago` / `2026-09-30T14:14:00Z`
  - Facebook-specific content was edited and saved before release, advancing the current destination to Revision 2 while the schedule remained bound to Revision 1; the UI showed `Stale schedule` before release
  - after the scheduled time, the deployed UI changed the durable state to `Missed Schedule` and displayed `Reason: stale_content_revision`
  - CloudWatch recorded the worker at `2026-09-30T14:14:24Z` with `outcome: missed` and `reason: stale_content_revision`, followed by a normal Lambda completion
  - the stale-revision path terminated before provider submission, so the edited Revision 2 was not silently posted late under the old Revision 1 schedule
  - refreshing/reopening the deployed destination showed the persisted terminal missed state rather than reverting to an active stale schedule
- Automated evidence remains: L4-05 JavaScript syntax checks passed and `tests/scheduled-release-dispatch-logic.test.js` is **16 passed, 0 failed**.
- Retry/ambiguity safety remains covered by the focused tests: only definitive transient failures with released Level 3 submission keys may enter the two-retry/five-second automatic window; ambiguous provider outcomes remain `review_required` and locked against blind resubmission.
- Decisions: no SQS or infrastructure change is required for L4-05; the existing single-worker invocation plus Level 3 idempotency remains the retry/duplicate-safety boundary.
- Live-test status: complete for L4-05.
- Blockers/manual steps: none remaining for L4-05.
- Remaining work: run only `L4-06` — the final browser-closed GIGnovate scheduling checkpoint. Do not mark Level 4 complete or update the README implementation status until Work reviews that final evidence.

Future implementation agents must append a dated entry containing task ID, outcome, files changed, checks/tests run, test results, live-test status, decisions, blockers/manual steps, and remaining work. Update only the selected task's status when supported by evidence. Do not declare Level 4 complete without Work review.