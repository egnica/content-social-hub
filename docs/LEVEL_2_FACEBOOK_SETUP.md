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

- Phase status: **COMPLETE — reviewed and closed September 28, 2026**
- Last verified checkpoint: **September 28, 2026**
- All planned Level 2 tasks are `DONE` and the documented live acceptance evidence has been reviewed
- No Level 3 task is `READY` yet; Level 3 must be planned and explicitly opened before implementation begins

### Task queue

| ID | Status | Task | Evidence or dependency |
| --- | --- | --- | --- |
| L2-01 | `DONE` | Deploy the first Facebook Pages OAuth adapter | Production OAuth returns successfully to Content Social Hub |
| L2-02 | `DONE` | Connect and persist real Pages under the correct clients | `Andrew_Davis -> Davis Criminal Defense`; `Let_Us_Clean -> Let Us Clean LLC` |
| L2-03 | `DONE` | Verify Account Health and client-scoped Social Accounts state | Both saved connections returned `Healthy`; switching clients showed only that client's Page |
| L2-04 | `DONE` | Correct the selected-Page capability lookup | Production live verification passed September 28; Davis and Let Us Clean both remained `Healthy` and the direct Page `tasks` error was removed |
| L2-05 | `DONE` | Test Request Connection through Resend and the secure client link | Live Request Connection test passed September 28 with `Nicholas_Egner -> GIGnovate`; Resend delivery, private-browser isolation, client-side Facebook authorization, and `Healthy` completion were verified |
| L2-06 | `DONE` | Verify request completion and replacement-link revocation | Completed-link reuse was blocked; replacement request revoked the older unfinished link; newest replacement link remained usable |

All planned Level 2 implementation tasks are `DONE`. This document is now the durable completion record for Level 2. The next product-management action is to plan Level 3 — First Publisher — in a new active phase document before marking any Level 3 task `READY`.

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

### L2-06 acceptance criteria

The secure Request Connection token lifecycle must prevent an old setup link from remaining usable after completion or replacement.

The live test must:

1. Reopen the setup link from the completed L2-05 request and confirm it cannot start another connection flow or expose owner-workspace access.
2. Create a fresh unfinished Request Connection for a test client and retain its first secure setup link.
3. Generate a replacement Request Connection for that same client before completing the first request.
4. Confirm the older unfinished setup link is rejected after the replacement request is generated.
5. Confirm the replacement link remains usable as the limited-purpose client setup page.
6. Record the completed-link behavior, replacement-link behavior, any visible expired/revoked states, and any manual steps in the dated progress log.

Do not begin Level 3 publishing work while completing L2-06. Level 2 closure remains a Work review decision after this evidence is recorded.

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

#### September 28, 2026: L2-05 Request Connection live verification passed

- Task: `L2-05`.
- Outcome: `DONE`.
- Files changed: `docs/LEVEL_2_FACEBOOK_SETUP.md` only; the production application code did not require a change for this task.
- Checks and tests run:
  - live Request Connection test through the deployed Content Social Hub application
  - real Resend delivery verification
  - private/incognito browser isolation check
  - client-facing Facebook OAuth and Page-selection flow
  - completion-screen Account Health verification
  - no additional automated suite was run because L2-05 was a live-verification task and no application code changed
- Live verification:
  - a Request Connection was created for `Nicholas_Egner`
  - the real Content Social Hub connection email arrived through Resend with the secure expiring setup link
  - the setup link was opened in a private/incognito browser and displayed only the limited-purpose connection page; no Dashboard, Content, Clients, Social Accounts, or other owner-workspace navigation was exposed
  - Facebook authorization was completed from that client-facing setup flow
  - Facebook's Edit settings flow showed `Let Us Clean LLC`, `Davis Criminal Defense`, and `GIGnovate`; all three existing/current Pages were kept enabled to avoid interrupting saved client connections
  - after authorization, the Content Social Hub Page picker returned all three Pages and `GIGnovate` was explicitly selected for `Nicholas_Egner`
  - the final client-facing screen confirmed `GIGnovate is now connected to Nicholas_Egner` and reported Account Health as healthy
  - the setup page reported that setup was complete and could be safely closed
- Decisions:
  - the normal emailed client onboarding path remains Request Connection -> secure limited-purpose page -> Facebook authorization -> explicit Page selection
  - when Facebook exposes previously connected client Pages during authorization, keep those Pages enabled while adding the intended new Page so Meta does not revoke their app access
  - no owner login or Facebook Business Integrations navigation is required for the normal client-facing flow
