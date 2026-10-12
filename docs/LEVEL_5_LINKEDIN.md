# Level 5 — LinkedIn

Active phase for Content Social Hub as of October 12, 2026. Nicholas approved moving LinkedIn ahead of YouTube while Google Business Profile API approval is pending. Product source of truth: `README.md`. Google application evidence: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`.

## Phase state

- Status: **OPEN — access readiness**
- Active task: **L5-LI-01 (`READY`)**
- Personal LinkedIn profile and Company Page initial test destinations: **unconfirmed**
- Developer app, LinkedIn API products, OAuth scopes, Company Page review/access: **unverified**
- LinkedIn integration: **not implemented**
- Google `L5-GBP-01`: **MANUAL**, pending approval (case `1-5407000042073`, project number `503771980348`).

## Architecture and boundaries

Reuse client-scoped social connections, encrypted credentials, independent destination versions, private S3, durable publish attempts, revision/duplicate safety, exact remote post URLs, and EventBridge/Lambda scheduling already proven for Facebook and Instagram. Member posting and organization Page management have distinct permissions and possible approval requirements. Verify current official LinkedIn developer documentation and actual entitlements before coding. Do not assume that one LinkedIn OAuth grant covers both. No analytics, Level 6 workflow, or unrelated provider work in this phase.

## Ordered task queue

| ID | Status | Task | Acceptance checkpoint |
| --- | --- | --- | --- |
| L5-LI-01 | `READY` | LinkedIn developer access readiness | Verify app requirements, personal sharing and organization API permission/review paths, intended scopes/callback, exact test identity, and non-secret prerequisites or named external blockers |
| L5-LI-02 | `WAITING` | Personal profile OAuth and Account Health | Readiness accepted; encrypted client-scoped credentials, renewal and health checked |
| L5-LI-03 | `WAITING` | Company Page connection | Appropriate permissions approved, exact Page selected and health verified |
| L5-LI-04 | `WAITING` | Destination version, validation, preview | Independent platform version and Master protections |
| L5-LI-05 | `WAITING` | Supported text/link/image publishing | Durable exact provider results, retry and duplicate safety |
| L5-LI-06 | `WAITING` | Additional supported media | Verify current media modes/permissions before implementation |
| L5-LI-07 | `WAITING` | Background scheduling | Existing worker, safe cancellation, stale revision, browser-closed proof and re-entry |
| L5-LI-08 | `WAITING` | Final live integration review | Accepted real-account evidence, regression review and handoff |

Only L5-LI-01 is READY. Later tasks must have provider-verified acceptance criteria expanded before they are activated. Nicholas reviews any provider-level phase closure.

## L5-LI-01 — Developer Access Readiness

Investigate LinkedIn's current API products and approval tiers for member and organization posting, establish app ownership/association requirements, permitted OAuth scopes and redirect plan, select an eligible real test destination, and document required non-secret environment-variable names. If a review or account setup is needed, stop at a MANUAL/BLOCKED checkpoint with exact action. This task excludes OAuth code, API posting, credential collection, and live publication.

## Progress

### October 12, 2026: LinkedIn prioritized while Google approval is pending

- Task: **L5-LI-01**; status **READY**.
- Decision: Nicholas explicitly approved documentation updates and push to `main`. LinkedIn moves ahead of YouTube, with Google paused but not abandoned.
- Files: `README.md`, `AGENTS.md`, `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`, new `docs/LEVEL_5_LINKEDIN.md`. No application code edited.
- Verification: checked documentation handoff pointers and task queue. No application tests/build/live tests run for this documentation-only change.
- Live status: no LinkedIn developer approval, OAuth connection, API post or scheduled publication verified.
- Blockers: need developer app access, exact personal/organization test destination, and permissions confirmation. Next task L5-LI-02 only after readiness acceptance.


### October 12, 2026: Public privacy-policy prerequisite added

- Task: **L5-LI-01**; remains **READY** while developer-app registration and platform product access are unverified.
- Published source: `app/privacy-policy/page.jsx` and `app/privacy-policy/page.module.css` added to the Content Social Hub repository, to be served publicly at `https://main.d1yfjibipwjpld.amplifyapp.com/privacy-policy` following Amplify deployment. This route deliberately does not require an owner session.
- Correction: previously added portfolio-site policy and footer link were removed from `egnica/new-nicholasegner.com`; policy now belongs solely to Content Social Hub.
- Checks: GitHub file writes confirmed. No local test, lint, or build run; public deployment/live HTTP availability is unverified.
- Manual: review policy wording for accuracy and confirm the URL loads publicly before entering it in the LinkedIn developer app. Finish developer app/Page association and inspect API products.
- No LinkedIn OAuth implementation, authorization, or publishing has occurred. L5-LI-02 remains WAITING.


### October 12, 2026: LinkedIn token-renewal decision

- Task: **L5-LI-01**; developer app created and Share on LinkedIn Default Tier provisioned. Personal posting OAuth callback and scopes still require final verification.
- Decision: Nicholas chose to continue the build without applying for LinkedIn Marketing Developer Platform expanded approval now.
- Credential design requirement for **L5-LI-02**: treat member access tokens as expiring (LinkedIn dashboard lists two months); support secure account reauthorization and replacement of encrypted credentials without losing client-scoped connection identity, drafts, schedules, or historical publish records. Surface expiry and reconnect requirements rather than silently attempting expired scheduled publishes.
- Deferred enhancement: investigate MDP / programmatic refresh-token approval and implement automatic renewal if eligible. Do not assume access to refresh tokens today, or promise permanent tokens.
- No LinkedIn secrets recorded here. OAuth code, provider publication, automatic token refresh, and Company Page approval remain unverified.
