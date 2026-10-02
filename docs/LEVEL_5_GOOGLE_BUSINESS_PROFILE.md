# Level 5 Google Business Profile

This is the active plan and progress record for continued Level 5 platform expansion. Nicholas approved moving the required remaining providers ahead of Level 6 Workflow + Calendar on October 2, 2026.

Instagram remains completed in `docs/LEVEL_5_INSTAGRAM.md`. This phase must preserve the working Facebook and Instagram publishers and the shared scheduling architecture.

## Phase state

- Status: **OPEN — baseline maintenance is the first checkpoint**
- Opened: **October 2, 2026**
- Active phase document: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`
- Provider: **Google Business Profile**
- Application provider identity: `google_business_profile`
- Dependency: completed Facebook publishing/scheduling and the closed Instagram adapter
- API access: **unverified**
- Live-test client and exact business location: **unconfirmed**
- Current task: **L5-GBP-00 — Baseline Maintenance Checkpoint (`READY`)**
- No Google adapter, OAuth credentials, API access approval, or live publication is proven by opening this document

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
- Broader token-maintenance, alerting, and worker-recovery findings from the October 2 review must receive their own bounded assignments; this phase does not implicitly authorize an architectural rewrite.

## Ordered task queue

| ID | Status | Task | Dependency / required evidence |
| --- | --- | --- | --- |
| L5-GBP-00 | `READY` | Baseline maintenance checkpoint | Reproducible passing test command, reconciled carousel validation/tests, lint without errors |
| L5-GBP-01 | `WAITING` | Google Business Profile access readiness | Baseline maintenance accepted; verified project approval/eligibility and exact test client/location |
| L5-GBP-02 | `WAITING` | Direct OAuth, location selection, credential renewal, Account Health | Access checkpoint accepted; real location saved Healthy under correct client |
| L5-GBP-03 | `WAITING` | Secure Request Connection and client scoping | Direct Connect proven; real emailed setup and link lifecycle verified |
| L5-GBP-04 | `WAITING` | Destination version, validation, and preview | Connection paths proven; separate editable Google version with Master protections |
| L5-GBP-05 | `WAITING` | Standard text/CTA update publisher | Editor accepted; real visible post, durable exact result/history, duplicate protection |
| L5-GBP-06 | `WAITING` | Private-S3 image update publishing | Text publisher proven; real image result without public bucket access |
| L5-GBP-07 | `WAITING` | Shared background scheduling and reliability | Direct publisher proven; browser-closed publish, cancellation/stale guards, worker re-entry |
| L5-GBP-08 | `WAITING` | Final adapter evidence and Work review | Complete deployed evidence, Facebook/Instagram regression review, closure decision |

Exactly one task is `READY`. Opening the phase does not authorize completing several tasks in one chat. Repository writes still require Nicholas's explicit confirmation under his GitHub rule.

## L5-GBP-00 — Baseline Maintenance Checkpoint

### Objective

Repair the demonstrated test-runner, carousel-validation/test, and lint gaps before building the Google adapter. Make the smallest changes that preserve the proven publishing, destination editing, and client-switching behavior.

### Acceptance criteria

1. Reproduce the October 2 baseline with the current repository and supported Node version before editing.
2. Make `npm test` work under the documented supported runtime. The existing command's `--experimental-default-type=module` flag was rejected under Node 24.19.0; choose a supported invocation without a speculative module-system migration. Document the runtime requirement.
3. Resolve both failing carousel tests by checking current official Instagram rules for carousel video ratios. Update fixtures/tests if the restriction is correct; update validation and meaningful boundary coverage if the implementation is wrong. Do not accept 9:16 solely to satisfy a stale fixture.
4. Resolve the two `react-hooks/set-state-in-effect` lint errors while preserving client-scoped connection display and correct link-preview reset/loading/error behavior. Avoid blanket lint suppression or a broad editor rewrite.
5. Run the complete test suite, lint, and production build. Require zero test failures and zero lint errors; document each retained warning and whether it affects this task. Do not call the baseline clean without reporting warnings.
6. Review the diff for unintended application or documentation changes and verify no secrets were introduced.
7. Record exact commands, runtime, counts, files, decisions, and live-verification status here. If UI changes affect the verified connection/preview paths, specify the focused deployed smoke test rather than treating the build as live proof.
8. Do not implement Google API/OAuth code, change external accounts, submit real posts, perform full UX work, or start token/monitoring follow-ups in this task.

### Completion and next task

After checks pass and required UI smoke evidence is accepted, mark L5-GBP-00 `DONE` and L5-GBP-01 as the sole `READY` task. If deployment/manual smoke is required, use `MANUAL` and leave access readiness `WAITING`.

## L5-GBP-01 — Google Business Profile Access Readiness

Confirm the exact test client/location with Nicholas and inspect the non-secret Google project access status. Recheck current prerequisites, enabled APIs, intended OAuth scopes, callback plan, consent configuration, and account/location selection mechanism. Document missing manual actions and the minimal environment-variable names without recording their values.

No OAuth implementation or external account modification in this task. It is `DONE` only when the required access/configuration path is supported by evidence; otherwise retain a named manual/blocking checkpoint. Only then may L5-GBP-02 become `READY`.

## L5-GBP-02 — Direct OAuth / Location / Renewal / Health

Add a dedicated provider adapter and only the shared connection seams it needs. Prove expiring one-time client-scoped OAuth, explicit location choice, encrypted credentials, supported token renewal, safe revoked/expired/permission handling, and location-scoped health/capability checks. Confirm the actual destination before persistence. Verify persistence and client switching with a real eligible location, without publishing.

## L5-GBP-03 — Request Connection

Extend requested-platform state, secure setup page, and email copy for Google Business Profile. Prove authorization saves only to the request's client, exact location selection, completion protection, replacement revocation, expiration, and no owner-workspace exposure. Preserve Facebook/Instagram behavior, including multi-platform requests.

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
