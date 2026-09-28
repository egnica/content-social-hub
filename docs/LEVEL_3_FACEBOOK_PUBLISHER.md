# Level 3 Facebook Publisher

Level 3 proves the first complete publishing path in Content Social Hub using the existing Facebook Pages adapter.

The goal is not to add more networks or scheduling. The goal is to take one saved Master Content package, create a real Facebook-specific destination version, validate it, publish it to a connected Facebook Page, and persist the exact remote result so the operator can open the live post from Content Social Hub.

The primary live-test destination for this phase is:

```text
Nicholas_Egner
-> GIGnovate
-> Facebook Page
-> Healthy
```

GIGnovate is the preferred experiment destination because it is already connected and verified through the Level 2 Request Connection flow. Do not use a client Page for destructive publishing experiments unless Nicholas explicitly chooses that Page for the live test.

## Phase progress log

- Phase status: **IN PROGRESS**
- Opened: **September 28, 2026**
- Active phase document: `docs/LEVEL_3_FACEBOOK_PUBLISHER.md`
- Live-test destination: `Nicholas_Egner -> GIGnovate`
- Next implementation rule: select the first task marked `READY`, complete only that task, record evidence here, and return the README handoff report
- Level 3 is not complete until Work reviews the final end-to-end Facebook publishing evidence and updates the README

## Level 3 pass condition

Level 3 passes only after this real deployed flow works end to end:

```text
Create or open Master Content
-> select connected GIGnovate destination
-> create/load Facebook platform version
-> edit Facebook-specific fields
-> live validation passes
-> preview reflects the version
-> Publish Now
-> final confirmation
-> account health/capability rechecked
-> duplicate submission protected
-> Facebook accepts the post
-> remote post ID saved
-> remote post URL saved or deterministically recovered
-> View Post opens the exact live Facebook post
```

A successful build or mocked API response is not sufficient. A real Facebook Page publish is required before Level 3 can be closed.

## Locked Level 3 architecture decisions

These decisions follow the existing README and Level 2 architecture and should not be redesigned during a bounded task unless a demonstrated implementation problem requires it.

### Platform versions are separate records

Use a dedicated `platform_versions` collection rather than embedding destination-specific publishing state inside `master_content`.

Each platform version should be independently addressable and tied to:

- one Master Content record
- one client
- one saved social connection / destination
- one platform

This boundary is important because later phases will attach destination-specific approvals, schedules, revisions, publish results, and analytics to the platform version.

A reasonable uniqueness boundary is one active platform version per:

```text
masterContentId + socialConnectionId
```

Selecting a destination creates or reactivates its version. Unselecting a destination should exclude it without silently deleting previously customized work.

### Master defaults, destination overrides

A new Facebook platform version initially inherits useful Master Content defaults:

- source text -> Facebook message
- primary URL -> Facebook destination link
- attached media/order -> Facebook media selection
- default primary media -> Facebook primary media

The version must track whether it is still inheriting or has been customized. Later Master edits must not silently overwrite customized Facebook work.

The first Level 3 implementation may use a compact inheritance marker such as the Master revision last synchronized plus a customization flag; it does not need the full Level 7 approval/revision system yet.

### Publishing attempts are durable records

Use a separate publish-attempt/result log rather than only overwriting status fields on a platform version.

Publishing records should support an audit trail containing at least:

- platform version ID
- Master Content ID / revision at publish time
- social connection ID
- platform
- attempt / idempotency identifier
- status
- started/completed timestamps
- provider post ID when successful
- provider post URL when available
- sanitized provider error details when failed

Never store decrypted OAuth access tokens in publishing records or logs.

### Approval is not a Level 3 gate

Client approval is Level 7. Do not build fake approval state simply to satisfy Publish Now.

Level 3 should leave a clean future gate in the publishing service, but a currently valid operator-triggered Facebook version may publish without Level 7 approval workflow.

### Scheduling is not part of Level 3

`Publish Now` is the only release path in this phase. Do not add EventBridge, Lambda scheduling, SQS scheduling orchestration, missed-schedule behavior, or calendar work while completing Level 3.

### Media stays private

The S3 media bucket remains private. Do not make media public to simplify Facebook publishing.

When media publishing begins, the application should transfer/read media server-side using the existing private S3 permissions and upload it to Meta using the provider's supported publishing flow.

### Facebook connection architecture stays intact

