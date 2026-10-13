# Level 5 — LinkedIn

Active phase for Content Social Hub as of October 12, 2026. Nicholas approved moving LinkedIn ahead of YouTube while Google Business Profile API approval is pending. Product source of truth: `README.md`. Google application evidence: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`.

## Phase state

- Status: **OPEN — personal OAuth code prepared; deployment and live verification pending**
- Active task: **L5-LI-02 (`MANUAL` — deployment and live account verification pending)**
- Personal test destination: Nicholas Egner personal profile (`https://www.linkedin.com/in/nicholas-egner`) under Content Social Hub client `Nicholas_Egner`; initial organization Page: `https://www.linkedin.com/company/nicholas-egner-digital-marketing` (association verified in developer app, API publishing approval still unavailable)
- Developer app created and associated with Nicholas Egner Company Page; Share on LinkedIn Default Tier provisioned; `w_member_social` verified; callback registered. Community Management API Development Tier access request button disabled; organization publishing unapproved, reason not confirmed.
- LinkedIn integration: **personal OAuth code prepared on implementation branch; not deployed or live verified**
- Google `L5-GBP-01`: **MANUAL**, pending approval (case `1-5407000042073`, project number `503771980348`).

## Architecture and boundaries

Reuse client-scoped social connections, encrypted credentials, independent destination versions, private S3, durable publish attempts, revision/duplicate safety, exact remote post URLs, and EventBridge/Lambda scheduling already proven for Facebook and Instagram. Member posting and organization Page management have distinct permissions and possible approval requirements. Verify current official LinkedIn developer documentation and actual entitlements before coding. Do not assume that one LinkedIn OAuth grant covers both. No analytics, Level 6 workflow, or unrelated provider work in this phase.

## Ordered task queue

| ID | Status | Task | Acceptance checkpoint |
| --- | --- | --- | --- |
| L5-LI-01 | `DONE` | LinkedIn developer access readiness | Verify app requirements, personal sharing and organization API permission/review paths, intended scopes/callback, exact test identity, and non-secret prerequisites or named external blockers |
| L5-LI-02 | `MANUAL` | Personal profile OAuth and Account Health | Readiness accepted; encrypted client-scoped credentials, renewal and health checked |
| L5-LI-03 | `BLOCKED` | Company Page connection | Appropriate permissions approved, exact Page selected and health verified |
| L5-LI-04 | `WAITING` | Destination version, validation, preview | Independent platform version and Master protections |
| L5-LI-05 | `WAITING` | Supported text/link/image publishing | Durable exact provider results, retry and duplicate safety |
| L5-LI-06 | `WAITING` | Additional supported media | Verify current media modes/permissions before implementation |
| L5-LI-07 | `WAITING` | Background scheduling | Existing worker, safe cancellation, stale revision, browser-closed proof and re-entry |
| L5-LI-08 | `WAITING` | Final live integration review | Accepted real-account evidence, regression review and handoff |

L5-LI-02 awaits the external configuration, deployment, and live verification checkpoint; no later task is READY. Company Page connection is BLOCKED until appropriate API access is granted. Later tasks must have provider-verified acceptance criteria expanded before they are activated. Nicholas reviews any provider-level phase closure.

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


### October 12, 2026: L5-LI-01 accepted; personal OAuth selected next

