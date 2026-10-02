# Level 5 Instagram Adapter

Level 5 adds the first additional social network to the verified Content Social Hub connection, publishing, and scheduling architecture.

The first Level 5 provider is **Instagram**.

The goal is not to add every Meta capability or every Instagram surface at once. The goal is to prove that an Instagram Professional account can be connected to the correct Content Social Hub client, receive its own destination-specific platform version, publish supported media through the same durable result/idempotency model, and then use the already-proven Level 4 background scheduling path without weakening the working Facebook implementation.

## Phase progress log

- Phase status: **IN PROGRESS**
- Opened: **September 30, 2026**
- Active phase document: `docs/LEVEL_5_INSTAGRAM.md`
- Dependency: **Level 4 — Scheduling closed September 30, 2026**
- Provider: **Instagram Professional accounts (Business / Creator)**
- Preferred live-test client: `Nicholas_Egner`
- Preferred live-test destination: Nicholas's GIGnovate Instagram Professional account; exact provider account ID / handle must be confirmed during the L5-01 live checkpoint rather than guessed
- Next implementation rule: select the first task marked `READY`, complete only that task, record evidence here, and return the README handoff report
- Level 5 Instagram is not complete until Work reviews the final live connect/publish/schedule evidence and updates the README

## Level 5 Instagram pass condition

The Instagram adapter passes only after this real deployed flow works end to end:

```text
Select Nicholas_Egner
-> Connect Instagram Professional account
-> persist exact Instagram destination under Nicholas_Egner
-> Account Health is Healthy / publishable
-> open Master Content
-> select the Instagram destination
-> create/load an Instagram platform version
-> validate Instagram-specific media/caption rules
-> Publish Now
-> persist exact Instagram media ID / permalink and Publish History
-> View Post opens the exact Instagram result
-> schedule a fresh Instagram revision
-> close the browser
-> AWS wakes the existing background worker
-> Instagram publishes exactly once
-> scheduled result persists without duplicate submission
```

A UI-only Instagram card, OAuth success without a saved publishable destination, or a provider call that bypasses the existing durable attempt/idempotency model is not sufficient.

## Provider facts verified at phase opening

The current Meta Instagram Platform supports Professional accounts (Business and Creator), content publishing, and a direct Instagram Login flow that does not require the Instagram account to be linked to a Facebook Page. Current Instagram Login scopes use the `instagram_business_*` names, including `instagram_business_basic` and `instagram_business_content_publish`.

Instagram publishing is media-first and container-based. The initial adapter should treat single-image feed posts, carousel posts, and Reels/video as the supported publishing surfaces. Do not pretend Instagram supports Facebook-style text-only or native website-link-preview posts.

Meta must be able to retrieve publishing media. The existing private S3 bucket must remain private; use short-lived provider-accessible presigned GET URLs or another provider-supported upload mechanism rather than changing bucket public-access policy.

Provider references reviewed at phase opening:

- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
- Meta's maintained Instagram API Postman collection

If live Meta configuration or current provider documentation contradicts one of these assumptions, stop at the affected checkpoint and update this phase record before changing architecture.

## Current repository observations

The repository already has provider-independent storage concepts that should be preserved:

- `social_connections` is keyed by client, platform, and provider account ID
- `platform_versions` is a separate collection and already stores `platform`
- publish attempts/results are durable MongoDB records
- Master Content and media are provider-independent
- Level 4 schedules bind a social connection, platform version, exact revision, release instant, and platform
- private media stays in S3 and provider transfer happens server-side

Several implementation layers are still Facebook-specific and must be generalized only as needed:

- `lib/connections.js` contains Facebook-specific OAuth, selection, health, and Request Connection assumptions
- `components/connections-manager.js` currently presents Facebook as the working network
- `components/platform-destination-selector.js` is Facebook-specific in copy and eligibility rules
- `lib/platform-version-logic.js` / `lib/platform-versions.js` use Facebook-specific inherited fields and publishability helpers
- the platform editor, Publish Now controls, and schedule controls are Facebook components
- `lib/scheduled-release-dispatch.js` calls the Facebook publisher directly

Do not rewrite all of these into a speculative framework before Instagram proves what should actually be shared. Extract provider-neutral seams only where the second adapter demonstrates a concrete common boundary.

## Locked Level 5 Instagram architecture decisions

### Instagram is a separate destination, not a Facebook Page property

Persist Instagram as its own `social_connections` record with `platform: "instagram"`, its own provider account ID, display identity, encrypted token, scopes, health state, and publish capability.

A Facebook Page connection and an Instagram connection may belong to the same Content Social Hub client, but one must not masquerade as the other.

### Start with Instagram API with Instagram Login

The first implementation path should use Meta's Instagram Login / Business Login for Instagram for Professional accounts instead of requiring a Facebook Page linkage merely because the Facebook adapter already exists.

This gives Instagram an independent client connection and proves the multi-platform connection model rather than coupling the second adapter to the first.

If the live Meta app cannot enable the required Instagram Login product/configuration without a provider/account constraint, stop at the manual Meta checkpoint and document the exact limitation before considering the Facebook Login variant.

### Reuse secure connection infrastructure, not Facebook-specific assumptions

Reuse:

- secure OAuth state handling
- encrypted token storage
- client scoping
- expiring Request Connection links
- Resend delivery
- request replacement/revocation behavior
- Account Health presentation patterns

Generalize these only enough to support both Facebook and Instagram cleanly.

### Publishing surfaces for the initial Instagram adapter

Initial Level 5 Instagram publishing scope:

- single image feed post
- carousel feed post using supported image/video children
- Reel / video post
- caption
- exact remote media ID and permalink / `View Post`

Explicitly defer from this phase unless required to make one of the above work:

- Stories
- live video
- product tagging / shopping
- branded-content tooling
- collaborators
- location tagging
- comment management
- messaging
- hashtag search

### Instagram has no Facebook-style text/link-only post

Instagram validation must require compatible media. A Master Content URL may remain useful source context or caption text, but the adapter must not invent a clickable native link-preview publishing behavior that Instagram does not provide.

### Preserve private media

Do not make `content-social-hub-media` public.

When Instagram needs a provider-retrievable URL, generate a short-lived signed GET URL with enough lifetime for Meta to fetch/process the media. The persisted application record continues to store the private S3 key/reference, not the signed URL.

If an Instagram media type requires a derivative (for example a provider-compatible JPEG), preserve the original and write an explicit provider derivative rather than replacing the original asset.

### Preserve Level 3 publish safety

Instagram must use the same application-level safety concepts already proven for Facebook:

- destination/client ownership check
- health + capability recheck immediately before submission
- exact platform-version revision
- deterministic duplicate barrier / durable publish attempt
- conservative handling of ambiguous provider outcomes
- explicit result persistence
- retry only when provider certainty makes retry safe

Do not share a provider submission key between Facebook and Instagram destinations.

### Preserve Level 4 scheduling architecture

Do not build a second scheduler.

After direct Instagram publishing is proven, extend the existing `scheduled_releases` + EventBridge Scheduler + worker path so the worker dispatches by platform/provider and reuses the Instagram publisher.

A scheduled Instagram post must preserve the same stale-revision, cancellation, missed-schedule, review-required, and duplicate-safety semantics already proven in Level 4.