Reuse the verified Level 2 social connection and encrypted Page access token. Do not rebuild OAuth, Page selection, client scoping, token encryption, or Account Health for Level 3.

Every publish must resolve the social connection by the platform version's saved connection ID and confirm:

- connection belongs to the same client as the Master Content/version
- platform is Facebook
- health is publishable / rechecked before provider submission
- required capability remains available

## Task queue

| ID | Status | Task | Evidence or dependency |
| --- | --- | --- | --- |
| L3-01 | `DONE` | Add destination / platform-version foundation | Deployed and live-verified with `Nicholas_Egner -> GIGnovate`; scoped selection, persistence, exclusion/reactivation, and no-publish behavior passed |
| L3-02 | `READY` | Build Facebook editor, inheritance, live validation, and preview | L3-01 platform-version foundation is verified |
| L3-03 | `WAITING` | Publish first real Facebook text/link post | Depends on L3-02; live checkpoint uses `Nicholas_Egner -> GIGnovate` |
| L3-04 | `WAITING` | Add Facebook image publishing from private S3 | Depends on successful text/link publishing and provider result persistence |
| L3-05 | `WAITING` | Add Facebook video publishing from private S3 | Depends on stable publish pipeline; standard Page video first, not Reels |
| L3-06 | `WAITING` | Verify failure handling, retry, idempotency, View Post, and final Level 3 checkpoint | Depends on prior publishing tasks; requires deployed live evidence before Work review |

There should normally be only one `READY` task. Do not begin a later task because it appears straightforward.

## L3-01 — Destination / Platform-Version Foundation

### Objective

Extend the existing Master Content record into the planned `Master Content -> Platform Version` hierarchy without publishing anything externally.

A saved Master Content item must be able to select a healthy connected Facebook Page belonging to the same client. Selecting the Page creates or loads a persistent Facebook platform-version record. Reopening the Master Content item must restore that selected destination/version correctly.

### Acceptance criteria

1. Add a dedicated `platform_versions` persistence layer / collection and required indexes.
2. A platform version is tied to the correct:
   - Master Content ID
   - client ID
   - social connection ID
   - platform (`facebook`)
3. Enforce a uniqueness rule so the same Master Content + destination cannot create duplicate active versions through repeated selection/saves.
4. The Master Content edit experience can retrieve the client's saved Facebook connection(s) and show the actual Page name/avatar where practical.
5. Destination selection must be scoped to the Master Content client; a Page connected to another client must never appear as an eligible destination.
6. Only Facebook connections with a publishable/healthy capability state should be selectable for the normal path. A non-publishable connection may be shown as unavailable only if that makes the reason clear.
7. Selecting a Facebook destination creates or reactivates its version without posting to Facebook.
8. Unselecting/excluding a destination must not silently delete customized/version data. Preserve the record in an inactive/excluded state or equivalent recoverable representation.
9. Reopening the Master Content item restores the selected destination and platform version from MongoDB.
10. Initialize the new Facebook version from Master defaults needed by later tasks, including at least text, primary URL, and media/default-media references where present.
11. Record a Master revision/synchronization marker sufficient for L3-02 to determine whether Master Content changed after the version was initialized.
12. Add focused automated coverage for client/destination scoping, duplicate prevention, create/reactivate/exclude behavior, and inherited defaults.
13. Run relevant syntax/lint/tests available in the environment and record exact results below.
14. No Facebook Graph publishing request may be made in L3-01.

### Live/manual verification

After deployment:

1. Open or create Master Content owned by `Nicholas_Egner`.
2. Confirm **GIGnovate** appears as its Facebook destination.
3. Select GIGnovate and save.
4. Reopen the same Master Content item and confirm GIGnovate remains selected.
5. Confirm Davis Criminal Defense and Let Us Clean LLC are not offered as Nicholas_Egner destinations.
6. Unselect/exclude GIGnovate, save, then reselect it and confirm the prior platform-version record is reused/reactivated rather than duplicated.
7. Confirm nothing was published to Facebook.

### Out of scope for L3-01

- Facebook editor UI beyond the minimum destination/version foundation
- polished Facebook preview
- provider publishing calls
- publish confirmation
- publish-attempt logging beyond any schema groundwork strictly needed for the version model
- image/video transfer to Meta
- scheduling
- approvals
- analytics
- other social networks

## L3-02 — Facebook Editor, Inheritance, Validation, and Preview

### Objective