- Blockers/manual steps: none remain for L2-05.
- Remaining work: `L2-06` is now the single `READY` task. Verify that the completed L2-05 link cannot be reused, then verify that generating a replacement unfinished request invalidates the older link while the replacement remains usable.

#### September 28, 2026: L2-06 token lifecycle verification passed

- Task: `L2-06`.
- Outcome: `DONE`.
- Files changed:
  - `components/connections-manager.js`
  - `docs/LEVEL_2_FACEBOOK_SETUP.md`
- Live verification:
  - the completed L2-05 setup link was reopened in a private/incognito browser and showed `Connection complete`; it exposed no `Continue with Facebook` action and could not restart the connection flow
  - a fresh unfinished Request Connection was generated for `Nicholas_Egner` and its secure setup link was retained
  - a second replacement Request Connection was generated before the first unfinished request was completed
  - reopening the older unfinished link returned `This connection link is unavailable`, confirming the older token had been revoked
  - the newest replacement link still opened the limited-purpose `Connect your Facebook Page` page and exposed no owner workspace
  - no additional Facebook connection was completed during the replacement-link test
  - after a normal page refresh, the owner UI correctly showed the newest request as `Pending`, the superseded request as `Revoked`, and the original successful request as `Completed`
- UI issue found and corrected:
  - immediately after creating the replacement request, the owner UI temporarily showed both the newest and superseded requests as `Pending`
  - the backend token lifecycle was already correct, as proven by the rejected old link and by the server-rendered `Revoked` status after refresh
  - `components/connections-manager.js` previously prepended the new request into local React state without updating the older request status
  - the client state update now mirrors the backend behavior by marking existing `pending` and `email_failed` rows as `revoked` before inserting the newest request
- Checks and tests run:
  - refetched the changed component from `main` and confirmed the state-update logic was present
  - targeted Node state-transition check passed with statuses `pending, revoked, revoked, completed, revoked`
  - full repository lint/build was not run in this environment because the repository could not be cloned from GitHub from the local execution container; the corrective change is limited to the already-existing client-state update path
- Decisions:
  - preserve historical request rows rather than deleting superseded requests; the UI should show their actual lifecycle status
  - replacement requests revoke unfinished `pending` and `email_failed` requests, matching the backend query
  - do not reconnect an already healthy Page merely to test request-token replacement
- Blockers/manual steps: none remain for the L2-06 acceptance criteria.
- Remaining work: no Level 2 implementation task remains `READY`. Work must review the completed Level 2 evidence, update the README checkpoint if accepted, and explicitly open Level 3 before implementation continues.

#### September 28, 2026: Level 2 closure review

- Review outcome: **PASSED — Level 2 closed**.
- Reviewed evidence:
  - direct Facebook Connect works with real Pages and persists the selected Page under the correct Content Social Hub client
  - `Andrew_Davis -> Davis Criminal Defense` and `Let_Us_Clean -> Let Us Clean LLC` returned `Healthy` after the capability-lookup correction
  - the unsupported direct selected-Page `tasks` field request was removed without losing publish-capability validation
  - Request Connection delivered a real Resend email and the secure client-facing link did not expose owner-workspace navigation
  - `Nicholas_Egner -> GIGnovate` completed through the client-facing Facebook flow and returned `Healthy`
  - completed setup links cannot be reused
  - replacement Request Connection links revoke older unfinished links while the newest link remains usable
  - the request-history UI correctly shows `Pending`, `Revoked`, and `Completed` after server refresh; the immediate local-state sync bug was corrected in commit `d4b569c1`
- Deployment verification:
  - Amplify job 35 for commit `d4b569c1` (`Sync revoked connection request status`) returned `SUCCEED`
  - Amplify job 36 for commit `446374e6` (`Document L2-06 token lifecycle verification`) returned `SUCCEED`
- Pass-condition decision:
  - the Level 2 pass condition is satisfied: real Facebook destination accounts are stored under the correct clients and Account Health verifies the saved connections
  - both supported connection paths — direct owner Connect and emailed client Request Connection — have been exercised end to end
  - the secure request-token lifecycle has been verified for completion and replacement/revocation
- Non-blocking follow-up:
  - the Social Accounts local client selector can still differ visually from the lower-left `Current View` badge; this is a context-label UX cleanup and did not affect database scoping or Level 2 acceptance
- Blockers: none.
- Next product-management action: create the Level 3 — First Publisher phase plan and mark only its first bounded task `READY` after review of that plan.

Future implementation agents should treat this document as the closed Level 2 completion record. Do not add Level 3 implementation work here.

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

Level 2 passed and was closed on September 28, 2026 after the documented direct-connect, Request Connection, Account Health, and secure-link lifecycle evidence was reviewed.