### Analytics remains Level 8

Capture provider/account metadata and scopes needed to support future Instagram analytics, but do not build follower analytics, insights dashboards, engagement alerts, comments, or reporting in Level 5.

### Calendar and approvals remain later levels

Do not pull the Level 6 full Calendar or Level 7 approval workflow into this phase.

## Task queue

| ID | Status | Task | Evidence or dependency |
| --- | --- | --- | --- |
| L5-01 | `DONE` | Build Instagram connection / OAuth / Account Health foundation | Real `@nicholasegner` Professional account connected to `Nicholas_Egner`; persisted and Healthy in production |
| L5-02 | `DONE` | Extend Request Connection flow to Instagram and prove client-scoped live connection | Real emailed `@nicholasegner` request completed under `Nicholas_Egner`; connection persisted Healthy in production |
| L5-03 | `DONE` | Add Instagram destination selection, platform version, validation, and preview | Real `@nicholasegner` destination/version inheritance, customization preservation, reset behavior, validation, and carousel preview verified in production |
| L5-04 | `DONE` | Publish single-image Instagram posts with durable results and duplicate protection | Real `@nicholasegner` single-image post published from revision 9; Succeeded history, Published lock, and exact View Post verified in production |
| L5-05 | `DONE` | Add Instagram carousel publishing | Real `@nicholasegner` multi-image carousel published; Succeeded history and exact live `View Post` verified in production |
| L5-06 | `MANUAL` | Add Instagram Reels/video publishing and processing-state handling | Implementation deployed; real `@nicholasegner` Reel publish / persisted result verification required |
| L5-07 | `WAITING` | Extend background scheduling to Instagram and run final browser-closed checkpoint | Requires all direct Instagram publishing modes to be proven |

There should normally be only one `READY` task.

## L5-01 — Instagram Connection / OAuth / Account Health Foundation

### Objective

Add the minimum real Instagram Professional-account connection adapter needed to save one Instagram destination under the correct Content Social Hub client and prove its health/capability state without implementing Instagram publishing yet.

### Acceptance criteria

1. Add an Instagram provider module rather than placing Instagram API calls inside the Facebook adapter.
2. Use Instagram Login / Business Login for Instagram with current provider-recommended scopes. At minimum the design must request/store the scopes required for basic account access and content publishing.
3. Reuse the existing encrypted-token boundary; raw Instagram access tokens must never be returned to the browser, logged, committed, or stored unencrypted.
4. OAuth state must remain client-scoped and one-time/expiring. A callback for Client A must never be able to save the connection under Client B.
5. Persist Instagram as a separate `social_connections` record with at least client ID, `platform: "instagram"`, provider account ID, account name/username, profile image when available, encrypted token, expiration metadata where available, granted scopes, health state, publish capability, and health timestamps.
6. Preserve the existing unique social-connection rule by client + platform + provider account ID.
7. Add Instagram Account Health logic that proves the token/account is valid and that the required publishing permission is present. Health failure must be visible and must not silently mark the account publishable.
8. Update Social Accounts so Instagram appears as a real provider for direct Connect while the existing Facebook connection UI remains functional and client-scoped.
9. Do not implement Request Connection email changes in L5-01; that is L5-02.
10. Do not implement Master Content destination selection, platform versions, publishing, scheduling, Calendar, approvals, or analytics in L5-01.
11. Add focused tests for client scoping, provider/platform identity, required-scope evaluation, safe health-state classification, and any provider-neutral connection helpers extracted from Facebook code.
12. Run the relevant repository lint/tests/build available in the environment and record exact results below.
13. Stop at the Meta configuration checkpoint if Instagram Login product/configuration, redirect URI, app mode/review, or credentials require Nicholas to change the external Meta app.

### Live/manual verification

After deployment/configuration, use `Nicholas_Egner`:

1. open Social Accounts with `Nicholas_Egner` selected
2. choose Connect Instagram
3. complete Meta/Instagram authorization with a real Professional account
4. confirm the exact Instagram account identity before persistence
5. save it under `Nicholas_Egner`
6. run Account Health and confirm the saved record is Healthy/publishable
7. switch to another Content Social Hub client and confirm Nicholas's Instagram account does not appear there
8. reopen `Nicholas_Egner` and confirm the Instagram connection persists
9. confirm no Instagram post was created by L5-01

## L5-02 — Instagram Request Connection

### Objective

Extend the secure client-facing Request Connection system so Instagram can be requested and completed independently without exposing the owner workspace.

Planned acceptance boundary:

- connection requests can include Instagram
- request state tracks Facebook and Instagram independently rather than assuming one Facebook-only status
- Resend email/setup page clearly identifies requested networks
- Instagram authorization from the limited-purpose setup page saves only to the request's client
- completed/replaced/expired token lifecycle remains intact
- reconnect should preserve the same secure pattern
- prove with a real Instagram client-facing connection before moving on

## L5-03 — Instagram Platform Version, Validation, and Preview

### Objective

Create a real Instagram destination version while preserving Master defaults and destination-specific customization/revision rules.

Planned acceptance boundary:

- publishing destination selector supports both Facebook and Instagram connections without cross-provider confusion
- Instagram version is stored separately with `platform: "instagram"`
- inherited caption/media are copied from Master Content at creation/reset boundaries
- Instagram-specific validation requires compatible media
- media mode distinguishes at least single image, carousel, and Reel/video
- text-only / URL-only Master Content is visibly incompatible with Instagram instead of silently becoming publishable
- Master changes and Reset/Keep behavior preserve customized Instagram fields exactly as Facebook does
- Instagram preview is an approximation, not a pixel-perfect promise
- no real provider publish request yet

## L5-04 — Single-Image Instagram Publishing

### Objective

Prove the Instagram provider submission/result model with the smallest real publish surface first.

Planned acceptance boundary:

- final confirmation before provider submission
- server rechecks ownership, Account Health, required permission, media compatibility, and exact revision
- short-lived S3 signed media access; bucket stays private
- create Instagram media container, wait/check readiness when required, publish it, and persist the resulting Instagram media ID/permalink
- durable publish attempt and deterministic Instagram destination/revision idempotency
- refresh/reopen preserves Published lock + Publish History
- `View Post` opens the exact Instagram post
- ambiguous provider result cannot be blindly resubmitted
- live proof with one GIGnovate Instagram image post

## L5-05 — Instagram Carousel Publishing

### Objective

Extend the proven Instagram publisher to ordered multi-media carousel posts without weakening single-image idempotency.

Planned acceptance boundary:

- preserve Master/platform media ordering
- validate supported child media and carousel limits from current provider documentation
- create child containers and one parent carousel container
- publish exactly one parent result
- failures before remote acceptance remain retry-safe; ambiguous parent publish remains locked
- persist exact result + Publish History + `View Post`
- live proof with a real GIGnovate carousel

## L5-06 — Instagram Reels / Video Publishing

### Objective

Publish private-S3 video as an Instagram Reel using the provider's asynchronous container/processing flow without duplicate submission.

Planned acceptance boundary:

