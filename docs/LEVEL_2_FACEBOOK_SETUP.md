# Level 2 Facebook Pages Connection Setup

Level 2 adds the first real social-account adapter. It supports:

- owner-initiated Facebook authorization
- emailed client connection requests
- single-use setup links that expire after 48 hours
- explicit Facebook Page selection
- encrypted Page access-token storage
- initial Account Health checks

No Facebook password is collected or stored by Content Social Hub.

## Phase progress log

- Phase status: **IN PROGRESS**
- Last verified checkpoint: **September 28, 2026**
- Next implementation rule: select the first task marked `READY`, complete only that task, record the evidence here, and return the README handoff report
- Level 2 is not complete until Work reviews the remaining live-test evidence and updates the README

### Task queue

| ID | Status | Task | Evidence or dependency |
| --- | --- | --- | --- |
| L2-01 | `DONE` | Deploy the first Facebook Pages OAuth adapter | Production OAuth returns successfully to Content Social Hub |
| L2-02 | `DONE` | Connect and persist real Pages under the correct clients | `Andrew_Davis -> Davis Criminal Defense`; `Let_Us_Clean -> Let Us Clean LLC` |
| L2-03 | `DONE` | Verify Account Health and client-scoped Social Accounts state | Both saved connections returned `Healthy`; switching clients showed only that client's Page |
| L2-04 | `MANUAL` | Correct the selected-Page capability lookup | Code and automated coverage completed September 28; production live verification is required after Amplify deploy |
| L2-05 | `WAITING` | Test Request Connection through Resend and the secure client link | Begins after L2-04 is reviewed; requires a live email and private-browser test |
| L2-06 | `WAITING` | Verify request completion and replacement-link revocation | Depends on a successful L2-05 connection request |

There should be only one `READY` task. While L2-04 is `MANUAL`, do not begin L2-05 until the production Facebook live check is completed and reviewed.

### L2-04 acceptance criteria

The selected-Page lookup must stop requesting the unsupported Facebook Page `tasks` field that produced Meta error `(#100) Tried accessing nonexisting field (tasks)`.

The implementation must:

1. Preserve the deployed direct OAuth and selected-Page recovery flow.
2. Derive the selected Page's relevant permissions from the token information Meta returns, including granular target IDs where applicable.
3. Preserve publish-capability validation for `pages_manage_posts`; do not make every recovered Page publishable by default.
4. Preserve encrypted Page-token storage, correct client association, and existing Account Health behavior.
5. Add or update focused automated coverage for Page discovery, permission mapping, and health/capability evaluation.
6. Run the relevant checks and record the commands and results in a dated progress entry below.

Do not rebuild the Meta application, OAuth configuration, database model, or client-selection architecture while completing L2-04.

### Progress entries

#### September 19, 2026: direct connection verified

- Connected Davis Criminal Defense under Andrew_Davis.
- Connected Let Us Clean LLC under Let_Us_Clean.
- Confirmed both connections returned `Healthy`.
- Confirmed switching clients did not display another client's saved Page.
- Identified the remaining direct-target lookup error involving the unsupported `tasks` field.

#### September 20, 2026: task queue established

- Converted this setup guide into the active Level 2 plan and progress record.
- Marked L2-04 as the single task ready for the next implementation agent.
- Kept the emailed Request Connection tests waiting until the capability cleanup is reviewed.

#### September 28, 2026: L2-04 implemented; production verification pending

- Task: `L2-04`.
- Outcome: implementation and automated coverage completed; task moved to `MANUAL` until the deployed OAuth flow is verified against real Facebook Pages.
- Files changed:
  - `lib/facebook.js`
  - `lib/facebook-connection-logic.js`
  - `app/api/connections/facebook/callback/route.js`
  - `components/facebook-account-picker.js`
  - `tests/facebook-connection-logic.test.js`
  - `package.json`
  - `docs/LEVEL_2_FACEBOOK_SETUP.md`
- Implementation decisions:
  - stopped requesting the unsupported Page `tasks` field from both direct selected-Page lookup and `/me/accounts`
  - Page-specific permissions now come from Meta token scopes plus granular `target_ids`; `pages_manage_posts` only makes the Page publishable when it applies to that Page
  - the existing Account Health `CREATE_CONTENT` capability gate is preserved by deriving that capability from the Page-specific `pages_manage_posts` mapping rather than from Meta's unsupported Page `tasks` field
  - the Page picker explains how to use Facebook `Edit settings` when the intended client Page is missing and warns the operator to keep previously connected client Pages enabled
  - Facebook Business Integrations remains a recovery/admin path, not the normal onboarding path; normal onboarding remains Content Social Hub `Connect` / `Request Connection` -> Facebook authorization -> Page selection
  - observed that Account Health can currently label some revoked Meta Page access as `Expired`; this wording issue is documented from the Davis incident but is not part of the L2-04 capability-lookup code change
- Automated checks:
  - `npm test` -> 4 tests passed, 0 failed
  - `node --check lib/facebook.js` -> passed
  - `node --check lib/facebook-connection-logic.js` -> passed
  - `node --check app/api/connections/facebook/callback/route.js` -> passed
  - full ESLint / Next build was not run in the scratch environment because project dependencies were not installed there; the Amplify deployment build remains the integration/build checkpoint
