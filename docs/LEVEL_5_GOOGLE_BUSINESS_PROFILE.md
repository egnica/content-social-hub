# Level 5 Google Business Profile

This is the active plan and progress record for continued Level 5 platform expansion. Nicholas approved moving the required remaining providers ahead of Level 6 Workflow + Calendar on October 2, 2026.

Instagram remains completed in `docs/LEVEL_5_INSTAGRAM.md`. This phase must preserve the working Facebook and Instagram publishers and the shared scheduling architecture.

## Phase state

- Status: **OPEN. Google direct connection L5-GBP-02 DONE by owner acceptance October 19; L5-GBP-03 READY for emailed Request Connection. Posting not implemented.**
- Opened: **October 2, 2026**; current checkpoint **October 19, 2026**.
- Active phase document and current progress log: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`.
- Provider: **Google Business Profile**; application identity: `google_business_profile`.
- Current task: **L5-GBP-03 READY** for secure emailed Request Connection and exact client/location scoping. L5-GBP-02 is DONE by Nicholas's October 19 explicit acceptance.
- Delivery: direct OAuth/location picker, encrypted persistence, reconnect and Account Health are on `main` in `0c4c8fb5540a694c2fc8207741d7da1691710f63` (October 15).
- Live status: October 19 screenshots show Nicholas Egner - Web Development, resource `accounts/117585782904582812392/locations/13178639929087207302`, Healthy after expiry advanced from 11:56 AM to 1:00 PM. Owner accepted connection/reliability. MongoDB client-ID mapping and the absence of an intervening consent redirect were not independently inspected.
- API access: October 14 enabled/quota-zero evidence is historical. The new connection is owner-confirmed; today's approval email/current quotas/enabled API inventory were not independently inspected. `L5-GBP-01 MANUAL` retains readiness documentation and Local Posts eligibility checks.
- Reliability outcome: screenshots support successful renewal with the same saved location. No server-side refresh defect was demonstrated; credential renewal logic was preserved. Owner accepted the task with recorded verification exceptions.
- Not implemented: Google Request Connection (next READY task), destination editor/preview, post publishing, image posts or scheduling. Connections retain **`canPublish: false`**, even when location access is Healthy.
- Other providers: YouTube `L5-YT-02/05/07 MANUAL`, final review WAITING; LinkedIn genuine-post evidence remains deferred. TikTok unopened. Broader Level 5 OPEN; Level 6 unopened.

## Scope and phase pass condition

Connect a specific Google Business Profile location to a specific Content Social Hub client. Support standard update posts with summary text, an optional supported CTA/link, and an optional compatible image. Use the same destination-version, durable result, duplicate-safety, and background scheduling model already proven for Facebook and Instagram.

The adapter passes only after direct Connect and emailed Request Connection both save the intended location under the correct client, Account Health proves usable access, standard update publishing persists the exact Google result and live link, and a browser-closed scheduled release publishes once with durable history and duplicate-safe worker re-entry.

Do not mark provider acceptance as public visibility if Google still reports processing or rejection. Confirm the exact visible result before recording the live checkpoint.

Explicitly outside this phase:

- editing core business information, hours, categories, or service areas
- review management, review replies, messaging, offers/events, product posts, or video publishing
- Google Analytics, Search Console, audience metrics, reporting, and analytics UI
- full Calendar/Dashboard redesign or client approval implementation
- YouTube, LinkedIn, TikTok, X, Pinterest, or blog implementation
- migrating MongoDB, making S3 public, or replacing the verified scheduler

## Provider references and external checkpoints

Official references reviewed October 2, 2026; recheck the relevant current pages when implementing each task:

- [Access prerequisites](https://developers.google.com/my-business/content/prereqs)
- [Basic setup](https://developers.google.com/my-business/content/basic-setup)
- [OAuth implementation](https://developers.google.com/my-business/content/implement-oauth)
- [Post creation guidance](https://developers.google.com/my-business/content/posts-data)
- [Local Posts resource and returned state](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts)

Google requires project access approval. Its current applicant prerequisites include managing a verified profile active for at least 60 days and a corresponding business website. Do not infer that Nicholas's existing Google login or a client's recent verification proves project API approval.

Standard local posts are distinct from general profile media management. Verify supported payload fields, CTA options, media rules, returned resource identity, state, and live URL using the current Local Posts API. Use the returned post resource/URL when supported, never substitute the business's generic Maps/profile page for an exact post link.

In L5-GBP-01, record only non-secret project/access evidence and the confirmed test destination. If access is missing, identify the precise manual request/configuration and mark the task `MANUAL` or `BLOCKED`; no later provider work becomes ready automatically.

Google OAuth consent, API approval, and the actual user's access to a location are separate checks. The Google authorization identity is not the publishing destination. Do not assume one Google connection automatically authorizes YouTube or GA4.

## Architecture and safety rules

- Persist the exact client, Google account/location resource identity, display identity, granted scopes, health state, and encrypted credentials as a separate `social_connections` record.
- Reuse the secure client-scoped OAuth state, limited-purpose connection links, token encryption, and Resend delivery boundaries.
- Store access and refresh credentials server-side only. Implement provider-supported renewal without silently replacing the wrong client/location or erasing a valid refresh credential when a response omits one.
- Keep platform versions independent, protect destination customization from Master changes, and bind publication/scheduling to the exact revision.
- Validate Google-specific fields while editing and again before dispatch. Do not reuse Facebook/Instagram limits without confirming them.
- Keep private media in S3. Prove Google's supported retrieval/upload method and preserve originals; never persist a signed URL as the durable media reference.
- Reuse `publish_attempts`, deterministic destination/revision duplicate barriers, provider-result persistence, and conservative ambiguous-outcome handling. Do not assume Google supplies an idempotency key.
- Reuse `scheduled_releases`, EventBridge Scheduler, the scheduler-manager Lambda, and the worker. Extend provider routing and infrastructure permissions only for this adapter.
- Preserve client timezone, stale-revision blocking, pre-dispatch cancellation, bounded certainty-aware retries, and worker re-entry safety.
- Nicholas explicitly expanded L5-GBP-00 on October 2 to include Instagram token renewal and interrupted scheduled-processing recovery. Notification delivery and other-provider recovery remain later bounded assignments; preserve the existing architecture.

## Ordered task queue

| ID | Status | Task | Dependency / required evidence |
| --- | --- | --- | --- |
| L5-GBP-00 | `DONE` | Baseline maintenance checkpoint | Accepted October 2, 2026 with deployed smoke evidence; unavailable live edge cases explicitly deferred |
| UX-01 | `DONE` | Approved post composer experience | Accepted for roadmap progression October 12 after editor changes and user review |
| L5-GBP-01 | `MANUAL` | Google Business Profile access readiness | Location identity recorded; independently inspect selected Content Social Hub client ID, current Google quota/approval and Local Posts publishing entitlement |
| L5-GBP-02 | `DONE` | Direct OAuth, location selection, credential renewal, Account Health | Owner accepted October 19 after Healthy connection, same-location renewal evidence, deployed UI review; manual/full-check exceptions retained |
| L5-GBP-03 | `READY` | Secure Request Connection and client scoping | Build real Resend setup, client-bound Google location selection, expiration/replay/replacement guards, and client-isolation proof |
| L5-GBP-04 | `WAITING` | Destination version, validation, and preview | Connection paths proven; separate editable Google version with Master protections |
| L5-GBP-05 | `WAITING` | Standard text/CTA update publisher | Editor accepted; real visible post, durable exact result/history, duplicate protection |
| L5-GBP-06 | `WAITING` | Private-S3 image update publishing | Text publisher proven; real image result without public bucket access |
| L5-GBP-07 | `WAITING` | Shared background scheduling and reliability | Direct publisher proven; browser-closed publish, cancellation/stale guards, worker re-entry |
| L5-GBP-08 | `WAITING` | Final adapter evidence and Work review | Complete deployed evidence, Facebook/Instagram regression review, closure decision |

**Queue authority:** the table above and the latest October 19 closure entry are current; dated handoffs below preserve historical states. L5-GBP-02 is DONE; **L5-GBP-03 is the sole READY task**. L5-GBP-04+ remain WAITING.

Historical October 12 handoff: Nicholas accepted moving past the published composer review and approved LinkedIn as the active provider while Google awaits API approval. UX-01 is DONE for roadmap progression; no new live post was submitted. L5-GBP-01 is MANUAL. L5-LI-01 is the sole READY task in the new LinkedIn phase. Google OAuth remains WAITING.

## UX-01 — Post Composer Experience

Nicholas explicitly paused further platform expansion on October 12 to review the content experience, then approved the interactive composer mockup and implementation. This is one bounded editor task, not the full Level 6 Dashboard/Calendar phase. Facebook/Instagram publishers, private media, revision gates, and shared background scheduling remain unchanged.

### Acceptance criteria

1. Present connected account cards with platform icons, exact account identities, selection state, and derived destination statuses.
2. Place a collapsible Master Content section above Posting to. Use keyboard-accessible tabs only for selected social accounts. Keep mounted editors and unsaved text when switching tabs; preserve independent destination copy and saved customization. Updated to Nicholas's approved top-down hierarchy on October 12 after deployed UI review.
3. Use one Master media tray for uploads, default selection, removal, and ordering. Show each asset once with a Default badge; place an Add media tile alongside assets, keep metadata under Details, and show ordering controls only for multiple files. Per-account choices retain their thumbnail controls. Updated to Nicholas's approved tray refinement on October 12. Only show short/long format when video is attached. Keep immediate private uploads, media reuse, cover support, and uploaded duration.
4. Provide a visible Facebook Website preview choice that clears attached media for a native link post. Preserve Instagram image/Reel/carousel detection, all provider validation, and exact carousel order.
5. Combine Publish now and Schedule into one account-specific publishing area. Show account/timezone, exact final confirmation, and useful scheduled/error states. Put technical schedule/history details behind disclosure. Keep cancellation, stale-revision, certainty-aware retry and duplicate barriers. A passed time must not stop the operator from opening Change schedule to select a future time.
6. Show recorded successful publication as a success state with actual timestamp and exact provider link. Published views size the outer card to fit a compact single column: one result header, then the saved post preview, then a shaded footer containing Post details and Publishing history, both closed initially. Remove redundant published headings/status copy; retain clearly styled exact View Post buttons. Make that saved revision read-only and remove routine already-published red blockers. Preserve processing/review controls and audit history. Create a new draft copies only source content/media; no identity, approvals, releases, remote results or old publishing state.
7. Require clean lint, passing relevant/full tests, a production build, and browser checks of the actual React components with isolated API fixtures on desktop/mobile. Do not interpret fixtures or a build as live provider evidence.
8. Keep GitHub commit/push and deployment as manual checkpoints. After deployed smoke review passes, mark UX-01 DONE and restore L5-GBP-01 as the sole READY task. No Google implementation or full Level 6 work in this task.

## L5-GBP-00 — Baseline Maintenance Checkpoint

### Objective

Repair the demonstrated test-runner, carousel-validation/test, and lint gaps, and implement the Instagram renewal/recovery follow-ups Nicholas requested here, before building the Google adapter. Make the smallest changes that preserve the proven publishing, destination editing, and client-switching behavior.

### Acceptance criteria

1. Reproduce the October 2 baseline with the current repository and supported Node version before editing.
2. Make `npm test` work under the documented supported runtime. The existing command's `--experimental-default-type=module` flag was rejected under Node 24.19.0; choose a supported invocation without a speculative module-system migration. Document the runtime requirement.
3. Resolve both failing carousel tests by checking current official Instagram rules for carousel video ratios. Update fixtures/tests if the restriction is correct; update validation and meaningful boundary coverage if the implementation is wrong. Do not accept 9:16 solely to satisfy a stale fixture.
4. Resolve the two `react-hooks/set-state-in-effect` lint errors while preserving client-scoped connection display and correct link-preview reset/loading/error behavior. Avoid blanket lint suppression or a broad editor rewrite.
5. Run the complete test suite, lint, and production build. Require zero test failures and zero lint errors; document each retained warning and whether it affects this task. Do not call the baseline clean without reporting warnings.
6. Review the diff for unintended application or documentation changes and verify no secrets were introduced.
7. Record exact commands, runtime, counts, files, decisions, and live-verification status here. If UI changes affect the verified connection/preview paths, specify the focused deployed smoke test rather than treating the build as live proof.
8. Do not implement Google API/OAuth code, change external accounts, submit real posts, perform full UX work, or implement notification delivery/full cross-provider monitoring in this task.

9. Renew eligible, unexpired Instagram long-lived credentials server-side, verify exact account identity before saving, encrypt the result, and prevent concurrent reconnects from being overwritten. Publishers must use the renewed credential. Test expiry, eligibility, rejection, identity mismatch, and concurrency.
10. Reuse the authenticated dispatch endpoint and existing worker for periodic maintenance. Resume only recorded Instagram processing attempts with matching client/destination/revision; never create a replacement attempt during recovery. Persist success or hold uncertain/interrupted submissions for review. Bound scanning and verify worker routing and duplicate-safe recovery.
11. Validate changed infrastructure locally and record a deployment checklist, including browser-closed renewal/recovery and worker-error observation. No AWS deployment or external posts in this chat.

### Completion and next task

After checks pass and required UI smoke evidence is accepted, mark L5-GBP-00 `DONE` and L5-GBP-01 as the sole `READY` task. If deployment/manual smoke is required, use `MANUAL` and leave access readiness `WAITING`.

## L5-GBP-01 — Google Business Profile Access Readiness

Confirm the exact test client/location with Nicholas and inspect the non-secret Google project access status. Recheck current prerequisites, enabled APIs, intended OAuth scopes, callback plan, consent configuration, and account/location selection mechanism. Document missing manual actions and the minimal environment-variable names without recording their values.

No OAuth implementation or external account modification in this task. It is `DONE` only when the required access/configuration path is supported by evidence; otherwise retain a named manual/blocking checkpoint. Only then may L5-GBP-02 become `READY`.

## L5-GBP-02 — Direct OAuth / Location / Renewal / Health

Add a dedicated provider adapter and only the shared connection seams it needs. Prove expiring one-time client-scoped OAuth, explicit location choice, encrypted credentials, supported token renewal, safe revoked/expired/permission handling, and location-scoped health/capability checks. Confirm the actual destination before persistence. Verify persistence and client switching with a real eligible location, without publishing.

### October 19 follow-up: connection reliability

The existing L5-GBP-02 task is reopened as READY; do not build another connection adapter or begin Google posting. Preserve the owner's confirmed connection while investigating the recurring reconnect report.

1. Inspect existing OAuth, serialized expiry/health state and `refreshGoogleBusinessConnectionHealth` before editing. Record the actual client/account/location and sanitized health/error evidence. Verify refresh-token presence as a boolean only; never output credentials.
2. Distinguish access-token expiry, stale displayed health, missing/revoked refresh authorization, OAuth-client mismatch and provider permission/API errors. Do not assume an expiring access token requires user reauthorization or claim a root cause from the report alone.
3. If a defect is demonstrated, make the smallest correction preserving browser-bound one-time OAuth, encryption, same-location reconnect, client isolation, refresh-token retention and concurrent-update guards. Do not add a speculative background service.
4. Run focused connection tests and relevant full checks for any code change. Keep new results separate from the October 15 282-test baseline.
5. Verify the same saved location after reload/client switching and renewal across a natural access-token expiry without another consent flow. Use safe mocks for missing/revoked/omitted refresh fields and identity/concurrency negatives; do not revoke or alter production credentials just to test.
6. Record what is automated versus live. If local fixes are ready but the natural live checkpoint remains, return to MANUAL. Mark DONE only with supported evidence and owner acceptance, then promote L5-GBP-03 alone to READY. Preserve L5-GBP-01's exact remaining evidence rather than treating OAuth success as Local Posts approval.

## L5-GBP-03 — Request Connection

Extend requested-platform state, secure setup page, and Resend email copy for Google Business Profile. Preserve existing multi-provider link behavior and the proven direct-connection flow.

### Acceptance criteria

1. A selected Content Social Hub client with Approval / Report Email may receive a Google Business Request Connection using the existing 48-hour limited-purpose setup link. Replace only older unfinished same-platform requests; do not revoke unrelated requests.
2. The email and private setup page clearly identify Google Business Profile, with no owner workspace navigation, account credentials, or unapproved publishing claims.
3. An owner/manager of the business authorizes Google OAuth without a Content Social Hub owner session. A one-time OAuth state binds the request, browser, platform and immutable client ID; no requestToken may override the bound client.
4. Choose one exact location/account from the Google-authorized options. Confirm the selected location with Google before encrypted persistence under the request's client; never silently pick a location.
5. Block expired, revoked, replaced, already-completed, wrong-platform and wrong-client requests before OAuth state creation, before location selection, and immediately before saving. Browser-binding and one-use selection token must also prevent replay.
6. Save Google completion status independently inside a multi-platform request. Only mark the entire request Completed after all requested platforms connect.
7. Preserve Google owner-only direct Connect/reconnect, refresh-token retention, Account Health and `canPublish: false`; avoid regressions to Facebook, Instagram, LinkedIn and YouTube requests.
8. Run request-scoping/provider integration checks, the full Node 24.19.0 test/lint/build suite and deployed browser checks. A real Resend email, private-window authorization, correct-client location mapping, completed/replaced link behavior and owner-workspace isolation require live verification.
9. Do not implement Google destination editing, publishing or scheduling. Record evidence, manual steps and deployment status here; do not promote L5-GBP-04 before acceptance.

## L5-GBP-04 — Version / Validation / Preview

Implement Google destination selection and a separate version for standard updates, summary, supported CTA/link, image selection, and schedule inheritance. Verify Master inheritance/customization/reset behavior, revision boundaries, continuous blocking/warning rules, and an approximate preview. Do not publish yet. Expand detailed criteria before this task becomes `READY`.

## L5-GBP-05 — Standard Text / CTA Publisher

Require final confirmation, server-side ownership/health/validation rechecks, an exact revision, and a durable submission barrier. Prove a real standard update and supported CTA behavior. Distinguish remote acceptance, processing, visible publication, and rejection. Persist provider resource identity, exact URL, status, history, and safe known-failure versus ambiguous retry semantics. Reopen/refresh must preserve result and duplicate lock.

## L5-GBP-06 — Image Publisher

Confirm current media constraints, transfer/retrieval, and lifetime requirements. Prove one image update from private S3 while preserving originals. Reuse the existing publisher/result barrier; media handling must not create a second post. Verify the actual Google image result, exact post link, and durable history.

## L5-GBP-07 — Background Scheduling / Reliability

Extend shared provider dispatch, schedule validation, UI labels, and narrow AWS permissions for `google_business_profile`. Prove exact revision/timezone persistence, one trigger, browser-closed publication, exact result, and duplicate-safe worker re-entry. Explicitly verify pre-dispatch cancellation and stale revisions. Define and test what happens if provider processing exceeds the worker window or the worker is interrupted; resume recorded work and never blindly resubmit ambiguous results. No second scheduler.

## L5-GBP-08 — Adapter Review

Collect deployed evidence for all scoped connection/publishing/scheduling paths, focused Google live checkpoints, and appropriate Facebook/Instagram regression evidence. Review credential renewal and remaining operational risks. Work and Nicholas decide closure; no implementation chat may declare broader Level 5 complete. If accepted, preserve this record and deliberately open YouTube with one `READY` task. Do not open Level 6.

Later-task sections are planned boundaries, not permission to start them. Work must expand provider-verified acceptance criteria before promoting a later task to `READY`.

## Operational follow-ups tracked before Level 6

These are review findings awaiting bounded assignments, not extra ready tasks:

- safe Instagram token renewal and proactive expiration/health checks
- failed/missed-schedule and reconnection notification delivery
- worker error monitoring and interrupted/prolonged processing reconciliation across providers
- an explicit operational-readiness review before Level 6 opens

Central Needs Attention, aggregate Content status, calendar views, client dashboard summaries, and stale dashboard copy remain Level 6 work. Do not move full UX implementation into this phase. Work must distinguish a deferred UI from missing background reliability.

## Progress entries

### October 2, 2026: Roadmap expansion approved and phase opened

- Outcome: Nicholas approved the reviewed roadmap change. Required remaining order is Google Business Profile -> YouTube -> LinkedIn -> TikTok before Level 6; Pinterest/X are optional and blog publishing is a later explicit destination phase.
- Preserved the closed Instagram completion record and all recorded live evidence. Broader Level 5 is now active rather than falsely treating all platforms as complete.
- Files changed: `README.md`, `AGENTS.md`, `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`.
- Corrected stale README handoff pointers/current task and the agent documentation map.
- Only L5-GBP-00 is `READY`; all later tasks are `WAITING`.
- Review baseline at `08bcc99`: build passed; direct `node --test tests/*.test.js` reported 142 tests, 140 passed, 2 failed; `npm test` rejected its obsolete flag under Node 24.19.0; lint reported 2 errors and 6 warnings.
- Documentation checks: README YAML parsed; project/implementation/task pointers agree; queue has exactly one `READY` task and eight `WAITING` tasks; code fences and stale task references checked; `git diff --check` passed. No application checks were repeated for this documentation-only change.
- These failures are recorded for L5-GBP-00, not fixed by this documentation update. Token renewal, alerts, and worker recovery remain tracked follow-ups.
- Live-test status: no Google access/connection/post proven; no new live publish performed. Existing Facebook/Instagram evidence remains in their closed phase documents.
- Decisions: location identity is separate from Google login; reuse private S3 and shared publish/schedule safety; required blocked providers cannot be skipped without Nicholas's explicit deferral.
- Blockers/manual steps: Google project approval, OAuth configuration, and exact eligible test destination must be verified in L5-GBP-01. TikTok eligibility requires separate review in its future phase.
- Remaining work: complete the maintenance checkpoint, then access readiness. No application implementation or external credentials changed while opening this plan.

Append dated entries for each task with outcome, changed files, checks/results, live status, decisions, blockers/manual steps, and remaining work. Update statuses only when evidence supports them.


### October 2, 2026: L5-GBP-00 Instagram maintenance prepared locally

- Outcome: Nicholas asked to handle the three Instagram follow-ups here. This explicitly expanded the bounded maintenance task to baseline test/lint repairs, credential renewal, and interrupted scheduled-processing recovery. Local implementation is complete; task status is **MANUAL**, awaiting approved publication/deployment and focused live evidence. L5-GBP-01 remains **WAITING**. The closed Instagram phase is preserved.
- Runtime: Node **24.19.0**. `npm test` now uses `node --test tests/*.test.js`; use Node 24 for the documented verification environment. No package-wide module-system migration. Node emits its existing `MODULE_TYPELESS_PACKAGE_JSON` syntax-detection warnings; npm also reports an environment `http-proxy` warning. These are not test failures and were not suppressed.
- Baseline reproduced on `866cc3e`: old `npm test` rejected its flag; direct tests **142 total, 140 passed, 2 failed**; lint **2 errors, 6 warnings**.
- Baseline changes: replaced the obsolete test flag; supplied a 4:5 carousel-video fixture and explicit supported-ratio boundary coverage; keyed the connection-state component to the server/client snapshot; used normal OAuth links; made preview data belong to its requested URL and ignored aborted results; stabilized editor media dependencies. No broad UX redesign.
- Carousel rule limitation: Meta's current media reference and Instagram Login/refresh documentation returned HTTP 429 or a login wall during verification. The Meta-maintained Postman collection confirmed Reel-specific guidance but did not provide a retrievable current carousel-video specification. **The carousel API's full current ratio allowance has not been proven.** The existing 4:5–1.91:1 product boundary is retained, explicitly described as currently supported, with a compatible fixture. Do not infer broader support or close this requirement without current official evidence and an appropriate live check. References: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/ ; https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token ; https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api .
- Renewal: unexpired credentials within seven days of expiry, at least 24 hours old, are eligible; attempt cooldown is one hour. Missing/invalid expiry or issue time is conservatively skipped. Legacy connection `createdAt` provides the age fallback; reconnection records issuance and resets renewal metadata. Refresh uses `graph.instagram.com/refresh_access_token` with `ig_refresh_token`, followed by exact account verification, encryption, and a compare-and-set save. Concurrent renewal/reconnect cannot overwrite a newer credential. Expired/revoked access still requires reconnect. Provider errors omit renewal payloads/URLs. All three publishers reload the saved encrypted credential after preflight and validate that current connection.
- Recovery: the existing authenticated dispatch route and Lambda gain an `instagram_maintenance` action. A recurring Scheduler trigger runs every 15 minutes, handling at most one due connection and one idle release per tick. The route and worker allow up to 180 seconds for maintenance; provider requests have 10-second bounds. A database lease prevents competing recovery ticks. Only Instagram releases already `dispatching` and idle at least 20 minutes are considered. The same client, destination, revision, attempt, and recorded containers are required; processing is continued through the existing status checker. Saved provider success can repair local destination/schedule metadata without another provider submission. Processing older than 24 hours, missing/incomplete attempts, and uncertain outcomes go to `review_required`, retaining the active destination lock. Editing and manual Instagram publishing are blocked during that review. Read failures preserve the submission and surface maintenance errors; no recovery path creates a fresh attempt or retries an ambiguous publication.
- Monitoring: added a CloudWatch alarm for existing worker `Errors`; maintenance reports safe counters and fails the invocation on renewal/read errors. **No alarm delivery actions or notification emails were added.** The worker rejects an old application handler lacking the maintenance response marker. Non-Instagram recovery, missed undelivered Scheduler triggers, direct unscheduled-attempt recovery, daily checks of unknown/far-future expiries, and alert delivery remain separate work.
- Files changed: `package.json`; `components/connections-manager.js`, `components/facebook-platform-editor.js`, `components/instagram-platform-editor.js`; `lib/connections.js`, `lib/instagram.js`, `lib/instagram-token-maintenance.js`, `lib/instagram-maintenance.js`, `lib/instagram-recovery-logic.js`, `lib/instagram-carousel-publish-logic.js`, `lib/instagram-publisher.js`, `lib/instagram-publishing.js`, `lib/instagram-carousel-publishing.js`, `lib/instagram-reel-publishing.js`, `lib/scheduled-release-dispatch.js`, `lib/scheduled-release-guard.js`; both changed publish/worker routes; `infrastructure/level4-scheduling.yaml`, `infrastructure/scheduling.guard`; carousel tests, four new maintenance/recovery test files and two test helpers; `README.md`, `AGENTS.md`, this document.
- Automated evidence: `npm test` **165 passed, 0 failed**; `npm run lint` **0 errors, 0 warnings**; `npm run build` passed. Tests cover renewal eligibility/expiry/cooldown, rejected/malformed provider responses, exact account identity, concurrent renewal/reconnect, Account Health persistence and credential redaction, renewed credentials in all three publishers, bounded scans, recorded/container/revision/client recovery, lease re-entry, saved-success reconciliation, ambiguous/read-failure locks, review edit/publish guards, authenticated routing, worker polling, and rejection of an older handler.
- Infrastructure evidence: `cfn-lint infrastructure/level4-scheduling.yaml` passed; CloudFormation Guard **3.2.1** validation with `infrastructure/scheduling.guard` passed. A synthetic negative fixture containing a plaintext `SecretString` was rejected as expected. Rules cover secret retention/no plaintext, IAM actions, absence of a public Lambda URL, maintenance cadence/retry bound, worker runtime/timeout, and Scheduler role constraints. These are local checks; no AWS validation API, deployed change set, stack update, or live account operation occurred.
- Live-test status: **not run**. Existing deployed Facebook/Instagram successes remain valid; these new behaviors are not deployed or proven live. No real post was submitted in this task, and no secret/account configuration was changed.
- Git: local changes prepared on `main` at `866cc3e`; **not committed or pushed**. GitHub publication requires Nicholas's explicit confirmation under `AGENTS.md` and the README.

#### Manual checkpoint before marking L5-GBP-00 DONE

1. Review and authorize GitHub publication. Deploy the application handler before enabling the recurring infrastructure trigger. Verify the hosting runtime supports the maintenance route's 180-second budget; a build alone does not prove that hosting limit.
2. Review an AWS change set before applying the scheduling template. Expect an existing worker code update, one new recurring schedule, and one worker-error alarm. Preserve existing one-time schedules, schedule group, role identities, and populated retained worker secret. The existing authenticated dispatch URL/token remain in use; never paste values into docs or logs.
3. Smoke-test Connections across two clients and a server refresh: identity, request/health state, and OAuth navigation remain correct. Smoke-test Facebook previews with URL A -> URL B, blank/invalid URLs, and aborted/failed responses; stale A data must not appear under B.
4. Check current official carousel-video rules and reconcile the retained supported boundary. Test an appropriate supported mixed carousel only with an explicitly approved live test. Record actual result identity and exactly one post.
5. Verify refresh with a genuinely eligible unexpired credential and exact account identity, and confirm encrypted persistence plus extended expiry. Verify an expired/revoked test connection reports reconnect without renewal. If no token is currently eligible for the due window, record that limitation and Nicholas's explicit decision about deferred live evidence rather than falsifying production expiry metadata.
6. With an approved scheduled Instagram test, verify browser-closed maintenance resumes its saved processing attempt after the normal worker stops, records one exact result, and re-entry creates no second attempt/post. Verify the interrupted/uncertain case remains locked for review. Record schedule/attempt/revision/provider IDs and timestamps without credentials.
7. Invoke/observe maintenance and verify safe counters, the worker-error alarm, and handling of errors. Alarm existence is not notification delivery. Record non-secret deployed evidence here; keep broader alert/monitoring follow-ups visible.
8. After required evidence and review are accepted, mark L5-GBP-00 **DONE** and L5-GBP-01 the sole **READY** task. Until then, no Google adapter or Level 6 work begins.


### October 2, 2026: Maintenance publication authorized

- Nicholas explicitly instructed: “push these changes.” This authorizes committing and publishing the reviewed L5-GBP-00 maintenance changes to `main`.
- This publication includes the recorded 165 passing tests, clean lint, successful production build, and passing infrastructure schema/security checks. No application behavior changed after that verification; this entry only records publication authorization.
- L5-GBP-00 remains **MANUAL**. AWS infrastructure deployment, hosting timeout verification, live renewal/recovery and UI smoke checks, and current carousel-specification verification remain outstanding. L5-GBP-01 remains **WAITING**; no Google implementation or Level 6 work is opened.
- Git commit/push verification is reported in the implementation handoff. This authorization does not record a completed AWS deployment or live integration test.


### October 2, 2026: L5-GBP-00 accepted after deployed maintenance checkpoint

- Task: **L5-GBP-00 — Baseline Maintenance Checkpoint**
- Outcome: **DONE**. Nicholas explicitly accepted the remaining unavailable live edge-case proofs as deferred and instructed `L5-GBP-00 DONE`. `L5-GBP-01` is now the sole `READY` task.
- Application deployment: Amplify production job **138** successfully deployed commit `eaaa6d10a47360dda30c37a8d034656224afd1b8` (`Repair Instagram maintenance and add safe renewal and processing recovery`) on October 2.
- AWS deployment: CloudFormation stack `content-social-hub-level4-scheduling` reached **UPDATE_COMPLETE**. The reviewed change set added only `InstagramMaintenanceSchedule`, added `ScheduledReleaseWorkerErrorAlarm`, and modified `ScheduledReleaseWorker` with **Replacement: False**.
- Deployed infrastructure verification: `csh-instagram-maintenance` exists, is **ENABLED**, runs at `rate(15 minutes)`, targets the existing scheduled-release worker with `{"action":"instagram_maintenance"}`, and has zero Scheduler retries. The worker remains Node 24, 512 MB, 900-second timeout. The CloudWatch worker error alarm exists and was **OK** with no notification actions configured.
- Maintenance live evidence: the recurring worker invoked the deployed application handler automatically at approximately **18:31 UTC** and **18:46 UTC**. Both runs returned `action: instagram_maintenance`, `errors: 0`, `connectionsChecked: 0`, `renewed: 0`, `recovered: 0`, `processing: 0`, and `reviewRequired: 0`. This proves the production Scheduler -> Lambda -> authenticated application-maintenance path for the current no-op state; it does not fabricate a renewal or interrupted-processing case that did not naturally exist.
- Connections smoke evidence: under `Nicholas_Egner`, `@nicholasegner` and `GIGnovate` remained **Healthy** after deployment. Switching to `Andrew_Davis` showed only `Davis Criminal Defense`, and switching back restored the Nicholas destinations, confirming client-scoped display did not regress.
- Facebook preview smoke evidence: with primary media temporarily unselected and no save/publish, `https://nicholasegner.com` loaded its own metadata; replacing it with `https://www.davisdefenselawyers.com/` replaced image/title/description without stale Nicholas data; clearing the URL removed the card; entering `not-a-real-url` did not resurrect stale Davis metadata.
- Automated/local evidence retained from implementation: Node **24.19.0**; `npm test` **165 passed, 0 failed**; `npm run lint` **0 errors, 0 warnings**; `npm run build` passed; `cfn-lint infrastructure/level4-scheduling.yaml` passed; CloudFormation Guard **3.2.1** passed; AWS `ValidateTemplate` also accepted the deployed template before the stack update.
- No real social post was submitted during this maintenance closure. No credential value, OAuth secret, dispatch token, encryption key, or other secret was written to project documentation.
- Explicitly deferred live evidence: (1) an actual Instagram token renewal when a genuinely eligible unexpired credential naturally enters the renewal window, (2) an actual interrupted Instagram provider-processing recovery case, and (3) broader carousel-video ratio acceptance beyond the retained supported product boundary until current official Meta evidence is retrievable. Nicholas accepted these as deferred rather than manipulating production expiry data or deliberately interrupting a live publication.
- Monitoring limitation retained: the CloudWatch alarm has no delivery action; notification delivery and broader cross-provider recovery/monitoring remain later bounded work before Level 6 operational-readiness review.
- Files changed for this closure: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`, `README.md`, and `AGENTS.md` only.
- Remaining work: begin **L5-GBP-01 — Google Business Profile Access Readiness**. Confirm the exact eligible test client/location and non-secret Google project/API access state before OAuth implementation. No Google OAuth/account modification or publication is authorized by closing this task.


### October 12, 2026: UX-01 approved composer implemented locally

- Task/outcome: **UX-01 — Post Composer Experience**, **MANUAL**. Nicholas approved the interactive Compose/Published mockup and requested implementation before further integrations. Local changes and verification are complete; commit/push, deployment, and live UI review remain pending. L5-GBP-01 is temporarily WAITING. This does not open or complete Level 6.
- Changed behavior: icon/account cards with exact destination names and derived statuses; keyboard-accessible Shared content and per-account tabs that keep editors mounted; thumbnail media choices and a Main label; video-only format control; explicit Facebook website-preview choice; visual Instagram media selection and saved carousel order; sticky desktop previews and mobile reflow; one account-specific Publish now/Schedule area; compact schedule state with Change schedule and Cancel actions; technical details/activity behind disclosures; successful saved versions are read-only with recorded timestamp, exact View Post, and a new source-only draft action.
- Decisions: use each destination's existing independent schedule/publish endpoints and confirmation. The mockup's aggregate review concept is expressed as explicit account-level review controls in this bounded task, rather than adding a batch dispatcher or implying atomic multi-account publishing. Other destinations retain their own content and times. Existing exact-revision, Account Health, private-media, stale/cancel, processing, ambiguous-result, retry, and duplicate barriers remain in the shared server/publisher paths.
- Fresh-copy behavior: `/content/new?from=<master id>` loads source material inside the existing owner-protected app. It saves through the existing create-content endpoint. A whitelist preserves text/link/media/cover and client context, omitting old content/version identities, approvals, timestamps, release settings, remote results, and publishing state. Selected account versions are not copied; choose destinations on the fresh draft.
- Files changed:
  - `AGENTS.md`
  - `README.md`
  - `app/(app)/content/[id]/page.js`
  - `app/(app)/content/new/page.js`
  - `components/content-composer.js`
  - `components/destination-publishing-panel.js`
  - `components/facebook-platform-editor.js`
  - `components/facebook-publish-controls.js`
  - `components/facebook-schedule-controls.js`
  - `components/instagram-platform-editor.js`
  - `components/instagram-publish-controls.js`
  - `components/master-content-form.js`
  - `components/media-choice.js`
  - `components/platform-destination-selector.js`
  - `components/platform-icon.js`
  - `components/published-post-summary.js`
  - `components/ui.module.css`
  - `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`
  - `lib/content-composer-logic.js`
  - `tests/content-composer-logic.test.js`

- Automated evidence: Node **24.19.0**. Final `npm test`: **168 passed, 0 failed** (165 existing tests plus 3 meaningful composer-status/source-copy tests). Final `npm run lint`: **0 errors, 0 warnings**. Final `npm run build`: **passed**, including compilation, page data/static generation, and route output. `git diff --check`: passed. Existing Node `MODULE_TYPELESS_PACKAGE_JSON` and npm environment `http-proxy` warnings remain; no module-system/package migration or warning suppression was added.
- Browser evidence: Chromium **153.0.8010.0**, actual application React components and stylesheet bundled in a temporary fixture with all API mutations intercepted locally. Passed at **1440, 1024, 768, 390, and 320 px** without page overflow. Verified unsaved text survives tab switches, per-account edits/save targets remain isolated, image-versus-link-preview choices update, exact account/time scheduling payloads are used, a passed schedule can open Change schedule and PATCH a future time, carousel order is saved, published controls collapse with the exact provider URL, and fresh-source creation POSTs contain no prior publication identity. Draft/mobile/published screenshots visually inspected. These fixture checks are not real Facebook/Instagram or AWS publication evidence.
- Documentation: acceptance criteria and ordered interlude recorded here; README current-task/handoff pointers and AGENTS current-task map aligned. Historical closed-provider evidence is retained.
- Live-test status: **not deployed or verified live** in this task. No real post was published or scheduled, and no provider credentials or infrastructure were changed.
- Manual actions: (1) obtain explicit commit/push confirmation; (2) deploy the application; (3) reopen the existing GIGnovate published post, confirm account/time/read-only state and exact View Post; (4) verify a fresh draft retains source media while release/history are clear; (5) smoke-check Facebook/Instagram tab edits, media/cover/carousel preview, and schedule controls under the actual client timezone. Any new real publishing/scheduling test requires an explicitly approved live checkpoint; provider/backend behavior is already documented in the closed phase records.
- Remaining work/next task: after deployed UI smoke review is accepted, mark UX-01 DONE and restore **L5-GBP-01** as the sole READY task. No other provider or full Calendar/Dashboard task starts here.
- Git: isolated local branch **ux-post-composer**, based on `origin/main` at **93871d908e13bc89b51ef75f34c3814acaada8b4**. **20 changed/new files**, uncommitted. Nothing committed, pushed, or written to GitHub by this task.


### October 12, 2026: UX-01 publication authorized

- Nicholas answered “yes, make the changes” to the explicit request to commit and push the reviewed UX-01 implementation. This authorizes publication of the verified 20-file change set to `main`.
- Verification is unchanged: 168 passing tests, clean lint, successful production build, passing browser fixture checks, and matching documentation/task pointers. Only this authorization record and current handoff wording were updated afterward.
- UX-01 remains **MANUAL** pending Amplify deployment and the recorded live UI smoke review. L5-GBP-01 remains **WAITING** until the editor checkpoint is accepted. No real social publishing/scheduling test is authorized by this GitHub publication.
- The verified remote commit and push result are reported in the implementation handoff.


### October 12, 2026: UX-01 Master Content hierarchy refinement

- Nicholas reviewed the deployed interface and requested a top-down hierarchy: Master Content above Posting to, followed by social-account tabs only. He explicitly approved implementing that layout adjustment.
- Outcome: locally complete; UX-01 remains **MANUAL** pending publication and deployed UI review. Master Content is expanded initially and has a native collapse/expand control. Collapsing keeps its form mounted and preserves edits. Platform tabs retain account identity, keyboard navigation, independent forms, previews, and existing publishing/scheduling controls. A package with no saved destinations retains the Master and account picker with a clear next-action message.
- Files changed: `components/content-composer.js`, `components/master-content-form.js`, `components/ui.module.css`, this phase document. Acceptance criterion 2 was updated to match the approved hierarchy.
- Checks: `npm run lint` passed with zero errors/warnings; `npm run build` passed; `git diff --check` passed. Actual-component browser fixture checks passed at 1440/1024/768/390/320 px, verifying Master precedes Posting to, only account tabs remain, collapse/reopen retains Master edits, account-specific drafts remain independent, and existing media, carousel-order, scheduling/rescheduling, published-link, and source-copy checks still pass. All API mutations were intercepted locally. The existing 168-test baseline from the prior composer change is retained; the full suite was not repeated for this layout-only refinement.
- Live status: the earlier composer is visible in Nicholas's deployed screenshot. This refined hierarchy has not been committed/pushed or deployed. No real social post or schedule was submitted.
- Remaining manual actions: authorize commit/push of this refinement, deploy, and confirm the new visual hierarchy. After the UX-01 smoke checkpoint is accepted, L5-GBP-01 becomes the sole READY task. Git base: `597b211ec4ed44a9426ac2601d3c8b699cc2f5d1`; branch `ux-post-composer`; four uncommitted files.


### October 12, 2026: Master hierarchy publication authorized

- Nicholas explicitly instructed “push please,” authorizing commit/publication of the reviewed four-file Master Content hierarchy refinement to `main`.
- Verification remains the clean lint/build, diff check, and actual-component browser fixture results recorded above. Only this authorization entry was appended afterward.
- UX-01 remains MANUAL until the refined layout is deployed and reviewed. L5-GBP-01 remains WAITING. The verified remote commit is reported in the handoff.


### October 12, 2026: UX-01 single-media thumbnail correction

- Nicholas's deployed screenshot demonstrated a Main image or video thumbnail stretched across the Master form with most of the image cropped. The actual-component fixture reproduced it: one card was 1030 px wide, with a 1010 × 82 px preview using cover fitting.
- Outcome: fixed locally. The media grid now keeps vacant columns instead of expanding the lone choice across the form. Thumbnails use a 16:9 frame and contain fitting to show the whole asset, including portrait images. These shared styles apply to Master and Facebook/Instagram media choices. Files changed: `components/ui.module.css` and this phase document. No media source or stored publishing payload changed.
- Checks: targeted browser reproduction failed before the correction and passed afterward at 1440/1024/768/390/320 px. Cards remained 139–246 px wide, frames retained their ratio, images used contain fitting, selection worked, and the page had no horizontal overflow. Landscape and portrait screenshots inspected. Existing actual-component browser checks also passed for Master hierarchy/collapse, independent account editing, media choices, carousel order, scheduling/rescheduling, published exact links, and source-only draft creation. All API mutations were intercepted locally. `npm run lint` passed with zero errors/warnings; `npm run build` passed; `git diff --check` passed. Existing npm environment warning remains. The full 168-test baseline was not repeated for this three-line CSS correction.
- Live status: the bug is confirmed in Nicholas's deployed screenshot; the correction is not deployed or verified live. UX-01 remains **MANUAL**. No real post or schedule was submitted.
- Git: `ux-post-composer` at `e21c57395260a12b8efad74c9a660ea25c8820ae`, two uncommitted files, no commit/push. GitHub publication awaits explicit confirmation per AGENTS.md. Next: publish after approval and review the deployed media choices; after UX-01 acceptance, restore L5-GBP-01 as the sole READY task.


### October 12, 2026: Thumbnail correction publication authorized

- Nicholas explicitly instructed “push,” authorizing commit/publication of the reviewed two-file thumbnail correction to main.
- Verification remains the recorded clean lint, successful production build, diff check, and passing responsive/portrait and existing editor browser checks. Only this authorization record was added afterward.
- UX-01 remains MANUAL pending deployment and live review; L5-GBP-01 stays WAITING. The verified remote commit is reported in the handoff.


### October 12, 2026: UX-01 unified Master media tray

- Nicholas approved replacing the duplicate upload list and Main media choices with one media tray. Outcome: locally complete; UX-01 remains **MANUAL** pending authorized publication/deployment and live review. The Level 5 Google phase stays active; L5-GBP-01 remains WAITING and full Level 6 remains unopened.
- Changed behavior: each image/video appears once in a larger full-frame card. Clicking its thumbnail selects the Default; an Add media tile opens the existing file picker. Remove detaches only from the content. Multiple files show earlier/later controls and position; a single file shows no ordering controls. Metadata is behind Details. Pending and failed uploads remain visible with progress/error handling. Existing private upload/complete and video cover paths are retained.
- Default behavior: the first completed eligible asset is the automatic default. Saving persists that actual default ID. Reordering preserves the current default instead of changing an implicit selection; removing the default selects the next eligible remaining asset, or clears it when the tray becomes empty. Failed/incomplete uploads cannot be selected as the default. Platform versions retain their independent media controls.
- Files changed: `components/master-content-form.js`, `components/ui.module.css`, this phase document. UX-01 acceptance criterion 3 now reflects the approved tray. No server routes, storage/public-access settings, provider payloads, publishing gates or scheduling infrastructure were modified.
- Verification: `npm test` **168 passed, 0 failed**; `npm run lint` passed with zero errors/warnings; production build passed; `git diff --check` passed. Existing npm environment and Node syntax-detection warnings remain. Actual React-component browser checks passed at **1440/1024/768/390/320 px** with no horizontal overflow: each asset appears once; single/empty/video states; keyboard default selection; saved order/default payloads; implicit-default preservation while reordering; remove fallback/clear; metadata disclosure; Add media file chooser; real component upload/progress/complete and failed-upload removal using fake storage. The existing editor suite also passed hierarchy/collapse, independent platform text/media, carousel ordering, exact schedule/reschedule payloads, published links/read-only state, and source-only draft creation. Single/multiple/empty/mobile tray screenshots inspected. All API/storage operations were intercepted locally.
- Live status: not deployed or verified live; no real upload, social post or schedule was submitted. Next manual step is publication after explicit approval, then deployed review of the tray. Once UX-01 is accepted, L5-GBP-01 becomes the sole READY task.
- Git: `ux-post-composer`, based on `0a76c141122d426cd7540f8ffa2b59ac5b4aa57a`; three uncommitted files. Nothing committed or pushed in this refinement.


### October 12, 2026: Media tray local commit authorized

- Nicholas explicitly instructed “commit,” authorizing a local commit of the verified three-file media tray refinement. No push is performed under this instruction.
- Checks remain the recorded 168 passing tests, clean lint, successful production build, responsive/upload/editor browser fixture checks, and passing diff check. Only this authorization record was added afterward.
- UX-01 remains MANUAL pending separately authorized publication/deployment and live review. L5-GBP-01 stays WAITING. The local commit is reported in the handoff.


### October 12, 2026: Media tray publication authorized

- Nicholas explicitly instructed “push,” authorizing publication of the verified media tray commit to main. This authorization record is included with the three-file refinement.
- Verification remains the recorded 168 passing tests, clean lint, successful production build, responsive/upload/editor browser checks, and passing diff check. No application changes followed verification.
- UX-01 remains MANUAL pending deployment/live review; L5-GBP-01 stays WAITING. The verified remote commit is reported in the handoff.


### October 12, 2026: UX-01 compact published layout and history buttons

- Nicholas's deployed screenshots demonstrated a large blank left column beside the preview when published text/media was collapsed. He suggested putting the preview below Publishing activity and View published text and media, and requested a button treatment for View Post.
- Outcome: locally complete. Facebook and Instagram published editors now use a centered column capped at 680 px. The published result/actions appear first, followed by Publishing activity, the read-only saved-content disclosure, and the preview. Published previews have aligned widths and no sticky positioning, including when the content disclosure expands. Drafts retain their desktop editing/preview columns. Publishing-history exact-post links now use outlined buttons with an external-link indicator; primary result actions stack with comfortable padding on narrow screens.
- Files changed: `components/ui.module.css`, `components/facebook-publish-controls.js`, `components/instagram-publish-controls.js`, this phase document. UX-01 acceptance criterion 6 reflects the refinement. Result URLs, revision locks, audit records, publishing/scheduling endpoints and private media behavior remain unchanged.
- Checks: lint passed with zero errors/warnings; production build passed; `git diff --check` passed. Actual-component browser fixtures passed for both published platforms at 1440/1024/768/390/320 px: preview follows the disclosures in collapsed/expanded states, widths align, editors remain read-only, exact history URLs are retained, links have button styling and a minimum 40 px click area, and no horizontal overflow occurs. The existing editor checks also passed for Master hierarchy/collapse, platform draft isolation, media modes/carousel ordering, exact schedule/reschedule payloads, published result links, and fresh-source creation. Desktop/mobile and both history-button screenshots were visually inspected. All API operations were intercepted locally; no live post or schedule was submitted. The 168-test baseline from the media tray refinement is retained; the full suite was not repeated for this presentation-only change. Existing npm environment warning remains.
- Status: UX-01 **MANUAL**, pending authorized commit/publication and deployed UI review. This correction is not deployed or proven live. L5-GBP-01 remains WAITING and becomes the sole READY task after UX-01 acceptance. Full Level 6 remains unopened.
- Git: `ux-post-composer` based on `bc54a879ee75c6bc09baa16d70faf3e721603213`, four uncommitted files. No commit or push performed in this refinement. Next: authorize publication, deploy, and review the published layout.


### October 12, 2026: Published layout publication authorized

- Nicholas explicitly instructed “commit and push,” authorizing publication of the reviewed four-file published-layout and history-button refinement to main.
- Verification remains the clean lint, successful production build, responsive Facebook/Instagram published-view and existing editor browser checks, and passing diff check. Only this authorization record was added afterward.
- UX-01 remains MANUAL pending deployment/live UI review; L5-GBP-01 stays WAITING. The verified remote commit is reported in the handoff.


### October 12, 2026: UX-01 finished-post hierarchy and shaded records footer

- Nicholas reviewed the deployed view and identified oversized white gutters, redundant published information, and disclosures interrupting the preview. He approved the proposed result-header -> post-preview -> shaded-records-footer hierarchy.
- Outcome: locally complete. The outer account card now caps its width at 680 px when the active account is published, instead of centering a narrow editor inside a wide white panel. Draft tabs retain the full editing layout, and switching between states does not unmount other account editors. Published views omit the repeated platform heading, Published version subtitle, live-status sentence, and preview heading. One recorded result header leads directly to the saved preview with a 16 px gap. Post details and Publishing history live together in a slightly darker footer below the preview and start collapsed. Exact View Post buttons, new-draft action, link-refresh handling, saved fields, and audit records are preserved.
- Implementation: the existing text/media JSX and preview are passed as client render slots to the existing publishing controls for published records, preserving their values, fieldset read-only gate, and handlers. Draft layout uses the same slots. The active-tab card width follows the visible published editor through scoped CSS; no publishing callback or backend contract was changed.
- Files changed: `components/facebook-platform-editor.js`, `components/instagram-platform-editor.js`, `components/facebook-publish-controls.js`, `components/instagram-publish-controls.js`, `components/ui.module.css`, this phase document. UX-01 acceptance criterion 6 reflects the approved final hierarchy. No provider/server routes, data models, credentials, private storage settings, or schedule infrastructure changed.
- Checks: `npm test` **168 passed, 0 failed**; lint passed with zero errors/warnings; production build passed; `git diff --check` passed. Actual-component browser fixtures passed for both published platforms at **1440/1024/768/390/320 px**: outer card width, result/preview/footer order, 16 px header gap, shaded background, disclosures closed initially and expandable, saved fields remain disabled, exact history URLs/button click areas, no duplicate status or page overflow. Mixed published/draft tabs resize correctly and retain independent unsaved draft text. The existing editor and media tray checks also passed, including upload/complete/error handling using fake storage, selection/default/order/removal, scheduling/rescheduling, exact published links, and fresh-source creation. Desktop/mobile published screenshots inspected. All API/storage operations were intercepted locally. Existing npm environment and Node syntax-detection warnings remain.
- Live status: no real upload, publication, or schedule submitted; this refinement is not deployed or verified live. UX-01 remains **MANUAL** pending authorized commit/publication and deployed review. L5-GBP-01 stays WAITING until UX-01 acceptance; full Level 6 stays unopened.
- Git: `ux-post-composer`, based on `a3efc949002463a95c07498c23cce6f07b5f10df`; six uncommitted files. No commit or push performed in this refinement. Next: authorized publication, deployment, then review the finished-post layout; after acceptance, restore L5-GBP-01 as the sole READY task.


### October 12, 2026: Finished-post hierarchy publication authorized

- Nicholas explicitly instructed “commit and push,” authorizing publication of the reviewed six-file finished-post hierarchy and shaded-footer refinement to main.
- Verification remains the recorded 168 passing tests, clean lint, successful production build, responsive published/editor/media browser checks, and passing diff check. Only this authorization record was added afterward.
- UX-01 remains MANUAL pending deployment/live UI review; L5-GBP-01 stays WAITING. The verified remote commit is reported in the handoff.


### October 12, 2026: Google API application submitted; provider paused for LinkedIn

- Task: **L5-GBP-01**, status **MANUAL**, awaiting Google approval. Nicholas approved proceeding past UX-01 and prioritizing LinkedIn over YouTube.
- Project: **Content Social Hub**, Google Cloud ID `content-social-hub`, number `503771980348`, No organization.
- Applied for Basic Google Business Profile API access on October 12. Support case **`1-5407000042073`** opened. Google's screen estimated **7–10 business days** and cautioned against duplicate applications.
- The application presented four verified Business Profiles, including Nicholas Egner - Web Development. The exact integration test client/location is still unconfirmed; do not infer a publishing destination from the application.
- No API approval, enabled quota, OAuth configuration, location-scoped connection, or Google publication is yet verified. Check the approval email and project quotas; do not submit a duplicate request. Resume L5-GBP-01 when Google replies.
- Active handoff moves to `docs/LEVEL_5_LINKEDIN.md`, with `L5-LI-01` READY. Google OAuth and later Google tasks stay WAITING. Level 6 remains unopened.
- Evidence: user's screenshots of new project, application, and support-case confirmation. Documentation-only GitHub update; no application code, automated tests, or live publishing. Modified `README.md`, `AGENTS.md`, and this file, plus new LinkedIn phase document. Publication explicitly authorized; verify commit results separately.

### October 13, 2026: Active handoff advanced to YouTube

- Google `L5-GBP-01` remains `MANUAL` while Google evaluates case `1-5407000042073`. No new approval, quota, OAuth, exact location selection or Business Profile publishing has been verified, and no additional Google application was submitted.
- Nicholas approved moving beyond the implemented LinkedIn personal-profile functionality **without artificial live-profile tests**. Deferred LinkedIn `L5-LI-06/07` real-post validation remains recorded in `docs/LEVEL_5_LINKEDIN.md`; the LinkedIn final transition review is owner-accepted with exceptions, not a claim of full provider verification.
- The next active phase is `docs/LEVEL_5_YOUTUBE.md` with sole `L5-YT-01 READY` for API and target-channel access readiness. YouTube credentials/approval must be validated independently of this Google Business Profile access request. Google Business Profile OAuth and later implementation tasks remain WAITING.
- This entry is a **documentation-only handoff**. No new Google API calls, tests, builds, or live posts were performed. Keep the current Google access case and any legitimate future approval evidence here.


### October 15, 2026: L5-GBP-02 direct connection prepared locally before API approval

- **Owner direction and scope:** On October 14 Nicholas asked to build the actual application callback rather than use OAuth Playground. This explicitly authorizes local L5-GBP-02 preparation ahead of the normal L5-GBP-01 approval gate. L5-GBP-01 and L5-GBP-02 remain MANUAL; no later Google task is READY, and no provider or Level 5 closure is claimed. The broader active phase remains YouTube; its progress log points here.
- **Observed external state:** October 14 owner screenshots show the intended `content-social-hub` project, Account Management API enabled, and its Requests per minute **Value 0**. This documents unapproved access at that time, not a fresh October 15 console check. The existing application was submitted October 12, case `1-5407000042073`, project number `503771980348`. No second application or quota-increase request was submitted. Approval email, Business Information API enablement and target test location remain unverified.
- **Implementation:** Added owner-only Google Business Connect, `/api/connections/google-business/callback`, a multi-account/multi-location picker, explicit location confirmation, same-location/account reconnect, encrypted access/refresh credentials and client-scoped social connection persistence. OAuth state and location-selection tokens are random, hashed in MongoDB and expire after 10 and 20 minutes. Secure production HTTP-only SameSite=Lax cookies bind each flow to its initiating browser; callback, selection page and confirmation require the owner session. Confirmations are atomically consumed, recheck current provider access through the selected account and reject deleted clients, unoffered locations, wrong-location reconnects and changed credentials. Missing refresh tokens are retained only for the same saved location and OAuth client. Credentials never appear in public flow/connection responses.
- **Provider reads and renewal:** Uses dedicated `GOOGLE_BUSINESS_CLIENT_ID` / `GOOGLE_BUSINESS_CLIENT_SECRET` and offline `business.manage` consent. Account Management `accounts.list` and Business Information `accounts.locations.list` supply exact account/location resource identities, business name and address with pagination. Discovery is bounded to 25 seconds / 30 requests / 1,000 location-account choices; incomplete or cyclic scans fail explicitly rather than returning a silently partial picker. Each provider request has at most a ten-second timeout and refuses redirects. Account Health verifies the exact account/location and renews access tokens within five minutes of expiration, retaining omitted refresh/scope values and using credential compare-and-set protection against concurrent reconnect. Expired/revoked authorization, disabled APIs, denied access and quota errors have separate sanitized explanations. Healthy means location access was verified, not post eligibility: `canPublish` remains false and Google is not added to content destination editors, publishing or scheduling.
- **UI:** Added Google Business to Social Accounts using the shared cards, storefront icon, account chips/counts, photos/initials fallback, configuration-disabled Connect, explicit location identity and same-location Reconnect. The picker requires an explicit choice, shows address/account/resource identity to distinguish businesses, disables submission while saving, focuses errors, and returns to the originating client after confirmation. Informational location/expiry copy uses neutral styling. No email Request Connection or Google posting UI is enabled in this task.
- **Files:** `.env.example`; `lib/google-business.js`, `lib/google-business-connection-logic.js`, `lib/google-business-oauth-browser.js`, `lib/connections.js`; three `app/api/connections/google-business/{start,callback,confirm}/route.js` handlers; two `app/connect/google-business/{select,error}/page.js` pages; `components/google-business-location-select.js`, `components/connections-manager.js`, `components/platform-icon.js`, `components/ui.module.css`; `app/(app)/connections/page.js`; `tests/google-business-connection.test.js`, the existing Instagram maintenance integration harness's new imported-provider stub; this phase record, YouTube progress log and README exception note.
- **Verification:** Targeted Google tests cover OAuth callback/scope, paginated read-only discovery, bounded/cyclic/malformed responses, safe provider errors, revoked/omitted token fields, client isolation, location selection/revalidation, replay/expiry, refresh-token retention, concurrent reconnect, browser-bound state and unauthenticated start/confirmation. Full test/lint/build and the final responsive browser results are recorded below after the last verification pass. Browser HTTP actions use mocks; no live Google API calls, credentials, database/account writes, business edits, email, publication, schedule or AWS changes were made. Temporary preview code is removed before the final production build and is not delivered.
- **Git and next:** Local `main` based on delivered `33dbd58`; uncommitted and unpushed, with no GitHub write authorized or performed for this task. Next is separately authorized delivery, then the credential and live-connection checkpoint below. L5-GBP-03 remains WAITING for direct connection acceptance; YouTube/LinkedIn live evidence and Level 6 gates are unchanged.

#### Google Cloud and Amplify setup for this implementation

1. Use Google Cloud project **Content Social Hub** / `content-social-hub` / `503771980348`, the project used for the existing GBP application.
2. Create a **Web application** OAuth client named `Social Hub - Google Business` (or repurpose the unintegrated access-check client). Register this exact authorized redirect URI:

   ```text
   https://main.d1yfjibipwjpld.amplifyapp.com/api/connections/google-business/callback
   ```

   It is an application route, not a local filesystem path. JavaScript origins are not needed for this server-side authorization flow. The Playground redirect is not used by this application. This is a standard user-operated client; do not classify it as an AI-agent client for Workspace MCP.
3. Configure `https://www.googleapis.com/auth/business.manage` in Google Auth Platform data access. Resolve any consent/verification restrictions Google actually presents; existing YouTube branding deferrals are not GBP approval. The app requests only this Business scope through its dedicated client.
4. Store the client ID and secret in Amplify as **`GOOGLE_BUSINESS_CLIENT_ID`** and **`GOOGLE_BUSINESS_CLIENT_SECRET`**. Reuse the existing `APP_BASE_URL` and `OAUTH_TOKEN_ENCRYPTION_KEY`; preserve YouTube's variables and client. Keep secrets out of screenshots, chat and Git.
5. Deploy the reviewed code after explicit GitHub authorization. Confirm **My Business Account Management API** and **My Business Business Information API** are enabled in this same project when Google grants access. Account Management quota 0 still prevents discovery; creating OAuth credentials does not grant API approval. Google My Business/local-post API enablement is a later publishing checkpoint.
6. In Social Accounts choose the intended client, click Google Business **Connect**, authorize an owner/manager Google identity, explicitly select the intended location/account, and confirm. Verify Account Health, saved identity after reload and client switching; repeat same-location Reconnect. No business post or profile edit is needed. Do not declare live success based on the consent screen alone.

Official references rechecked October 14: [basic setup](https://developers.google.com/my-business/content/basic-setup), [OAuth](https://developers.google.com/my-business/content/oauth-setup), [accounts.list](https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list), [locations.list](https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations/list), [access approval/quota](https://developers.google.com/my-business/content/prereqs).


#### October 15 final local verification and handoff

- **Node 24.19.0:** `npm test` passes **282/282**, including **20 new Google Business tests**. `npm run lint` passes with zero errors and the same two existing LinkedIn image warnings. `npm run build` passes and includes all three Google Business API routes and both connection pages. `git diff --check` passes.
- **Browser:** Five mocked Chromium check groups pass using the actual components: disabled configuration/two-location account summaries; configured Connect and exact-client/location reconnect links; 320px responsive account layout; explicit location selection and exact parent submission with focused failure; disabled in-flight controls and successful return to the originating client, with no repeat submit control. No runtime errors. Both confirmation requests were intercepted; no provider or real database calls were made. Desktop/mobile screenshots were inspected; informational connection metadata was changed to neutral styling and the checks rerun. Temporary `app/ux-preview` fixture is absent from the final build.
- **Final status:** `L5-GBP-02 MANUAL`, local implementation complete, live connection not verified. `L5-GBP-01 MANUAL` pending approval evidence; `L5-GBP-03 WAITING`. No Google posting, emailed connection or scheduler feature was started. Deployment, OAuth credentials/consent and an approved real location remain manual checkpoints.
- **Git:** `main` based on `33dbd589974972ee344b348383aa19f1f1f34292`, local changes only. No commit, push, GitHub write, deployment, Google Cloud mutation or live authorization occurred. Deliver only after Nicholas explicitly authorizes GitHub publication.


### October 15, 2026: L5-GBP-02 delivery authorized

- Nicholas explicitly requested **commit and push**, authorizing publication of all 20 prepared Google Business direct-connection source, UI, configuration-template, test and documentation files to `main`.
- Verification remains the recorded 282 passing Node tests, successful production build, zero lint errors with two existing LinkedIn image warnings, five mocked browser check groups and clean diff check. Only documentation was changed after that verification.
- Remote `main` was checked against local base `33dbd589974972ee344b348383aa19f1f1f34292` before delivery. No temporary preview route is included. Git delivery does not change Google Cloud, OAuth credentials, account data or posts. Nicholas reports adding the Amplify variables and starting a redeployment; no secret values were supplied or inspected.
- Google API approval and a real direct connection remain unverified. L5-GBP-01/02 stay MANUAL and GBP-03 WAITING. Amplify must deploy the new delivered commit before the real callback is available. The handoff reports the verified commit and branch state.

### October 19, 2026: Current checkpoint reconciled after owner-confirmed Google Business connection

- **Task/outcome:** documentation-only reconciliation of L5-GBP-01/02 and the cross-provider handoff. Nicholas states Google Business is now connected and previously reported needing reconnect every few hours. Record the connection as owner-confirmed, with the recurring reconnect unresolved. L5-GBP-02 is reopened READY for that bounded investigation; no connection fix was implemented today. L5-GBP-01 stays MANUAL for missing exact destination/access documentation. L5-GBP-03+ remain WAITING.
- **Repository evidence:** main at `0c4c8fb5540a694c2fc8207741d7da1691710f63`, Add Google Business Profile OAuth and location connections, delivered October 15. The earlier local/unpushed descriptions are preparation history. Reviewed README, YouTube phase, Google phase, AGENTS, current connection/provider, request-platform, destination and scheduling seams, and recent relevant commits. LinkedIn media scheduling was delivered in `7dfb620`; UX-02 through UX-05 and YouTube scheduling are also already represented on main.
- **What is live:** the current owner's explicit connection report. No independent current health, natural-expiry refresh, exact saved client/location, quota or approval-email inspection was performed in this documentation session. No exact destination identity is inferred from the October 12 application. October 14 quota zero must not be stated as today's observed value.
- **What is implemented:** dedicated direct OAuth, account/location selection, encrypted access/refresh credentials, same-location reconnect and Account Health. Current code refreshes near expiry through Account Health and preserves omitted refresh credentials/scopes. Its presence is not proof the reported live problem is fixed. Google credentials remain server-only.
- **What is unfinished:** Google emailed Request Connection, destination editing/validation/preview, standard text/CTA publishing, private-S3 image publishing and shared background scheduling. Saved Google connections explicitly have canPublish false; a Healthy connection does not enable posting. No Google post or profile edit was performed.
- **Other providers:** Facebook/Instagram closed evidence preserved. YouTube L5-YT-02/05/07 remain MANUAL and L5-YT-08 WAITING, including standard thumbnail/playlist and AWS/browser-closed scheduling evidence. LinkedIn L5-LI-06/07 live proof stays deferred to genuine posts and Company Pages remain BLOCKED. TikTok is required and unopened; Level 6 is not opened by this update.
- **Files changed:** README.md, AGENTS.md, docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md, docs/LEVEL_5_YOUTUBE.md. Updated current summaries, roadmap rows, machine-readable handoff, queue and dated records together; historical entries retained and explicitly labeled superseded where appropriate.
- **Checks/results:** `git diff --check` passed. README YAML parsed with Python/PyYAML; project/implementation/next-action phase and task pointers agree. Google ordered queue contains exactly one READY task (L5-GBP-02); YouTube contains none. Google publishing remains false in the handoff; code fences balance in all four edited files. Diff review and `git status --short --branch` confirm four documentation changes only. No npm test/lint/build rerun for this documentation-only change. Historical October 15 evidence remains 282 tests passed, successful build, zero lint errors/two existing LinkedIn image warnings, five mocked Google browser groups. None is relabeled as today's test or live-provider evidence.
- **Decisions/blockers/remaining:** make this Google record active again for connection reliability; capture exact non-secret saved identity and current access evidence during the next task. Posting entitlement is a separate checkpoint. After L5-GBP-02 acceptance, L5-GBP-03 should become READY; do not skip directly to publishing or TikTok.
- **Git:** clean main at 0c4c8fb before this docs edit; four documentation files prepared locally, uncommitted and unpushed. No GitHub write, deployment, account action, email, live schedule, upload or publication in this session. Explicit GitHub delivery confirmation remains required.

### October 19, 2026: Documentation delivery authorized

- Nicholas explicitly instructed **Commit and push**, authorizing delivery of the four reviewed documentation updates to main: README.md, AGENTS.md, this Google phase record and docs/LEVEL_5_YOUTUBE.md.
- Documentation checks passed: README YAML parsing, aligned phase/task pointers, exactly one Google READY task and no YouTube READY task, balanced code fences and clean diff whitespace. No application code changed; application checks and live provider tests were not rerun.
- This authorization supersedes the pending-delivery state in the preparation entry above. Google L5-GBP-02 remains READY for connection reliability; later Google tasks stay WAITING. Level 5 remains OPEN. Git delivery does not perform a deployment, account operation or social publication. The delivery handoff reports the verified commit and push result.

### October 19, 2026: L5-GBP-02 Google Account Health UI delivery

- **Task/authorization:** Nicholas explicitly authorized committing and pushing the focused Google Business UI improvement to `main`. No OAuth credentials, token storage, connection persistence, provider API, publishing or scheduling logic changes. L5-GBP-02 remains awaiting deployed owner review; L5-GBP-03 remains WAITING until acceptance.
- **Live evidence:** October 19 screenshots show **Nicholas Egner - Web Development**, resource `accounts/117585782904582812392/locations/13178639929087207302`, staying Healthy as the displayed expiration advances from **11:56 AM to 1:00 PM** and checked time from **11:26 AM to 12:00 PM**. This supports token renewal with unchanged location but does not independently prove which button was pressed or that no Google consent was required.
- **UI:** Routine hourly Google access-token expiration copy and near-expiry health warning are hidden. Renewable Google `expiring_soon` reports as Healthy in chips and connection card; revoked/expired authorization, permission errors and provider API errors remain distinct warnings. **Check access** calls the existing saved-authorization health/renewal path; **Reconnect** opens Google sign-in. Other platforms remain unchanged. Google `canPublish` remains false.
- **Files:** `components/connections-manager.js`, new `lib/connection-health-display.js`, new `tests/connection-health-display.test.js`, and this phase log.
- **Checks and constraints:** Three focused helper tests passed using Node 22.16.0, and the prepared patch/reverse-patch checks passed. Full test/lint/build, integrated browser checks and deployed UI verification were not rerun because this session lacks a full clone/dependencies and the required Node 24.19.0. The October 15 282-test baseline is historical, not today's proof. The GitHub commit/push must be verified separately.
- **Manual next step:** Review the deployed Google card and reload it after renewal, verify client/location identity stays correct, accept L5-GBP-02 when satisfied, then promote only L5-GBP-03 to READY. Separate Local Posts publishing eligibility remains under L5-GBP-01.

### October 19, 2026: Owner-requested YouTube Account Health UI follow-up

- Nicholas confirmed the Google Business Account Health layout in production with an October 19 screenshot and requested that the same UI simplification apply to YouTube, then explicitly authorized the push. This maintenance follow-up does not reopen or replace the current Google `L5-GBP-02` implementation assignment or advance the task queue.
- YouTube's visible Account Health controls become **Check access** plus **Reconnect**, routine hourly token-expiration copy is hidden, and renewable near-expiry status displays as Healthy without obscuring genuine errors. The existing conditional token-renewal and dedicated diagnostic force-refresh endpoints remain unchanged. No OAuth, connection, publishing or scheduling server code was modified.
- Three focused display tests passed under Node 22.16.0. Full app test/lint/build and deployed browser/channel authorization verification remain pending. `Your Dad Sucks Gaming` had a historical October 14 health check as of the October 19 screenshot and still needs a fresh check.
- See `docs/LEVEL_5_YOUTUBE.md` October 19 follow-up entry for the YouTube-specific evidence. Google `L5-GBP-02` remains READY pending explicit closeout; `L5-GBP-03` stays WAITING. No Level 5 closure.

### October 19, 2026: Unified Connected accounts UI delivered by owner authorization

- **Task/authorization:** Nicholas explicitly approved the consistent five-platform Connected accounts UI and separately requested commit and push to `main`. This is a UI-only L5-GBP-02 follow-up, not Google publishing or a new OAuth implementation. L5-GBP-02 remains READY pending deployed owner acceptance and remaining reliability evidence; L5-GBP-03+ remain WAITING.
- **Changes:** A shared `SocialConnectionCard` presents identity, health status, last check, a unified **Check health** action and account-bound **Reconnect** only where the provider safely supports it (LinkedIn, YouTube, Google Business). Facebook and Instagram retain their existing generic Connect controls above. Older than 24-hour health checks are marked **Recheck recommended** without asserting the connection is broken. Google resource identity, address and LinkedIn expiry move to an accessible details disclosure. Routine token-expiry noise is hidden without concealing genuine health errors. Existing OAuth, provider renewal, publisher and scheduler code is unchanged.
- **Files:** `components/connections-manager.js`, `components/social-connection-card.js` (new), `components/ui.module.css`, `app/(app)/connections/page.js`, `lib/connection-health-display.js`, `tests/connection-health-display.test.js` and this Google phase record.
- **Checks:** Five focused helper tests passed using Node 22.16.0; the prepared JSX card parsed with the installed TypeScript parser; source-file SHA/anchor checks passed. Full Node 24.19.0 `npm test`, `npm run lint`, `npm run build` and browser integration were not available in this environment. Those checks and live deployed review remain outstanding, and historical test results are not substituted.
- **Live/manual:** After Amplify deploys, verify each card on desktop/mobile, check all five platforms with **Check health** (especially the YouTube channel last checked October 14), confirm client isolation and saved identities after reload, and accept the task before marking DONE. No real OAuth flow, account mutation or posting took place in this change. Google Local Posts entitlement remains a separate L5-GBP-01 MANUAL checkpoint.
- **Git:** Explicit commit/push authorization received for these seven files; verify final commit SHA and remote `main` before handoff. Do not declare deployment proven by a push.

### October 19, 2026: L5-GBP-02 Connected accounts health-spacing polish delivered

- **Task and outcome:** Nicholas approved a focused final spacing correction to the deployed unified Connected accounts UI after observing that the Healthy badge and last-checked timestamp ran together for stale Facebook/Instagram accounts. CSS-only presentation correction prepared for the Google Business active-phase queue; L5-GBP-02 remains READY pending deployed acceptance.
- **Implementation:** `components/ui.module.css` now stacks health badge, last-checked timestamp and optional `Recheck recommended` notice with flex-column and a consistent 4px gap. The timestamp is the second child rather than `:last-child`, which incorrectly matched the optional stale notice. Health content aligns right on desktop and left at the 820px responsive breakpoint. The existing stale warning color remains. No changes to components, account identity, OAuth, token renewal, publishing or scheduling.
- **Files changed:** `components/ui.module.css` and `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md` (this progress entry).
- **Checks/results:** Exact original GitHub blob hashes and branch head verified before editing. CSS parser and selector assertions passed. Representative Chromium desktop 1280px and mobile 390px checks passed for both fresh and stale health rows, including vertical separation, alignment, date text color and warning color. Full Node 24.19.0 app tests, lint, build and live deployed review were not run for this CSS-only change; they remain verification debt, and passing mock browser checks are not proof of the deployed application.
- **Live and blockers:** Amplify deployment, screenshot confirmation, client-switching behavior and owner acceptance are still required before marking L5-GBP-02 DONE. L5-GBP-01 retains its Google Local Posts API evidence checkpoint, and L5-GBP-03 remains WAITING.
- **Authorization/Git:** Nicholas explicitly requested commit and push for this two-file spacing fix on October 19. Commit and push confirmation will be supplied in the handoff; this progress entry does not claim deployment.

### October 19, 2026: L5-GBP-02 closed by owner acceptance; L5-GBP-03 READY

- **Outcome/status:** Nicholas explicitly requested closing `L5-GBP-02` after reviewing the live unified Connected accounts UI and final CSS improvement. `L5-GBP-02 DONE` by owner acceptance with recorded exceptions; only `L5-GBP-03 READY`. Broader Level 5 and Google provider expansion remain OPEN.
- **Live evidence:** Owner screenshots show `Nicholas Egner - Web Development` on `accounts/117585782904582812392/locations/13178639929087207302`, still Healthy after the displayed access-token expiry advanced from 11:56 AM to 1:00 PM with a later health check. A further screenshot showed Healthy at 2:41 PM. The same business resource remained visible; exact selected Content Social Hub client ID, whether a consent screen was involved, and a database-level mapping check were not independently captured. Nicholas accepted these limitations for direct-connection closure.
- **Implemented and delivered:** Direct OAuth, explicit location selection, encrypted refresh credentials and identity-safe health/reconnect were committed in `0c4c8fb`; follow-up UI/diagnostic clarity changes landed in `2fca147`, `35f1ed4`, `9e0d100`, and CSS alignment `7532d8c`. Google `canPublish` remains false. No publishing, emailed setup or scheduling was implemented in this closure.
- **Checks:** Historical October 15 Node 24.19.0 baseline: 282 tests passed, production build passed, zero lint errors/two pre-existing warnings, five mocked browser groups. October 19 targeted presentation tests (three and five cases) and Chromium desktop/mobile CSS smoke passed as logged earlier. Full Node 24.19.0 tests/lint/build were NOT rerun after the UI changes, and no artificial revoked-token or client-isolation live negative was performed.
- **Remaining manual evidence:** `L5-GBP-01 MANUAL` continues for live Google project approval/quota, independent Content Social Hub client/location record, and Local Posts entitlement. Extended natural renewal and OAuth consent details were not independently observed, but the owner accepted this checkpoint. Do not misrepresent this as Google posting approval.
- **Files:** Documentation-only closure in `README.md`, `AGENTS.md` and this phase log; no application-code changes or external account operations.
- **Next READY task:** `L5-GBP-03` secure Resend Request Connection and limited-purpose setup page; explicit selected-client/location binding, expiry, completion and replacement-link protection, no owner workspace access. `L5-GBP-04+ WAITING`. Level 6 unopened.


### October 19, 2026: L5-GBP-03 Google emailed Request Connection prepared without commit/push

- **Authorization and scope:** Nicholas approved proceeding with the L5-GBP-03 code, tests and log changes. GitHub source blobs and a proposed tree were prepared against unchanged `main` at `9dc5570f5` without creating a commit or moving a branch. Commit/push still require separate authorization. No external account or email operation was performed.
- **Implementation:** Added Google Business Profile to the shared 48-hour Resend request-platform list and setup page, and a Google Request Connection button/status label to Social Accounts. The direct Google OAuth route now supports a request mode with client/request IDs saved in one-time hashed OAuth state, browser-bound HttpOnly state and selection cookies, explicit account/location selection and independent request-platform completion. A request user does not need owner login and cannot navigate to owner Social Accounts from the setup/confirmation/error flow; owner direct Connect and reconnect continue to require owner session. The backend checks pending client-bound request scope before OAuth state creation, after Google authorization and just before saving an exact revalidated location. Expired, revoked, replaced, completed, cross-client, unoffered-location and replay attempts fail. Encrypted credentials and `canPublish: false` remain unchanged. Existing multi-platform requests can complete Google while other requested platforms stay pending.
- **Files prepared:** `lib/connection-request-logic.js`, `lib/connections.js`, `lib/email.js`, `components/connections-manager.js`, `components/google-business-location-select.js`, `app/connect/[token]/page.js`, Google Business `start/callback/confirm` API routes, Google Business `select/error` pages, `tests/connection-request-logic.test.js`, `tests/google-business-connection.test.js`, and this phase record.
- **Checks/results:** A source-evaluation harness against the actual proposed GitHub blobs passed nine focused assertions: Google platform eligibility, request-to-client OAuth binding, consumed OAuth state, redacted client-facing selection data, exact location persistence, `canPublish: false`, multi-provider status preservation, selection replay rejection and completed-platform reuse rejection. This is **not** a Node test-runner result. Full Node 24.19.0 `npm test`, `npm run lint`, `npm run build`, integrated browser checks and `git diff --check` on a complete checkout are still required; no new full-suite pass is claimed. Existing October 15 282-test baseline is historical.
- **Live/manual:** After separately authorized commit/push and deployment, send a test Google request through Resend, use a separate private browser to select the exact location, verify the saved client/location and Account Health after reload/client switching, confirm completion/replacement/replay handling and no owner dashboard access. Do not connect unintended client locations or publish Google posts. L5-GBP-01 remains MANUAL for quota/Local Posts entitlement; direct L5-GBP-02 remains DONE by acceptance.
- **Status and next:** L5-GBP-03 remains READY pending full automated and live evidence; L5-GBP-04 remains WAITING. Broader Level 5 OPEN and Level 6 unopened. Remote main unchanged; local working-tree status unavailable (connector-only preparation). The uncommitted Git tree can be reviewed and committed only on a separate explicit request.


### October 19, 2026: L5-GBP-03 request notification UI follow-up prepared

- **Issue:** Nicholas reported no visible confirmation after requesting a Google Business connection from lower on the Social Accounts page. Existing send success/error notices were located at the top of the Client panel and therefore outside the viewport.
- **Change:** Add one fixed, dismissible, accessible upper-right Request Connection notification shared across Facebook, Instagram, LinkedIn, YouTube and Google Business. Success shows platform, email recipient and 48-hour expiry; failure shows a distinct error and asks the owner to check request history. Notifications persist until dismissed or the next request, so the message does not disappear before it can be read. Account-health notices remain in the Client panel, and the existing request API, Resend email, history, OAuth and publishing behavior are unchanged. The layout adjusts to narrow mobile viewports.
- **Files:** `components/connections-manager.js`, `components/ui.module.css`, `lib/connection-request-feedback.js` (new), `tests/connection-request-feedback.test.js` (new), and this phase log.
- **Checks / manual:** Focused Node 22.16.0 helper tests passed (four test cases, including all five platforms, API failure, and empty-error failure), and CSS class/token integrity was checked against the actual JSX and global theme variables. Full Node 24.19.0 npm test, lint and production build, real responsive browser review and Resend delivery observation remain required. The frontend acknowledges API acceptance, not confirmed inbox receipt.
- **Status:** L5-GBP-03 still needs real emailed connection acceptance; L5-GBP-04 WAITING. No commit or push is authorized by this implementation request; progress entry is part of the prepared Git tree only.


### October 19, 2026: L5-GBP-03 emailed OAuth BSON lookup bug fix prepared

- **Live symptom:** Owner screenshot shows the emailed Google authorization flow redirected to the generic Google location/identity error instead of the location picker. This is a live failure, not accepted connection evidence.
- **Confirmed code defect:** `consumeGoogleBusinessOauthState` serializes MongoDB BSON ObjectIds as hex strings. The shared `getActiveConnectionRequestForFlow` helper queried `connection_requests` using those strings, but real MongoDB requires BSON `ObjectId` in `_id` and `clientId` equality checks. The existing fake Mongo test matcher converts both sides to strings and obscured the defect.
- **Prepared fix:** Normalize both IDs with existing `toObjectId` before request lookup and fail closed on invalid, expired, replaced, already-completed or unauthorized-platform requests. Assign a sanitized `request` error reason so the Google callback shows the existing request-expired/replaced guidance rather than claiming an ineligible location. Do not change credential handling, consent permissions, direct OAuth, business location selection, scheduled publishing or existing connections.
- **Files:** `lib/connections.js`; `app/api/connections/google-business/callback/route.js`; `tests/google-business-connection.test.js` (real BSON ObjectId regression and failure mapping); this active phase log.
- **Verification:** Focused checks and results are recorded in the current handoff; the full Node 24.19.0 npm test, lint and production build plus a real browser-based emailed connection retest remain mandatory after a separately approved deployment. Do not infer live repair from a local source check.
- **Status:** `L5-GBP-03 READY` pending verified completion; `L5-GBP-04 WAITING`. No commit or push is authorized by this request; GitHub `main` remains at `caa5eb1` until explicit delivery approval.