- validate provider-supported video/container/audio/duration/size constraints from current Meta docs at implementation time
- use signed private-S3 transfer or another documented upload path without making the bucket public
- submit one Reel container
- persist container/attempt identity before polling
- poll/refresh the same recorded provider attempt; never create a fresh Reel merely because processing is still pending
- terminal success stores Instagram media ID/permalink and `View Post`
- terminal/ambiguous failures preserve the Level 3/4 certainty rules
- live proof with one real GIGnovate Reel/video

## L5-07 — Instagram Scheduling + Final Level 5 Checkpoint

### Objective

Make Instagram a complete second publishing adapter by running it through the existing browser-independent Level 4 scheduling architecture.

Planned acceptance boundary:

- existing schedule model accepts Instagram platform versions without creating a second scheduling collection
- schedule controls become provider-aware rather than Facebook-only
- worker dispatch selects the correct provider publisher from saved `platform`
- stale Instagram revisions become Missed Schedule rather than silently publishing edited content
- cancellation removes the AWS trigger before dispatch
- successful scheduled Instagram result persists in the same durable schedule + Publish History pattern
- deliberate worker re-entry after success is a no-op
- final live checkpoint: schedule a clean Instagram post, close the browser, confirm exactly one Instagram result, exact `View Post`, durable Succeeded history, zero duplicate submission

When L5-07 is complete, Work reviews the full Instagram evidence. Only Work may mark the Instagram Level 5 adapter complete in the README or open another Level 5 provider.

## Progress entries

### September 30, 2026: Level 5 Instagram plan opened

- Level 4 Scheduling was reviewed and closed before opening this phase.
- Nicholas selected Instagram as the first Level 5 additional provider.
- Reviewed current repository seams before defining the task order:
  - connection storage is structurally multi-platform but connection/OAuth logic is currently Facebook-specific
  - platform-version storage contains a `platform` field but destination selection/inheritance/validation is currently Facebook-specific
  - durable publishing attempts and Level 3 idempotency provide the result-safety model to preserve
  - Level 4 scheduling records already store platform and destination identity, but worker dispatch is currently Facebook-specific
- Reviewed current Meta Instagram platform constraints before planning:
  - Professional accounts only
  - Instagram Login can operate without requiring a linked Facebook Page
  - publishing uses media containers and a publish step
  - media must be retrievable by Meta or uploaded through a documented provider flow
- Chose Instagram Login as the initial connection path so Instagram becomes a real independent second social connection rather than an extension of the saved Facebook Page record.
- Chose single-image publish as the first remote publish checkpoint, followed by carousel, Reel/video, then scheduled background publishing.
- Kept Stories, comments/messaging, analytics, Calendar, approvals, and reporting outside this phase.
- Preserved the private-S3 rule; signed provider access or provider upload is allowed, public bucket access is not.
- Marked only `L5-01` as `READY`.
- No Instagram OAuth credentials, Meta product configuration, provider posts, or application code were changed while opening this plan.

### September 30, 2026: L5-01 implementation checkpoint

- Task: `L5-01` — Instagram Connection / OAuth / Account Health Foundation.
- Outcome: application implementation completed to the external Meta configuration checkpoint; task moved to `MANUAL` pending deployed OAuth configuration and live account verification.
- Provider verification before implementation:
  - reviewed Meta's maintained Instagram API Postman workspace and current Business Login guidance
  - confirmed Instagram Login supports Professional accounts without requiring a linked Facebook Page
  - confirmed the current scope names used by this adapter are `instagram_business_basic` and `instagram_business_content_publish`
  - confirmed the Instagram Login path uses Instagram authorization, `api.instagram.com` code exchange, and `graph.instagram.com` for long-lived token/profile access
- Files changed:
  - `.env.example`
  - `app/(app)/connections/page.js`
  - `app/api/connections/instagram/start/route.js`
  - `app/api/connections/instagram/callback/route.js`
  - `app/api/connections/instagram/confirm/route.js`
  - `app/connect/instagram/confirm/page.js`
  - `app/connect/instagram/error/page.js`
  - `components/connections-manager.js`
  - `components/instagram-account-confirm.js`
  - `lib/connections.js`
  - `lib/instagram.js`
  - `lib/instagram-connection-logic.js`
  - `tests/instagram-connection-logic.test.js`
  - `docs/LEVEL_5_INSTAGRAM.md`
- Implementation decisions inside L5-01:
  - added a separate `lib/instagram.js` provider adapter; no Instagram provider calls were placed inside `lib/facebook.js`
  - direct Connect only; the Facebook-only Request Connection behavior is intentionally unchanged for L5-02
  - Instagram OAuth state is client-scoped, one-time, expiring, and tagged `platform: "instagram"`
  - OAuth returns to a private account-confirmation step that displays the exact username/account ID before persistence
  - the temporary access token is encrypted immediately in the server-side selection flow and is never returned to browser JSON or logged
  - final persistence uses the existing client + platform + provider-account unique identity with `platform: "instagram"`
  - saved Instagram metadata includes username/account type/profile image, encrypted long-lived token, token expiration when provided, granted scopes, capability, health state, and health timestamps
  - shared Account Health dispatch now selects Facebook or Instagram verification by the saved connection platform; Facebook behavior remains on the existing provider path
  - Instagram health requires a Business/Creator account plus both required granted scopes; missing permission/account type blocks `canPublish`
- Checks run in the available execution environment:
  - `node --experimental-default-type=module --test tests/instagram-connection-logic.test.js` against the new focused test file: **7 passed, 0 failed**
  - `node --check lib/instagram.js`: **passed**
  - `node --check lib/instagram-connection-logic.js`: **passed**
  - `node --check lib/connections.js`: **passed**
  - `node --check app/api/connections/instagram/start/route.js`: **passed**
  - `node --check app/api/connections/instagram/callback/route.js`: **passed**
  - `node --check app/api/connections/instagram/confirm/route.js`: **passed**
- Full local repository lint/build could not run because the execution container could not resolve `github.com` to clone the repository; the implementation therefore used the repository connector plus focused local syntax/unit checks.
- Amplify production job `99` for commit `3bb7ce32952e5b321322b84ef9c2144812a7282a`: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**. This provides the full deployed Next.js build verification for the implementation.
- Live-test status: **not yet completed**. No Instagram account has been saved and no Instagram post has been created by this task.
- Manual Meta / deployment checkpoint now required:
  1. enable/configure Instagram API with Instagram Login on the Meta app
  2. add the production redirect URI `https://main.d1yfjibipwjpld.amplifyapp.com/api/connections/instagram/callback`
  3. obtain the Instagram App ID and Instagram App Secret without posting either secret in chat or source control
  4. add `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` to Amplify environment variables; `INSTAGRAM_GRAPH_VERSION=v26.0` is optional because the adapter defaults to v26.0. Production inspection after deploy confirmed the two required Instagram variables are currently absent while `APP_BASE_URL` and `OAUTH_TOKEN_ENCRYPTION_KEY` are already present.
  5. deploy, then run the L5-01 live/manual verification with `Nicholas_Egner`
- Remaining work before L5-01 can be marked `DONE`:
  - complete real Instagram authorization
  - confirm the exact GIGnovate Instagram Professional identity before save
  - verify the saved connection becomes Healthy/publishable
  - verify cross-client isolation and persistence after reopening
  - confirm L5-01 created no Instagram post