Turn the selected Facebook destination version into a real editable publishing form while preserving the Master-default/platform-override rule.

The operator should be able to edit the saved GIGnovate Facebook version, understand whether it still matches the current Master Content revision, see live blocking/warning validation, and view an approximate Facebook post preview. This task still must not publish anything to Meta.

### Acceptance criteria

1. Render a Facebook-specific editor for each active Facebook platform version on the Master Content edit page.
2. Clearly identify the destination Page using the saved destination name and avatar where available.
3. Expose editable Facebook-version fields for at least:
   - message/caption
   - destination URL
   - selected media inherited from attached Master media
   - primary media choice where media exists
4. Persist edits to the existing `platform_versions` record rather than creating a second version for the same Master Content + social connection.
5. Editing Facebook-specific fields marks the version as customized and increments/records a destination revision suitable for later publish logging.
6. New/unmodified platform versions retain their inherited Master defaults and `masterRevisionSynced` marker.
7. If the Master Content revision changes after a Facebook version was synchronized, the editor must detect that difference and show a clear `Master content changed` state.
8. A customized Facebook version must never be silently overwritten when Master Content changes.
9. Provide a deliberate action to synchronize/reset the Facebook version from the current Master defaults. That action must update the synchronized Master revision and make clear that destination-specific edits are being replaced.
10. Live validation must run without a separate Preflight button and include at minimum:
    - blocking state when the saved destination is no longer healthy/publishable
    - blocking state when the version has no usable message, URL, or media
    - warnings/non-blocking notices where useful for stale Master inheritance
11. Render an approximate Facebook-style live preview using the current version state, including destination identity, message, and available link/media treatment where practical.
12. Save/reopen must restore the Facebook version fields, customization state, synchronization marker, and validation-relevant state.
13. Excluded/inactive platform versions must not appear as active editable/publishable destinations until reactivated.
14. Add focused automated coverage for inherited-vs-customized behavior, Master revision change detection, reset/update-from-Master behavior, validation, and persistence logic that can be isolated from MongoDB/UI rendering.
15. Run the relevant tests/lint/build or syntax checks available in the environment and record exact results below.
16. No Facebook Graph publishing request, remote post creation, publish attempt, scheduling, approval flow, or analytics work may be added in L3-02.

### Live/manual verification

After deployment, use the existing `This Test 1` Master Content item owned by `Nicholas_Egner` and its saved GIGnovate platform version unless a cleaner temporary item is preferred.

1. Open the Master Content item and confirm the active GIGnovate Facebook editor loads with inherited source text and destination URL.
2. Change the Facebook message to a destination-specific value, save, refresh/reopen, and confirm the override persists.
3. Change the Master source text, save Master Content, and confirm the customized Facebook message is not silently overwritten.
4. Confirm the editor shows that Master Content changed.
5. Use the deliberate update/reset-from-Master action and confirm the Facebook version refreshes from the current Master defaults and the stale-revision notice clears.
6. Exercise at least one blocking validation state and confirm it is visible without a separate Preflight action.
7. Confirm the Facebook preview changes live as the Facebook-version fields change.
8. Confirm nothing was published to Facebook.

## L3-03 — First Real Facebook Text/Link Publish

### Objective

Prove the first real end-to-end social publish as early as possible using a low-risk GIGnovate test post.

### Planned acceptance boundary

- server-side Facebook Page publish adapter using the saved encrypted connection token
- initial supported payload: text, text + link, or link/message combination supported by the Page feed endpoint
- final operator confirmation before any live submission
- validation rerun immediately before publish
- connection ownership and Account Health/capability rechecked immediately before publish
- idempotency / duplicate-submission protection before calling Meta
- durable publish attempt/result record
- successful provider post ID persisted automatically
- canonical/exact post URL captured or recovered automatically when supported
- platform version marked published only after Meta accepts it
- `View Post` opens the exact remote GIGnovate post
- sanitized provider failures persisted without exposing tokens/secrets

### Required live checkpoint

Use `Nicholas_Egner -> GIGnovate` for the first real test unless Nicholas explicitly chooses another Page.

Before the provider call, stop for an explicit human confirmation of the exact test content that will be published.

## L3-04 — Facebook Image Publishing

### Objective

Extend the proven Publish Now pipeline to image content while keeping S3 private.

### Planned acceptance boundary

