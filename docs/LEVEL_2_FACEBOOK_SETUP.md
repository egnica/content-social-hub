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
| L2-04 | `DONE` | Correct the selected-Page capability lookup | Production live verification passed September 28; Davis and Let Us Clean both remained `Healthy` and the direct Page `tasks` error was removed |
| L2-05 | `READY` | Test Request Connection through Resend and the secure client link | Requires a real connection email, private-browser setup test, and successful client-side Facebook connection |
| L2-06 | `WAITING` | Verify request completion and replacement-link revocation | Depends on a successful L2-05 connection request |

There should be only one `READY` task. The next implementation agent should select L2-05 automatically and should not begin L2-06 until the Request Connection flow has passed its live test.

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

### L2-05 acceptance criteria

The normal client onboarding path must work without requiring the client to enter the owner workspace or manually navigate Facebook Business Integrations.

The implementation/live test must:

1. Use **Request Connection** for a client with an Approval / Report Email and send the real setup email through Resend.
2. Open the secure setup link in a private/incognito browser session and confirm it cannot access the owner workspace.
3. Complete Facebook authorization from that client-facing flow, select the intended Facebook Page, and save it under the correct client.
4. Confirm the connected Page returns `Healthy` after the client-facing connection completes.
5. Record email delivery, private-browser behavior, Facebook connection result, and any manual steps in the dated progress log.
6. Leave replacement-link revocation and completed-request reuse checks for L2-06.

Do not require the client to use Facebook Business Integrations during the normal flow. Business Integrations is a recovery/admin path only when Meta has removed or excluded a Page from the application's allowed Page set.

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
- Outcome: implementation and automated coverage completed; task moved to `MANUAL` until the deployed OAuth flow was verified against real Facebook Pages.
- Files changed:
  - `lib/facebook.js`
  - `lib/facebook-connection-logic.js`
  - `app/api/connections/facebook/callback/route.js`
  - `components/facebook-account-picker.js`
  - `tests/facebook-connection-logic.test.js`
  - `package.json`
  - `docs/LEVEL_2_FACEBOOK_SETUP.md`
- Implementation decisions:
  - stopped requesting the unsupported Page `tasks` field from the direct selected-Page lookup that Meta rejects
  - retained `/me/accounts` as the working source of Page `CREATE_CONTENT` tasks and merged those capabilities onto directly recovered Pages by Page ID
  - granular token target IDs remain part of Page discovery and permission context, while publish capability is not inferred from granular scope data alone
  - the Page picker explains how to use Facebook `Edit settings` when the intended client Page is missing and warns the operator to keep previously connected client Pages enabled
  - Facebook Business Integrations remains a recovery/admin path, not the normal onboarding path; normal onboarding remains Content Social Hub `Connect` / `Request Connection` -> Facebook authorization -> Page selection
  - observed that Account Health can label some revoked Meta Page access as `Expired`; the Davis incident showed this can represent loss of app-to-Page authorization rather than a normal short token lifetime
- Automated and deployment checks across the L2-04 implementation/correction:
  - focused Node test suite reached `6 passed, 0 failed`
  - server-side syntax checks passed for the changed Facebook modules/routes
  - Amplify job 31 passed Build / Deploy / Verify for commit `1737fbaf` (`Fix Facebook Page capability lookup`)
  - Amplify job 32 passed Build / Deploy / Verify for corrective commit `30cbbcdd` (`Restore Facebook Page publish capability`)
- Live evidence collected during diagnosis:
  - Let Us Clean LLC remained `Healthy` while Davis Criminal Defense was reported as expired
  - Facebook Business Integrations showed only Let Us Clean LLC enabled for Content Social Hub, even though Nicholas's Facebook account still managed Davis Criminal Defense
  - after Davis Criminal Defense was re-enabled for all required Page permissions and reconnected, `Andrew_Davis -> Davis Criminal Defense` returned to `Healthy`
  - this demonstrated that the earlier Davis failure was loss of app-to-Page authorization, not proof of a normal nine-day token expiration
- A first L2-04 deployment incorrectly inferred publish capability from granular token data alone and produced a false `Permission Problem` for Davis; the corrective deployment restored the working `/me/accounts` Page-task capability source while keeping the unsupported direct Page `tasks` lookup removed.

#### September 28, 2026: L2-04 production verification passed

- Task: `L2-04`.
- Outcome: `DONE`.
- Live verification:
  - `Andrew_Davis -> Davis Criminal Defense` reconnected successfully and returned `Healthy` at approximately 12:52 PM local time
  - `Let_Us_Clean -> Let Us Clean LLC` returned `Healthy` at approximately 12:52 PM local time after the Davis reconnect
  - reconnecting Davis did not break the Let Us Clean saved connection
  - the unsupported direct selected-Page `tasks` lookup error no longer blocked the flow
  - the corrected deployment preserved the real Facebook Page publish capability instead of producing the false `Permission Problem`
- Decisions:
  - keep the normal client workflow inside Content Social Hub -> Facebook authorization -> Page selection
  - keep Facebook Business Integrations as troubleshooting/recovery only
  - when an operator authorizes additional Pages under one Facebook login, previously connected client Pages should remain enabled so Meta does not remove the app's access to them
- Blockers/manual steps: none remain for L2-04.
- Remaining work: `L2-05` is now the single `READY` task. Test the real Resend Request Connection email and secure client-facing setup flow in a private browser. `L2-06` remains `WAITING`.

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