- `L5-02` remains `WAITING`; do not start it until this direct-connect checkpoint is supported by live evidence.

### October 1, 2026: L5-01 live connection closed

- Task: `L5-01` — Instagram Connection / OAuth / Account Health Foundation.
- Outcome: `DONE`. Nicholas explicitly closed the task after the real deployed Instagram Login flow successfully connected the Professional account `@nicholasegner` to `Nicholas_Egner` and the persisted Social Accounts record displayed `Healthy`.
- External configuration completed during the live checkpoint:
  - configured Instagram API with Instagram Login in the existing Meta app
  - registered the production OAuth redirect URI
  - added `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` to Amplify and redeployed successfully
  - added `nicholasegner` as an Instagram Tester and accepted the tester invitation while the Meta app remains unpublished
  - authorization presented both required capabilities: profile/media access and content publishing access
- Live verification evidence:
  - Meta/Instagram OAuth authorization completed with the real `nicholasegner` Professional account
  - the app returned a successful `Instagram account connected` screen naming `@nicholasegner` and client `Nicholas_Egner`
  - the connection persisted on Social Accounts after returning from OAuth
  - the persisted Instagram connection displayed `Healthy` and a current health timestamp
  - the existing GIGnovate Facebook Page connection remained Healthy on the same Social Accounts surface
  - no Instagram publishing code was invoked by L5-01 and no Instagram post was intentionally created by this task
- Production identity issue discovered and corrected during the live test:
  - Meta's OAuth token subject ID and the Instagram Professional account identity returned by `/me` are not guaranteed to be the same identifier
  - commit `38308637` added Professional-account identity normalization
  - commit `47c4fc79` added focused identity-field regression coverage
  - commit `03a4043a` removed the invalid cross-ID equality requirement while preserving the client-scoped one-time OAuth state and exact account confirmation boundary
  - Amplify production job `104` for `03a4043a56e3d7b5e0ae6e035ae0f4d61cccca7d`: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
  - focused Instagram connection tests after the final fix: **10 passed, 0 failed**; callback syntax check passed
- Client isolation remains enforced by the persisted connection identity (`clientId + platform + providerAccountId`) and client-filtered Social Accounts query. A dedicated second-client screenshot was not separately captured before Nicholas directed task closure; no cross-client leak was observed in the live flow.
- MongoDB Atlas connector verification was unavailable because AI-client access is disabled for the Atlas organization; this did not block the deployed UI/OAuth/health evidence above.
- Files changed during final live-test fixes and closure:
  - `lib/instagram.js`
  - `lib/instagram-connection-logic.js`
  - `app/api/connections/instagram/callback/route.js`
  - `tests/instagram-connection-logic.test.js`
  - `docs/LEVEL_5_INSTAGRAM.md`
- Blockers/manual actions: none remain for L5-01.
- Remaining Level 5 work begins with `L5-02`; Request Connection support for Instagram has not been implemented yet.
- Status transition: `L5-01` -> `DONE`; `L5-02` -> `READY`. All later Level 5 tasks remain `WAITING`.

### October 1, 2026: L5-02 implementation and deployment checkpoint

- Task: `L5-02` — Instagram Request Connection.
- Outcome: application implementation completed and deployed successfully; task moved to `MANUAL` pending the required real client-facing Instagram Request Connection verification.
- Files changed:
  - `app/api/connection-requests/route.js`
  - `app/api/connections/facebook/start/route.js`
  - `app/api/connections/instagram/callback/route.js`
  - `app/api/connections/instagram/confirm/route.js`
  - `app/api/connections/instagram/start/route.js`
  - `app/connect/[token]/page.js`
  - `app/connect/instagram/error/page.js`
  - `components/connections-manager.js`
  - `components/instagram-account-confirm.js`
  - `lib/connection-request-logic.js`
  - `lib/connections.js`
  - `lib/email.js`
  - `tests/connection-request-logic.test.js`
  - `docs/LEVEL_5_INSTAGRAM.md`
- Implementation decisions:
  - connection requests are now provider-aware instead of being hard-coded to Facebook; the request record stores `requestedPlatforms` and independent `platformStatus` entries
  - the owner UI can send separate Facebook or Instagram Request Connection emails; creating a replacement request revokes unfinished requests only for the same requested network, so an Instagram request does not invalidate an unrelated Facebook request
  - the Resend email and limited-purpose setup page identify the requested network and never expose owner-workspace navigation
  - Instagram request-mode OAuth carries both the request ID and client ID through one-time expiring OAuth state and account-confirmation state
  - Instagram confirmation may complete without an owner session only when the saved selection flow is explicitly `mode: "request"`; direct owner Connect still requires the owner session
  - final Facebook and Instagram request-mode saves re-check that the bound request is still pending, unexpired, for the same client, and includes the provider being connected before persisting completion
  - request completion is provider-aware: if a request includes multiple networks, the overall request remains pending until every requested network is connected
  - reconnect uses the same client + platform + provider-account upsert identity, so the existing Healthy Instagram connection can be safely reauthorized through the client-facing flow during live verification
  - no L5-03 destination/version, publishing, scheduling, Calendar, approval, or analytics work was added
- Checks and tests run:
  - `node --experimental-default-type=module --test /mnt/data/connection-request-logic.test.js`: **7 passed, 0 failed**
  - `node --check /mnt/data/connection-request-logic.js`: **passed**
  - production Amplify job `106` for commit `a3a784a30881195f79f3bc085affee9de6d5c3fd` (`Implement L5-02 Instagram request connection`): **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
  - the local execution container still cannot resolve `github.com`, so a separate local full-repository clone/lint/build was unavailable; Amplify job 106 supplies the deployed full Next.js build/deploy verification
- Live-test status: **required / not yet completed**. No L5-02 client-facing Instagram authorization has been completed yet.
- Required live/manual checkpoint using `Nicholas_Egner`:
  1. select `Nicholas_Egner` in Social Accounts and click Instagram `Request Connection`
  2. confirm the real Resend email arrives and clearly identifies the Instagram Professional connection request
  3. open the secure setup link in a private/incognito browser and confirm no owner workspace navigation is exposed
  4. choose Continue with Instagram, authorize the real `@nicholasegner` Professional account, and confirm the exact Instagram identity before saving
  5. confirm the completion screen stays limited-purpose and reports the account connected to `Nicholas_Egner`
  6. return to the owner Social Accounts view, confirm the Instagram connection persists and Account Health is Healthy/publishable, and verify it does not appear under another client
  7. reopen the completed setup link and confirm it cannot start another authorization
  8. create a fresh unfinished Instagram Request Connection, then create a replacement before completing the first; confirm the older Instagram link is unavailable while the newest replacement remains usable
  9. confirm existing Facebook Request Connection behavior and the existing GIGnovate Facebook connection remain unaffected
- Blockers/manual actions: only the live client-facing verification above. No external Meta configuration or new secret is expected for L5-02 because L5-01 already proved the Instagram app credentials and production redirect URI.
- Remaining work: do not begin `L5-03`. After the live Request Connection, completed-link, replacement-link, client-isolation, and Healthy-account evidence is recorded, change `L5-02` to `DONE` and make `L5-03` the sole `READY` task.

### October 1, 2026: L5-02 live Request Connection closed