- Task: **L5-LI-01 DONE** based on Nicholas's live LinkedIn developer dashboard screenshots and explicit decision to proceed; **L5-LI-02 READY** for implementation in the next bounded task.
- Evidence: LinkedIn standalone application **Content Social Hub** created October 12, 2026, associated with the Nicholas Egner business LinkedIn Company Page. **Share on LinkedIn** shows Added products / Default Tier and successful provisioning confirmation. Auth tab shows `w_member_social`, OAuth access token TTL **5,184,000 seconds / two months**, and the exact saved callback URL `https://main.d1yfjibipwjpld.amplifyapp.com/api/connections/linkedin/callback`.
- Personal OAuth test target: `https://www.linkedin.com/in/nicholas-egner`, linked to client `Nicholas_Egner`. Real OAuth connection and Account Health are **not yet tested**.
- Organization access evidence: Community Management API shown at **Development Tier**, with **Request access** disabled. This is **not evidence of approval**; cause remains unknown. **L5-LI-03 BLOCKED** until eligibility and permissions are established, without blocking personal OAuth work.
- Locked L5-LI-02 objective: client-scoped personal OAuth, server-side encrypted credentials, expiry-aware Account Health, secure reconnect/credential replacement, and direct + Request Connection behavior consistent with proven architecture where feasible. Do not infer refresh-token eligibility. Planned environment-variable names: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`; reuse `APP_BASE_URL` and existing `OAUTH_TOKEN_ENCRYPTION_KEY`. Do not store credential values in GitHub.
- Deferred: MDP/refresh-token approval and automated token renewal. No permanent-token claim. User selected continued implementation now.
- Files: this phase document, README and AGENTS handoff pointers. Docs only; no code changes, test/lint/build, OAuth connection, API post, or scheduled live post during readiness.
- Manual next checkpoint: configure LinkedIn client credentials privately in Amplify when OAuth code is implemented, redeploy, and verify consent, saved connection, Account Health, and safe reconnection with the exact personal account. Verify the public privacy policy URL in production.

### October 12, 2026: L5-LI-02 implementation branch, manual checkpoint pending

- Task: **L5-LI-02**; code implemented on `feat/l5-li-02-personal-oauth`, status **MANUAL** pending required validation and live test. No company Page or post publishing implemented.
- Added LinkedIn personal OAuth start/callback with one-time hashed OAuth state tied to the selected client, operator session or active 48-hour Request Connection link, exact redirect URI and OpenID Connect profile lookup. The member `sub` is the provider account identity; users confirm the exact member and client before saving.
- Tokens are AES-256-GCM encrypted using existing `OAUTH_TOKEN_ENCRYPTION_KEY`; the client/platform/member identity is upserted so reauthorization replaces credentials in the same connection and preserves connected-destination references, drafts, schedules and history.
- Token expiration is recorded and checked on every Account Health call, with live LinkedIn token introspection used to verify active state, expiry and granted scopes; expired/expiring/permission-failure states guide reconnection. No automatic LinkedIn token refresh is assumed. Provider errors never expose tokens in the UI.
- Reconnect now binds the expected LinkedIn member ID to a one-time OAuth state and rejects an attempt to reauthorize a different member. Reused the existing secure Request Connection email and limited-purpose setup page for LinkedIn. Social Accounts shows LinkedIn direct Connect, Request Connection, Account Health, token expiry and Reconnect. Facebook and Instagram remain independently scoped.
- New files: `lib/linkedin.js`, `lib/linkedin-connection-logic.js`, `app/api/connections/linkedin/{start,callback,confirm}/route.js`, `app/connect/linkedin/{confirm,error}/page.js`, `components/linkedin-account-confirm.js`, `tests/linkedin-connection-logic.test.js`.
- Updated: `lib/connections.js`, `lib/connection-request-logic.js`, `lib/email.js`, `components/connections-manager.js`, `app/connect/[token]/page.js`, `app/(app)/connections/page.js`, `.env.example`, and this phase record.
- Verification: code inspected on GitHub; focused LinkedIn health tests authored, **not executed**. Full `npm test`, `npm run lint`, and `npm run build` remain **not executed**, because the execution container cannot reach GitHub to check out the repository. Do not treat authored tests or source review as passing checks.
- Required manual steps: in the LinkedIn developer app add/provision **Sign In with LinkedIn using OpenID Connect** to obtain `openid` and `profile` in addition to existing `w_member_social`. Keep the registered production callback. Add `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` privately to Amplify environment configuration, not to GitHub. Run Node 24.19.0 checks on a checked-out branch, review failures, then merge/deploy only after checks pass.
- Required production live proof: select `Nicholas_Egner`; consent to personal member OAuth; confirm exact Nicholas Egner member; verify one encrypted client-scoped destination and Healthy Account Health; switch clients and check isolation; separately verify secure emailed connection flow and one-time request invalidation; reconnect that same member and confirm the destination ID/history stays intact and expiry is replaced; verify that expired grants are blocked and display a reconnect action. No live OAuth, database, email, reconnect, or expired-token behavior has been verified yet.
- Blockers: external OpenID Connect product availability and private Amplify credential configuration; tests/deployment/live validation outstanding. LinkedIn Company Page `L5-LI-03` remains BLOCKED by Community Management API approval; Google approval still pending. **Do not mark L5-LI-02 DONE or activate another task until evidence is recorded.**

### October 13, 2026: Reconnect live-test diagnostic follow-up

- Task: **L5-LI-02**, status remains **MANUAL**.
- Live evidence: Nicholas successfully consented to LinkedIn personal OAuth, confirmed the correct member for `Nicholas_Egner`, and saw the saved account marked Healthy with token expiry December 12, 2026. The subsequent Reconnect test failed and redirected to `/connect/linkedin/error?reason=provider`.
- CloudWatch Logs Insights at 2026-10-13 06:44:12 CDT reported `LinkedIn OAuth callback failed { name: 'LinkedInApiError', code: null }`. This establishes a provider API error but not which provider operation or HTTP status. A separate Mongo TLS/selection error was observed but is **not confirmed** to be part of this OAuth failure.
- Fix prepared: add safe `operation`, `status`, and allowlisted `code` fields in callback logs; identify token exchange, introspection, and profile requests without logging credentials, access tokens, or authorization codes. Differentiate authorization denial, provider failure, and storage failure in the error page. Existing connection is not replaced on a failed reconnect.
- Files changed: `lib/linkedin.js`, `app/api/connections/linkedin/callback/route.js`, `app/connect/linkedin/error/page.js`, this phase document.
- Automated checks: not executed in this environment. Pending build/lint/unit tests and real Reconnect retest after deployment. No LinkedIn publication, company Page access, or unrelated roadmap work attempted.
- Next verification: wait for Amplify deployment, retry Reconnect with the same personal profile, inspect the newly logged operation/status if it still fails, verify the existing connection ID and Account Health, then document the outcome before marking L5-LI-02 DONE.