- Live evidence collected before this code change:
  - Let Us Clean LLC remained `Healthy` while Davis Criminal Defense was reported as expired
  - Facebook Business Integrations showed only Let Us Clean LLC enabled for Content Social Hub, even though Nicholas's Facebook account still managed Davis Criminal Defense
  - after Davis Criminal Defense was re-enabled for all required Page permissions and reconnected, `Andrew_Davis -> Davis Criminal Defense` returned to `Healthy` on September 28
  - this demonstrated that the earlier Davis failure was loss of app-to-Page authorization, not proof of a normal nine-day token expiration
- Production live verification still required after deploy:
  1. reconnect / check `Andrew_Davis -> Davis Criminal Defense`
  2. reconnect / check `Let_Us_Clean -> Let Us Clean LLC`
  3. confirm both remain independently `Healthy`
  4. confirm the red `(#100) Tried accessing nonexisting field (tasks)` diagnostic no longer appears
  5. confirm the picker reports Page-specific publish permission correctly and reconnecting one Page does not remove the other from Meta's allowed Page set
- Remaining work: after L2-04 passes this live checkpoint and is reviewed, move L2-04 to `DONE` and L2-05 to `READY` for the Resend/private-browser client connection test.

Future implementation agents must append a dated entry containing the task ID, files changed, checks run, live-test status, decisions, and remaining blockers. They may update the selected task to `DONE`, `BLOCKED`, or `MANUAL`, but only Work may declare the whole level complete in the README.

## Amplify environment variables

Add these server-side variables to the Amplify application after the Phase 2 code is merged:

```text
APP_BASE_URL=https://main.d1yfjibipwjpld.amplifyapp.com

META_APP_ID=<Meta application ID>
META_APP_SECRET=<Meta application secret>
META_LOGIN_CONFIG_ID=<Facebook Login for Business configuration ID, when used>
META_GRAPH_VERSION=v26.0

OAUTH_TOKEN_ENCRYPTION_KEY=<base64 encoded 32-byte key>

RESEND_API_KEY=<Resend API key>
EMAIL_FROM=Content Social Hub <nick@nicholasegner.com>
EMAIL_REPLY_TO=nick@nicholasegner.com
```

Do not prefix these variables with `NEXT_PUBLIC_`. They must remain available only to the server runtime.

Generate the encryption key locally:

```bash
openssl rand -base64 32
```

This encryption key protects saved OAuth access tokens. Store it somewhere secure before adding it to Amplify. Losing it makes existing saved social connections unreadable and requires reconnecting those accounts.

Redeploy Amplify after adding or changing any environment variable.

## Meta application

Create a Meta developer application intended to manage business assets and add Facebook Login or Facebook Login for Business.

Use this exact production OAuth redirect URI:

```text
https://main.d1yfjibipwjpld.amplifyapp.com/api/connections/facebook/callback
```

For local development, also allow:

```text
http://localhost:3000/api/connections/facebook/callback
```

The adapter requests:

```text
pages_show_list
pages_read_engagement
pages_manage_posts
```

These permissions allow the app to list eligible Pages, verify the selected Page, evaluate connection health, and support the Facebook publishing work planned for Level 3.

During Meta development mode, only people assigned an application role can complete the test OAuth flow. Connecting client accounts outside the app's roles may require switching the Meta app to Live mode, completing the required business verification, and obtaining Advanced Access through App Review.

Set the application domain and required policy/contact URLs in the Meta app before requesting review. Do not place the Meta App Secret in browser code or in this repository.

## Resend

The existing verified `nicholasegner.com` Resend domain can be reused. Create a separate API key for Content Social Hub so access can be revoked without affecting the CRM.

Recommended sender:

```text
Content Social Hub <nick@nicholasegner.com>
```

The connection email contains a secure setup URL. Generating a replacement request revokes the previous unfinished request.

## Security behavior

- request tokens are generated with cryptographically secure randomness
- only a SHA-256 hash of each request token is stored
- request links expire after approximately 48 hours
- OAuth state values expire after approximately 10 minutes and are single-use
- unfinished account-selection links expire after approximately 20 minutes
- Page access tokens are encrypted with AES-256-GCM before MongoDB storage
- Facebook passwords are handled only by Facebook
- setup pages cannot access the owner workspace
- completed, revoked, and expired request links cannot be reused

## Checkpoint test

1. Add all required Amplify environment variables and redeploy.
2. Sign in to Content Social Hub.
3. Open **Social Accounts**.
4. Select a client.
5. Choose **Connect**.
6. Complete Facebook authorization.
7. Choose the correct Facebook Page.
8. Confirm the Page appears under Connected accounts.
9. Select **Check now** and confirm Account Health is Healthy.
10. Send a Request Connection email to a test client email.
11. Open the email link in a private browser window.
12. Confirm the setup page cannot access the owner workspace.
13. Complete the connection and confirm the request changes to Completed.
14. Generate a replacement request and confirm the older unfinished link no longer works.

Level 2 passes when a real Facebook Page is stored under the correct client and Account Health can verify the connection.