- Task: `L5-02` — Instagram Request Connection.
- Outcome: `DONE`. The real client-facing Instagram Request Connection completed successfully for `Nicholas_Egner` using the existing Professional account `@nicholasegner`.
- Live verification evidence:
  - the production Social Accounts UI exposed separate Facebook and Instagram `Request Connection` actions
  - a real Resend email arrived and clearly identified the requested Instagram Professional account connection for `Nicholas_Egner`
  - the secure setup link was opened in a limited-purpose browser flow with no owner-workspace navigation exposed
  - Instagram authorization recognized the existing `nicholasegner` account and returned to the app's explicit confirmation screen
  - the confirmation screen showed `@nicholasegner`, Instagram Creator, the exact provider account ID, and client `Nicholas_Egner` before persistence
  - final confirmation returned `Instagram account connected`, named `@nicholasegner` and `Nicholas_Egner`, reported Account Health as healthy, and stated the setup page could be safely closed
  - returning to the owner Social Accounts view showed `@nicholasegner` persisted as `Instagram Professional` with `Healthy` status and a fresh October 1 health timestamp
  - the connection-request history showed the completed Instagram request plus the older Instagram request as `Revoked`, preserving the replacement lifecycle
  - existing Facebook request history still showed completed/revoked/expired lifecycle states, and the existing GIGnovate Facebook Page connection remained `Healthy`
  - production CloudWatch logs for the final save window contained no application error/exception events