- single-image Page publishing
- multi-image publishing where supported by the chosen Page posting flow
- selected/default media order preserved
- server-side access to private S3 media
- Meta upload performed without changing bucket public-access policy
- provider media/post IDs and final post URL persisted
- retry must not duplicate a successfully created remote post/media workflow
- real GIGnovate image-post verification

## L3-05 — Facebook Video Publishing

### Objective

Publish a normal Facebook Page video through the same version/publish-result model.

### Planned acceptance boundary

- standard Page video publishing from private S3
- progress/state suitable for potentially slower provider processing
- provider video/post identifiers persisted
- final live-post URL captured/recovered
- failure remains retryable without reposting known success
- real GIGnovate video-post verification

**Reels are not part of this task.** A Reel-specific provider workflow can be added later after the standard first publisher is stable.

## L3-06 — Reliability and Level 3 Live Checkpoint

### Objective

Prove that the completed Facebook publisher is safe enough to become the foundation for later scheduling and multi-platform work.

### Required verification

- repeated/double Publish Now submissions cannot create duplicate posts for the same successful version/revision
- an already successful publish is never reposted by a retry action
- a failed attempt remains visible with sanitized error information
- retry creates a new attempt only where publishing has not already succeeded
- result history preserves prior attempts rather than overwriting the audit trail
- `View Post` opens the exact Facebook post for verified text/link, image, and video flows implemented in this phase
- publishing status is destination-specific
- account health failure blocks the affected destination before provider submission
- deployed real GIGnovate checkpoint passes

When this task is complete, Work reviews the evidence. Only Work may mark Level 3 complete in the README and open Level 4.

## Progress entries

### September 28, 2026: Level 3 plan opened

- Level 2 had already been reviewed and closed.
- Reviewed the current Master Content persistence, Master Content editor boundary, Facebook connection/token model, private S3 media layer, and existing Facebook API adapter before defining the phase.
- Confirmed the current code has no Facebook publishing POST method yet, so Level 3 can add the publisher without rebuilding Level 2 connection logic.
- Selected `Nicholas_Egner -> GIGnovate -> Healthy` as the preferred live experiment destination.
- Locked the Level 3 ordering around a separate platform-version model and durable publishing-attempt records.
- Explicitly excluded scheduling, approvals, additional providers, analytics, and Reels from the first publisher phase.
- Marked only `L3-01` as `READY`.

### September 28, 2026: L3-01 destination / platform-version foundation

- Task: `L3-01`
- Outcome: **DONE**
- Implementation commit: `0dd0099f0f509ef28875badb20d8f63f8859f083` (`Add Level 3 platform version foundation`).
- Files changed:
  - `app/(app)/content/[id]/page.js`
  - `app/api/content/[id]/destinations/route.js`
  - `components/platform-destination-selector.js`
  - `lib/platform-version-logic.js`
  - `lib/platform-versions.js`
  - `tests/platform-version-logic.test.js`
- Automated verification:
  - focused platform-version logic tests passed `4/4`
  - server-side syntax checks passed
  - Amplify deployment job `43` succeeded
- Live verification completed with a temporary `Nicholas_Egner` Master Content item titled `This Test 1`:
  - GIGnovate was the only Facebook Page offered in Publishing Destinations
  - Davis Criminal Defense and Let Us Clean LLC were not offered, confirming client scoping
  - selecting GIGnovate and saving created/persisted the platform version and displayed `version saved`
  - browser refresh restored GIGnovate as selected, confirming MongoDB persistence
  - the operator then unselected/saved and reselected/saved GIGnovate, confirming the exclude/reactivate flow completed successfully
  - UI explicitly confirmed `Destinations saved. Nothing has been published to Facebook.`
  - no Facebook Graph publishing endpoint or remote publish behavior was added in this task
- Decisions:
  - platform versions remain separate MongoDB records with uniqueness on Master Content + social connection
  - exclusion preserves the record and reactivation reuses it rather than creating a replacement version
  - inherited source text, URL, media references, primary-media reference, and Master revision marker form the starting Facebook version state
- Blockers/manual steps: none remaining for L3-01
- Remaining work: `L3-02` is now the only `READY` task; build the Facebook-specific editor, inheritance/update behavior, continuous validation, and preview without publishing to Meta

Future implementation agents must append a dated entry containing task ID, outcome, files changed, checks/tests run, live-test status, decisions, blockers/manual steps, and remaining work. Update only the selected task's status when supported by evidence. Do not declare Level 3 complete without Work review.
