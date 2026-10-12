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