- Email-send diagnostic during the live checkpoint:
  - the first live request attempt created the request but the email send returned a generic Resend failure
  - production configuration inspection confirmed `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `APP_BASE_URL`, and Instagram credentials were present; the sender domain was verified and sending-enabled in Resend
  - commit `ea078d4156c17eb5e8d6233e2f8460d692e17b01` added safe Resend HTTP-status/error diagnostics without exposing credentials
  - Amplify job `108` for that commit: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
  - the subsequent production email request succeeded with Resend HTTP `200` and the email was delivered; no credential rotation or secret change was required
- Automated/deployment evidence remains:
  - focused provider-aware request tests: **7 passed, 0 failed**
  - request-logic syntax check: **passed**
  - Amplify job `106` for the L5-02 implementation: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
- Files changed across L5-02 implementation, live diagnostic, and closure:
  - `app/api/connection-requests/route.js`
  - `app/api/connections/facebook/start/route.js`
  - `app/api/connections/instagram/callback/route.js`
  - `app/api/connections/instagram/confirm/route.js`
  - `app/api/connections/instagram/start/route.js`
  - `app/connect/[token]/page.js`
  - `app/connect/instagram/error/page.js`
  - `components/connections-manager.js`
  - `components/instagram-account-confirm.js`
  - `lib/connection-request-logic.js`
  - `lib/connections.js`
  - `lib/email.js`
  - `tests/connection-request-logic.test.js`
  - `docs/LEVEL_5_INSTAGRAM.md`
- Decisions:
  - no L5-03 destination/platform-version work was started in this chat
  - L5-02 is closed on the combined automated, deployed, Resend, and live UI evidence above
- Blockers/manual actions: none remain for L5-02.
- Remaining work: `L5-03` is now the sole `READY` task. All later Level 5 tasks remain `WAITING`.
- Status transition: `L5-02` -> `DONE`; `L5-03` -> `READY`.

### October 1, 2026: L5-03 implementation and deployment checkpoint

- Task: `L5-03` — Instagram Platform Version, Validation, and Preview.
- Outcome: implementation completed and deployed successfully; task moved to `MANUAL` pending the real production destination/editor verification below.
- Files changed:
  - `app/(app)/content/[id]/page.js`
  - `app/api/content/[id]/destinations/route.js`
  - `app/api/platform-versions/[id]/route.js`
  - `components/instagram-platform-editor.js`
  - `components/platform-destination-selector.js`
  - `lib/platform-version-logic.js`
  - `lib/platform-versions.js`
  - `tests/instagram-platform-version-logic.test.js`
  - `docs/LEVEL_5_INSTAGRAM.md`
- Implementation decisions:
  - publishing-destination loading and selection now supports Healthy Facebook and Instagram connections under the same client while retaining explicit provider labels and client-scoped eligibility
  - Instagram platform versions persist separately with `platform: "instagram"`, caption, compatible selected media, primary media, detected media mode, Master revision marker, customized state, and the existing destination identity fields
  - Instagram creation/reset inherits the Master caption and compatible image/video media in Master order; unsupported Master media is excluded from the Instagram inherited selection rather than being treated as publishable
  - Instagram media mode is derived as `single_image`, `carousel`, `reel`, or `incompatible`; text-only / URL-only content receives blocking validation instead of becoming publishable
  - the existing platform-version PATCH route now dispatches saves/resets by the persisted platform while Facebook save/reset behavior remains on the existing Facebook functions
  - the Instagram editor supports destination-specific caption/media customization, live validation, detected format, Master-change warning, Reset/Update From Master, and an approximate Instagram preview
  - no Instagram Publish Now or Schedule controls are rendered in L5-03, and no Meta publishing API call was added
  - no Calendar, approval, analytics, engagement, or second-provider work was pulled into this task
- Checks and tests run:
  - combined existing Facebook + new Instagram platform-version logic tests: **16 passed, 0 failed**
  - focused new Instagram platform-version logic tests: **8 passed, 0 failed**
  - `node --check` for `lib/platform-version-logic.js`: **passed**
  - `node --check` for `lib/platform-versions.js`: **passed**
  - `node --check` for `app/api/platform-versions/[id]/route.js`: **passed**
  - `node --check` for `app/api/content/[id]/destinations/route.js`: **passed**
  - Amplify production job `110` for commit `0d38e5fac2022fd40a3d940aacad6802da6012f8` (`Implement L5-03 Instagram platform versions`): **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
  - a separate local full-repository clone/lint/build remains unavailable because the execution container cannot resolve `github.com`; Amplify job 110 supplies the deployed full Next.js build/deploy verification
- Live-test status: **required / not yet completed**. L5-03 contains no Instagram provider submission path, so this checkpoint must verify persisted UI/version behavior without creating an Instagram post.
- Required live/manual checkpoint using `Nicholas_Egner` and the existing Healthy `@nicholasegner` connection:
  1. open or create Master Content under `Nicholas_Egner` with at least one attached image
  2. in Publishing Destinations, confirm both the GIGnovate Facebook Page and `@nicholasegner` Instagram Professional destination are shown with distinct provider labels
  3. select/save Instagram and confirm a separate Instagram-specific editor appears, inherits the Master caption/media, and shows `Single image` for one selected image
  4. change the Instagram caption and/or selected media, save it, refresh/reopen the Master Content, and confirm the Instagram customization persists without changing the Facebook version
  5. change and save the Master Content, then confirm the customized Instagram version warns that Master changed while preserving its edits; use `Update From Master` and confirm the current Master caption/media replaces the Instagram-specific customization
  6. remove all Instagram media selections and confirm live validation visibly blocks the draft as incompatible; add compatible media back and confirm validation clears
  7. where the Master has suitable assets, confirm media-mode detection changes between single image, carousel, and Reel/video as selections change
  8. confirm the Instagram editor exposes no Publish Now or Schedule action yet and verify no Instagram post was created by this task
- Blockers/manual actions: only the deployed L5-03 UI/version verification above.
- Remaining work: do not begin `L5-04` until the live destination/version/validation/reset evidence is recorded and `L5-03` is moved to `DONE`.
- Status transition: `L5-03` -> `MANUAL`; `L5-04` remains `WAITING`.

### October 1, 2026: L5-03 live destination/editor verification closed

- Task: `L5-03` — Instagram Platform Version, Validation, and Preview.
- Outcome: `DONE`. Nicholas completed the deployed production editor checkpoint using the real `@nicholasegner` Instagram Professional destination under `Nicholas_Egner`.
- Live verification evidence:
  - a real image (`first-post-gram.png`) was attached to Master Content after the Instagram platform version already existed; the Instagram editor correctly reported that Master Content had changed and did not silently overwrite the existing destination version
  - before updating from Master, the Instagram draft visibly blocked publishing because no compatible media had yet been inherited into that version
  - `Update From Master` copied the current Master media into the Instagram version and cleared the incompatible-media state
  - a second image was added to Master Content and inherited into Instagram; both images were selected and the editor correctly detected `Carousel`
  - the approximate Instagram preview displayed both carousel items with `1/2` and `2/2` indicators
  - Nicholas customized the Instagram caption, saved it, and the version displayed `Revision 5 · Customized`
  - after the Master caption changed, the Instagram version displayed `Master content changed`, preserved the Instagram-specific caption/media, and continued to show no blocking validation issues
  - `Update From Master` then replaced the Instagram-specific caption with the current Master caption, preserved the inherited media set, cleared the Master-change warning, and displayed `Revision 6 · Inherited from Master`
  - the resulting version remained a valid `Carousel` with both images selected and the preview updated to the current Master caption
  - the Instagram editor exposed no Publish Now or Schedule action in L5-03, and the preview explicitly stated that L5-03 does not send anything to Instagram; no Instagram post was created by this task
- Automated/deployment evidence remains:
  - combined Facebook + Instagram platform-version logic tests: **16 passed, 0 failed**
  - focused Instagram platform-version logic tests: **8 passed, 0 failed**
  - Amplify production job `110` for implementation commit `0d38e5fac2022fd40a3d940aacad6802da6012f8`: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
- Files changed for task closure:
  - `docs/LEVEL_5_INSTAGRAM.md`
- Decisions:
  - L5-03 is closed on the combined automated, deployed, and real production editor evidence above
  - the first real Instagram provider submission remains intentionally deferred to L5-04
- Blockers/manual actions: none remain for L5-03.
- Remaining work: `L5-04` is now the sole `READY` task. `L5-05`, `L5-06`, and `L5-07` remain `WAITING`.
- Status transition: `L5-03` -> `DONE`; `L5-04` -> `READY`.

### October 1, 2026: L5-04 implementation and deployment checkpoint

- Task: `L5-04` — Single-Image Instagram Publishing.
- Outcome: implementation completed and deployed successfully; task moved to `MANUAL` pending the required real GIGnovate Instagram image publish verification.
- Files changed:
  - `app/api/platform-versions/[id]/publish/route.js`
  - `app/api/platform-versions/[id]/publish-attempts/route.js`
  - `components/instagram-platform-editor.js`
  - `components/instagram-publish-controls.js`
  - `lib/instagram-publish-logic.js`
  - `lib/instagram-publisher.js`
  - `lib/instagram-publishing.js`
  - `tests/instagram-publish-logic.test.js`
  - `docs/LEVEL_5_INSTAGRAM.md`
- Implementation decisions:
  - the existing platform-version publish and Publish History routes now dispatch by saved platform, preserving the existing Facebook publisher while adding Instagram through a separate provider/service path
  - L5-04 supports exactly one Instagram feed image; carousel and Reel/video publishing remain deferred to `L5-05` and `L5-06`
  - Instagram single-image publishing validates JPEG format, 8 MB maximum size, 4:5 through 1.91:1 aspect ratio, caption length, Healthy Account state, publish capability, destination/client ownership, and the exact saved platform-version revision before provider submission
  - private S3 remains private; Instagram receives a short-lived signed GET URL generated from the existing private-media access helper and no signed URL is persisted
  - publishing uses the Instagram container flow: create media container, persist the container identity, check readiness, publish the recorded container, then persist the exact provider media ID and permalink when available
  - unfinished container processing is persisted as `processing` and can be resumed through `Check Instagram Status` without creating a replacement container
  - the deterministic submission key is provider-specific (`instagram:<platformVersionId>:revision:<revision>`), so successful/current in-flight/uncertain revisions cannot be blindly resubmitted
  - definitive provider rejection before a remote container is recorded clears the submission key and permits a deliberate retry; ambiguous network/provider outcomes remain `unknown` and locked for review
  - successful revisions preserve `Published`, Publish History, provider media ID, permalink, and `View Post` after refresh/reopen; if the media ID is known before the permalink becomes readable, `Refresh Post Link` can retrieve the permalink without republishing
  - the Instagram editor now exposes real Publish Now controls while retaining L5-03 caption/media customization, Master-change handling, validation, and preview behavior
  - automatic PNG-to-JPEG conversion was not added in L5-04; the original asset is preserved and the UI clearly blocks incompatible files. The L5-03 test asset `first-post-gram.png` therefore needs a JPEG counterpart for the live publish checkpoint.
- Checks and tests run:
  - `node --experimental-default-type=module --test tests/instagram-publish-logic.test.js`: **9 passed, 0 failed**
  - `node --check lib/instagram-publish-logic.js`: **passed**
  - `node --check lib/instagram-publisher.js`: **passed**
  - `node --check lib/instagram-publishing.js`: **passed**
  - `node --check app/api/platform-versions/[id]/publish/route.js`: **passed**
  - `node --check app/api/platform-versions/[id]/publish-attempts/route.js`: **passed**
  - repository clone/lint/build remained unavailable in the local execution container because `github.com` DNS resolution is blocked
  - production Amplify job `113` for implementation commit `fb5f706481e94184e3bff40a106d02bc5428eea4` (`Implement L5-04 Instagram single-image publishing`): **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
- Live-test status: **required / not yet completed**. No real Instagram post was submitted automatically by the implementation agent.
- Required live/manual checkpoint using `Nicholas_Egner` and `@nicholasegner`:
  1. open the existing Instagram Master Content or create a clean one under `Nicholas_Egner`
  2. attach/select exactly one JPEG image that is 8 MB or smaller and within the 4:5 through 1.91:1 aspect-ratio range; the existing PNG test image is intentionally blocked
  3. save the Instagram version and confirm Publish Now is enabled only for that compatible single-image saved revision
  4. click Publish Now and review the exact confirmation showing destination, caption, and image filename before approving the real provider submission
  5. if Instagram leaves the media container processing, use `Check Instagram Status`; do not create a second publish attempt
  6. confirm the attempt reaches `Succeeded`, Publish History persists, and `View Post` opens the exact live Instagram result
  7. refresh/reopen the Master Content and confirm the same revision remains locked as `Published`
  8. confirm the successful revision cannot be submitted a second time and no duplicate Instagram post is created
  9. confirm the existing Facebook destination/version remains unaffected
- Blockers/manual actions: the real GIGnovate Instagram image post and persisted-result verification above.
- Remaining work: do not begin `L5-05` until this real single-image result, exact `View Post`, refresh/reopen Published lock, and duplicate barrier are verified and recorded.
- Status transition: `L5-04` -> `MANUAL`; `L5-05`, `L5-06`, and `L5-07` remain `WAITING`.

### October 1, 2026: L5-04 live single-image publishing closed

- Task: `L5-04` — Single-Image Instagram Publishing.
- Outcome: `DONE`. Nicholas explicitly closed the task after the first real production Instagram single-image publish completed successfully for `@nicholasegner`.
- Live verification evidence:
  - the saved Instagram version was revision `9`, inherited from Master, with green validation and exactly one selected JPEG: `first-post-gram.jpg`
  - the editor detected `Single image`, displayed the expected preview/caption, and enabled Publish Now only after the JPEG-compatible saved revision was ready
  - the final browser confirmation displayed the exact destination `@nicholasegner`, the exact caption, and image filename `first-post-gram.jpg` before the real provider submission was approved
  - after submission, Content Social Hub reported `Published live to @nicholasegner`, changed the action to the locked `Published` state, and exposed `View Post`
  - Publish History recorded `Succeeded`, `Revision 9`, `single_image`, with the production completion timestamp
  - `View Post` opened the exact live Instagram post and showed the same image and caption on the real `nicholasegner` account
  - no second publish submission was made during the checkpoint; the successful revision was visibly locked against another Publish Now action
  - Nicholas then explicitly declared `L5-04 DONE`, closing the live checkpoint on the successful provider result, exact post link, durable recorded attempt, and duplicate-protection behavior
- Automated/deployment evidence remains:
  - focused Instagram publish logic tests: **9 passed, 0 failed**
  - syntax checks for the Instagram publish logic/provider/service and provider-aware API routes: **passed**
  - Amplify production job `113` for implementation commit `fb5f706481e94184e3bff40a106d02bc5428eea4`: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
  - Amplify production job `114` for documentation checkpoint commit `5c6e3a23090b7e704e580fe7c6381d1976ec04d2`: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
- Files changed for task closure:
  - `docs/LEVEL_5_INSTAGRAM.md`
- Decisions:
  - L5-04 is closed on the combined automated, deployed, and real production single-image publish evidence above
  - carousel publishing remains a separate provider flow and is now the next bounded task
  - no L5-05 implementation was started in this chat
- Blockers/manual actions: none remain for L5-04.
- Remaining work: `L5-05` is now the sole `READY` task. `L5-06` and `L5-07` remain `WAITING`.
- Status transition: `L5-04` -> `DONE`; `L5-05` -> `READY`.

### October 1, 2026: L5-05 carousel publishing implemented and live-verified

- Task: `L5-05` — Instagram Carousel Publishing.
- Outcome: `DONE`. The deployed carousel path was verified with a real multi-image post on `@nicholasegner` and the saved Content Social Hub attempt reached `Succeeded`.
- Files changed across implementation, UI cleanup, live safeguard, and closure:
  - `app/api/platform-versions/[id]/publish/route.js`
  - `components/instagram-platform-editor.js`
  - `components/instagram-publish-controls.js`
  - `lib/instagram-carousel-publish-logic.js`
  - `lib/instagram-carousel-publish-state.js`
  - `lib/instagram-carousel-publishing.js`
  - `lib/instagram-publisher.js`
  - `tests/instagram-carousel-publish-logic.test.js`
  - `docs/LEVEL_5_INSTAGRAM.md`
- Implementation decisions:
  - preserved the saved Instagram platform-version `mediaIds` order when resolving carousel children and presenting the final confirmation
  - added 2–10 item carousel validation with JPEG image constraints plus supported MP4/MOV video-child constraints; standalone Reel/video publishing remains deferred to `L5-06`
  - private S3 remains private; each child receives a short-lived provider-accessible media URL without persisting the signed URL
  - carousel publishing creates ordered child containers, waits/checks their readiness, creates one `CAROUSEL` parent container, and publishes exactly that recorded parent
  - child and parent preparation states are persisted so `Check Instagram Status` resumes the same attempt instead of creating replacement children or a second parent
  - the final parent publish uses an atomic claim so overlapping status checks cannot both invoke Instagram `media_publish`
  - preparation failures before the final parent publish remain retry-safe; once final parent publish acceptance becomes uncertain, the attempt is locked rather than blindly retried
  - successful carousel results use the same exact provider media ID/permalink, Publish History, Published lock, and `View Post` behavior proven in L5-04
  - during live testing, the processing UI exposed the previous successful revision's `View Post` fallback while the carousel was still processing; commit `696fcaad3a04200b047bb3114200a049ad79a3d5` now renders the top-level `View Post` only when the current revision is actually in Published state
- Checks/tests and deployment evidence:
  - combined existing single-image + new carousel publish-logic tests: **17 passed, 0 failed**
  - syntax checks for the new carousel provider/orchestration modules and provider-aware publish route: **passed**
  - Amplify production job `116` for implementation commit `a11d61e0d8168f29df9d15070f6cc5cace7ce1a0`: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
  - Amplify production job `117` for editor-copy cleanup commit `66d9a89560406ac40127e892499e7ba4e4027e1c`: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
  - Amplify production job `118` for stale-link safeguard commit `696fcaad3a04200b047bb3114200a049ad79a3d5`: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
- Live verification evidence:
  - the saved Instagram version showed `Detected Instagram format: Carousel` with the intended multiple JPEG assets selected
  - after real submission, the application correctly retained one recorded carousel attempt while Instagram processed the provider containers; the UI directed Nicholas to `Check Instagram Status` instead of resubmitting
  - status refresh advanced the recorded carousel attempt to `Succeeded`, changed the current revision to the locked Published state, and exposed `View Post`
  - `View Post` opened the exact real `@nicholasegner` Instagram result, and the live Instagram UI showed the multi-image/carousel affordance with the expected post caption
  - no second carousel submission was made during processing or after success
- Live-test status: **completed**. The real carousel, exact post link, persisted success state, and duplicate-safe resume behavior were verified in production.
- Blockers/manual actions: none remain for L5-05.
- Remaining work: `L5-06` is now the sole `READY` task. `L5-07` remains `WAITING`.
- Status transition: `L5-05` -> `DONE`; `L5-06` -> `READY`.

### October 1, 2026: L5-06 implementation and deployment checkpoint

- Task: `L5-06` — Instagram Reels / Video Publishing.
- Outcome: implementation completed and deployed successfully; task moved to `MANUAL` pending the required real `@nicholasegner` Reel publish and persisted-result verification.
- Provider constraints reviewed at implementation time from Meta's maintained Instagram API references:
  - Reel container must use MOV or MP4
  - supported video codecs are H.264 or HEVC
  - audio must use AAC at 48 kHz
  - frame rate must be 23–60 FPS
  - maximum horizontal resolution is 1920 pixels
  - maximum video bitrate is 25 Mbps and maximum audio bitrate is 128 kbps
  - duration must be 3 seconds through 15 minutes
  - file size must be 1 GB or smaller
- Files changed:
  - `app/api/platform-versions/[id]/publish/route.js`
  - `components/instagram-publish-controls.js`
  - `lib/instagram-carousel-publish-logic.js`
  - `lib/instagram-publisher.js`
  - `lib/instagram-reel-publish-logic.js`
  - `lib/instagram-reel-publishing.js`
  - `tests/instagram-carousel-publish-logic.test.js`
  - `tests/instagram-reel-publish-logic.test.js`
  - `docs/LEVEL_5_INSTAGRAM.md`
- Implementation decisions:
  - one selected saved Instagram video now routes to a dedicated Reel publisher while single-image and carousel behavior remain on their existing proven paths
  - Reel publishing creates a `REELS` container from a short-lived signed URL for the existing private S3 object; the media bucket remains private and the signed URL is not persisted
  - the durable publish attempt records `publishMode: "reel"`, exact destination/revision identity, provider container ID, provider stage, and provider status before polling begins
  - provider status checks always resume the recorded Reel container; processing does not create a replacement container or a second attempt
  - the final `media_publish` call uses an atomic claim from the recorded processing attempt so overlapping status checks cannot both publish the same Reel container
  - a definitive provider/container failure before final acceptance is retry-safe and clears the deterministic submission key; ambiguous container creation or final publish outcomes remain locked for review to prevent duplicates
  - successful Reels persist the provider media ID, permalink, Published state, Published revision, Publish History, and exact `View Post` behavior
  - existing browser upload metadata provides file type, size, duration, and dimensions but not codec, audio codec/sample rate, frame rate, or bitrates. The app therefore blocks constraints it can prove locally and clearly surfaces the remaining Meta requirements; Meta's recorded container-processing result remains authoritative for those technical properties rather than adding a large media-analysis dependency in L5-06
  - the Instagram publish confirmation now identifies a Reel and the exact video filename, while processing copy directs the operator to `Check Instagram Status` instead of resubmitting
  - no Instagram scheduling, Calendar, approvals, analytics, or L5-07 work was added
- Checks/tests and deployment evidence:
  - `node --experimental-default-type=module --test /tmp/l506/tests/instagram-reel-publish-logic.test.js`: **9 passed, 0 failed**
  - focused Reel logic syntax validation: **passed**
  - a full local repository clone/lint/build remains unavailable because the execution container cannot resolve `github.com`
  - Amplify production job `125` for commit `a5ff50056514e0cc6a2a22f3c78cea1643575d1a`: **BUILD SUCCEED, DEPLOY SUCCEED, VERIFY SUCCEED**
- Live-test status: **required / not yet completed**. No real Reel was submitted automatically by the implementation agent.
- Required live/manual checkpoint using `Nicholas_Egner` and the existing Healthy `@nicholasegner` destination:
  1. open or create Master Content under `Nicholas_Egner` with exactly one suitable MP4 or MOV video selected for Instagram; use a file 1 GB or smaller, 3 seconds–15 minutes, and no more than 1920 horizontal pixels; preferably use a normal 9:16 H.264/HEVC + AAC 48 kHz file at 23–60 FPS
  2. save the Instagram version and confirm the editor detects `Reel`, shows no blocking validation issues, and enables Publish Now only for the saved revision
  3. click Publish Now and confirm the browser dialog names `@nicholasegner`, the exact caption, and the exact video filename before approving the real provider submission
  4. if Instagram reports processing, use `Check Instagram Status`; do not click Publish Now again and confirm Publish History continues the same recorded `reel` attempt/container
  5. continue checking the same attempt until it reaches `Succeeded` or a terminal provider failure; a processing state must never create a second Reel container
  6. on success, confirm the revision becomes locked `Published`, Publish History shows `Succeeded` / `reel`, and `View Post` opens the exact live Reel on `@nicholasegner`
  7. refresh/reopen the Master Content and confirm the same revision remains Published, the permalink persists, and Publish Now cannot submit the same revision again
  8. confirm exactly one Reel was created and the existing Facebook destination plus prior Instagram image/carousel results remain unaffected
- Blockers/manual actions: the real production Reel publish / processing / exact-result checkpoint above.
- Remaining work: do not begin `L5-07`. After the real Reel reaches a proven terminal result with exact `View Post`, persisted history, and duplicate-safe behavior, move `L5-06` to `DONE` and make `L5-07` the sole `READY` task.
- Status transition: `L5-06` -> `MANUAL`; `L5-07` remains `WAITING`.


### October 1, 2026: L5-06 Master thumbnail Reel-cover addition

- Task: `L5-06` — Instagram Reels / Video Publishing.
- Outcome: implementation extension completed; task remains `MANUAL` pending the same real production Reel publish checkpoint.
- Requested behavior:
  - when Master Content has a saved video thumbnail, Instagram Reel publishing uses that image as the Reel cover instead of requiring a second Instagram-specific upload
  - if no Master thumbnail is available, Instagram falls back to its normal video-frame cover behavior
- Files changed:
  - `lib/platform-version-logic.js`
  - `lib/platform-versions.js`
  - `lib/instagram-publisher.js`
  - `lib/instagram-reel-publish-logic.js`
  - `lib/instagram-reel-publishing.js`
  - `components/instagram-platform-editor.js`
  - `tests/instagram-platform-version-logic.test.js`
  - `tests/instagram-reel-publish-logic.test.js`
  - `docs/LEVEL_5_INSTAGRAM.md`
- Implementation decisions:
  - new/reset Instagram versions inherit `defaultVideoThumbnailMediaId` from the exact Master revision and persist it with the Instagram version
  - older Instagram Reel versions created before this addition may fall back to the current Master thumbnail only when `masterRevisionSynced` still matches the current Master revision; an out-of-sync Instagram version will not silently pick up a newer Master thumbnail
  - the Reel publish attempt records the cover media identity/object key before provider processing, preserving the exact cover used by that revision
  - private S3 remains private; the provider receives only a short-lived signed cover URL as Meta's `cover_url`
  - Master thumbnails that are PNG, WebP, AVIF, oversize JPEG, or otherwise need provider normalization reuse the existing private Instagram JPEG-derivative pipeline before the cover URL is generated
  - the Instagram editor now shows the inherited Master thumbnail and filename when the saved media mode is Reel so the operator can verify the cover before publishing
  - no L5-07 scheduling work was started
- Verification:
  - Amplify production jobs `127` (thumbnail inheritance) and `128` (Reel-cover UI) completed successfully
  - final provider-cover normalization commit `2b041a5aefa47d515ea9234eef85460874daed07` entered Amplify job `129`; final build/deploy status is recorded in the implementation handoff when available
- Live-test status: unchanged — the real `@nicholasegner` Reel has not yet been submitted. During the L5-06 live checkpoint, confirm the displayed Master thumbnail is the cover on the exact published Reel.
- Remaining work: complete the existing L5-06 Reel publish/status/permalink/duplicate-safety checkpoint. Only after that evidence may L5-06 become `DONE` and L5-07 become `READY`.

Future implementation agents must append a dated progress entry containing task ID, outcome, files changed, checks/tests run, test results, live-test status, decisions, blockers/manual steps, and remaining work. Update only the selected task's status when supported by evidence. Do not declare the Instagram adapter or Level 5 complete without Work review.