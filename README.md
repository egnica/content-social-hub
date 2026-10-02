# Content Social Hub

A standalone multi-client content management and social publishing application for creating, adapting, approving, scheduling, publishing, and measuring social content across multiple client accounts.

This README is the current product source of truth. It captures the decisions locked during product planning so implementation can proceed in small, testable stages without losing the original workflow.

## Current Infrastructure

- Repository: `egnica/content-social-hub`
- Amplify app: `https://main.d1yfjibipwjpld.amplifyapp.com/`
- Default branch: `main`
- AWS region: `us-east-2`
- Dedicated private media bucket: `content-social-hub-media`
- S3 public access: blocked
- S3 encryption: SSE-S3

No secrets, credentials, OAuth tokens, API keys, or other sensitive values should be committed to this repository.

## Implementation Status

Levels 0 through 4 and the Level 5 Instagram adapter are implemented, deployed, and verified in the live application. Instagram remains closed; broader Level 5 platform expansion is now active and must precede Level 6.

**Level 2 — First Social Connection was reviewed and closed on September 28, 2026.** Facebook Pages direct Connect and emailed Request Connection are both proven with real accounts. The selected-Page capability cleanup passed production verification, the Resend client setup flow passed end to end, and completed/replaced secure setup links were verified to become unusable as designed.

**Level 3 — First Publisher was reviewed and closed on September 29, 2026.** The Facebook destination-version editor, continuous validation and preview, real text/link publishing, private-S3 image publishing, private-S3 standard video publishing, durable Publish History, duplicate protection, retry-state handling, remote result persistence, and exact `View Post` behavior were verified with `Nicholas_Egner -> GIGnovate`.

**Level 4 — Scheduling was reviewed and closed on September 30, 2026.** Client-timezone scheduling, Master defaults and destination overrides, revision-safe schedule records, EventBridge Scheduler, the scheduler-manager Lambda, the background release worker, missed-schedule handling, bounded certainty-aware retries, pre-dispatch cancellation, browser-closed publishing, durable Publish History, exact `View Post`, and duplicate-safe worker re-entry were verified with `Nicholas_Egner -> GIGnovate`.

**Level 5 — Multi-Platform / Instagram was reviewed and closed on October 2, 2026.** The first additional provider is now proven end to end with the real `@nicholasegner` Professional account under `Nicholas_Egner`: direct and emailed Request Connection, Healthy Account state, Instagram-specific platform versions and validation, real single-image / carousel / Reel publishing, durable Publish History and exact `View Post`, and browser-closed background scheduling through the shared Level 4 EventBridge/Lambda path with duplicate-safe worker re-entry. Detailed evidence is preserved in `docs/LEVEL_5_INSTAGRAM.md`. Its completed tasks remain closed. On October 2, Nicholas approved continuing Level 5 platform expansion before Workflow + Calendar; the active phase is now `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`.

Implemented:

- owner-only sign-in with a signed HTTP-only session cookie
- pooled MongoDB connection and public deployment health check
- protected application shell and working top-level navigation
- lightweight client creation, editing, and listing
- Master Content creation, editing, listing, filtering, and reopening
- immediate private S3 upload using short-lived presigned URLs
- multiple image and video uploads
- browser-detected media dimensions, duration, aspect ratio, and orientation
- reorderable attached media and a default primary-media choice
- Save for Reuse
- guarded client deletion and Master Content deletion
- Facebook Pages OAuth adapter with direct Connect and emailed Request Connection paths
- secure expiring connection links, explicit Page picker, encrypted token storage, and Account Health
- Request Connection delivery through Resend with private client-facing setup pages
- completed-link protection and replacement-link revocation
- client-scoped Social Accounts state that refreshes correctly when the selected client changes
- request-history state that distinguishes Pending, Revoked, and Completed requests
- destination-specific Facebook platform-version records with Master-default / destination-override behavior
- Facebook-specific editing, continuous validation, live preview, and Master-change protection
- real Facebook text/link, image, and standard video publishing from the application
- private-S3 server-side image/video transfer to Meta without making the media bucket public
- durable publish attempts/results, provider post IDs/URLs, and Publish History
- duplicate-submission protection, conservative ambiguous-result locking, and deliberate known-failure retry behavior
- exact `View Post` handling for verified Facebook text/link, image, and video results
- client-timezone scheduling with Master-default and destination-override release times
- durable destination/revision-bound schedule records with safe reschedule and pre-dispatch cancellation
- EventBridge Scheduler one-time triggers managed through a scoped scheduler-manager Lambda
- browser-independent background publishing through the scheduled-release worker and the proven Facebook publisher
- missed-schedule handling for stale/human/content blockers without silently publishing late
- bounded certainty-aware technical retries and locked ambiguous-provider outcomes
- duplicate-safe worker re-entry after a successful scheduled publish
- Instagram Professional OAuth adapter with direct Connect and emailed Request Connection paths
- client-scoped Instagram Account Health and publish capability using encrypted provider credentials
- destination-specific Instagram platform versions with inheritance/customization/reset behavior and media-mode detection
- real Instagram single-image, carousel, and Reel publishing from private S3 media with durable provider results and exact `View Post`
- Instagram Reel processing that resumes the recorded provider attempt/container rather than resubmitting
- browser-independent Instagram scheduling through the shared Level 4 EventBridge/Lambda worker and schedule records
- duplicate-safe Instagram scheduled worker re-entry after successful publication
- placeholder screens that clearly identify later implementation levels

Deployment checkpoint passed on September 17, 2026:

```text
Deploy
-> sign in
-> verify MongoDB health
-> create client
-> create Master Content
-> upload private media
-> save
-> close and reopen successfully
```

Facebook direct-connection checkpoint passed on September 19, 2026:

```text
Select client
-> Connect Facebook
-> authorize through Meta
-> choose the intended Page in Meta Edit settings
-> recover / confirm the Page in Content Social Hub
-> save the Page connection under that client
-> run Account Health
-> switch clients
-> verify each client shows only its own connected Page
```

Facebook Level 2 closure checkpoint passed on September 28, 2026:

```text
Request Connection
-> Resend delivers real secure setup email
-> open link in private browser
-> verify no owner workspace access
-> authorize Facebook
-> explicitly select intended Page
-> save Page under correct client
-> confirm Account Health is Healthy
-> reopen completed link and confirm it cannot be reused
-> create replacement request
-> confirm older unfinished link is revoked
-> confirm newest replacement link remains usable
```

Facebook Level 3 publisher closure checkpoint passed on September 29, 2026:

```text
Create / open Master Content
-> select GIGnovate destination
-> create/load Facebook platform version
-> customize and live-validate the Facebook version
-> preview destination content
-> Publish Now with final confirmation
-> server rechecks ownership, Account Health, and publishability
-> duplicate submission protection applies
-> publish real text/link, image, and video posts
-> persist provider IDs / URLs and durable attempt history
-> refresh/reopen and retain Published lock + Publish History
-> View Post opens the exact live Facebook result
```

Level 4 scheduling closure checkpoint passed on September 30, 2026:

```text
Create / open clean GIGnovate Facebook destination
-> choose client-local release time
-> Schedule and persist exact revision + UTC instant
-> create one EventBridge Scheduler trigger
-> close browser before release
-> EventBridge wakes Lambda worker
-> worker reloads MongoDB schedule/version
-> worker reuses proven Facebook publisher and safety checks
-> Facebook publishes exactly one post
-> schedule reaches Succeeded and Publish History persists
-> View Post opens exact scheduled result
-> deliberate worker re-entry is a no-op
-> pre-dispatch Cancel removes AWS trigger and creates no publish attempt
```

Instagram Level 5 closure checkpoint passed on October 2, 2026:

```text
Select Nicholas_Egner
-> connect @nicholasegner as an independent Instagram Professional destination
-> verify Healthy / publishable Account Health
-> create and customize Instagram platform versions
-> publish real single-image, carousel, and Reel results
-> persist exact Instagram media IDs / permalinks and Publish History
-> View Post opens the exact live Instagram result
-> schedule a fresh Instagram revision
-> close the browser
-> EventBridge wakes the existing background worker
-> Instagram publishes exactly once
-> schedule reaches Succeeded and the one-time AWS trigger cleans up
-> deliberate worker re-entry returns noop / succeeded
```

Verified in the deployed application:

- MongoDB health, reads, and writes
- client creation, editing, filtering, and client separation
- Master Content creation, editing, saving, reopening, and Save for Reuse
- private image and video uploads to S3
- multiple media attachments, ordering, and default primary-media selection
- browser-detected media metadata and persistence after reopening
- Amplify SSR compute-role access to the private media bucket
- S3 CORS for secure browser uploads from the Amplify application
- Meta / Facebook direct OAuth connection from a selected client
- real Facebook Page selection and persistence under the correct client
- encrypted Facebook Page token storage
- Facebook Account Health checks returning `Healthy`
- client switching on Social Accounts without leaking the previously selected client's connection into the next client view
- real Resend Request Connection email delivery
- private/incognito client setup flow without owner-workspace access
- client-facing Facebook authorization and explicit Page selection
- completed setup-link reuse prevention
- replacement-link revocation of older unfinished requests
- Facebook platform-version creation, exclusion/reactivation, inherited defaults, destination customization, and Master-change protection
- continuous Facebook validation and approximate destination preview
- real Facebook text/link publishing to GIGnovate
- real private-S3 Facebook image publishing to GIGnovate
- real private-S3 Facebook standard video publishing to GIGnovate with custom video cover support
- durable Facebook Publish History after refresh/reopen
- successful-revision duplicate lockout and destination-specific publish state
- exact `View Post` for the verified text/link, image, and video flows
- `America/Chicago` client-timezone release interpretation and UTC persistence
- schedule-only changes preserved the publish-content revision boundary
- destination Schedule / Reschedule / Cancel state persisted after refresh/reopen
- EventBridge Scheduler create/update/delete through the scheduler-manager Lambda
- scheduled text/link, private-S3 image, and private-S3 video background publishing
- stale scheduled revisions become Missed Schedule and do not silently publish edited content late
- browser-closed scheduled publishing to GIGnovate with one worker invocation and zero Lambda errors
- successful scheduled worker re-entry returns a no-op and does not create a duplicate Facebook post
- pre-dispatch cancellation removes the EventBridge schedule and creates no Publish History attempt
- real Instagram Professional direct Connect and emailed Request Connection under `Nicholas_Egner`
- Instagram Account Health returning Healthy / publishable for `@nicholasegner`
- separate Instagram platform-version inheritance, customization, reset, validation, preview, and media-mode behavior
- real Instagram single-image publishing with durable Succeeded history, Published lock, and exact `View Post`
- real Instagram carousel publishing with ordered provider processing, durable Succeeded history, and exact `View Post`
- real Instagram Reel publishing with recorded-container resume behavior, Master thumbnail cover, durable Succeeded history, and exact `View Post`
- browser-closed Instagram scheduled publishing through the shared EventBridge/Lambda worker
- successful Instagram scheduled worker re-entry returns `noop / succeeded` and does not create a duplicate post

Verified live Facebook mappings as of September 29, 2026:

```text
Andrew_Davis
-> Davis Criminal Defense
-> Healthy

Let_Us_Clean
-> Let Us Clean LLC
-> Healthy

Nicholas_Egner
-> GIGnovate
-> Healthy
-> Connected through Request Connection / Resend client flow
-> Level 3 text/link, image, and video publishing verified
-> Level 4 browser-closed scheduling verified September 30, 2026
```

Verified live Instagram mapping as of October 2, 2026:

```text
Nicholas_Egner
-> @nicholasegner
-> Instagram Professional / Creator
-> Healthy
-> Direct Connect and Request Connection verified
-> single-image, carousel, and Reel publishing verified
-> Level 5 browser-closed scheduling verified October 2, 2026
```

Environment, S3 CORS, and runtime IAM requirements are documented in `docs/LEVEL_0_1_SETUP.md`.

The closed Level 2 Meta, Resend, OAuth, token-encryption, and live-verification record is `docs/LEVEL_2_FACEBOOK_SETUP.md`.

The closed Level 3 Facebook publisher plan and completion record is `docs/LEVEL_3_FACEBOOK_PUBLISHER.md`.

The closed Level 4 Scheduling plan, implementation log, live evidence, and completion record is `docs/LEVEL_4_SCHEDULING.md`.

The closed Level 5 Instagram adapter plan, implementation log, live evidence, and Work review record is `docs/LEVEL_5_INSTAGRAM.md`.

---

## Product Goal

The app is not just a scheduler. The core object is a **Master Content** package that can contain source content and then produce platform-specific versions for one or more social destinations.

Core lifecycle:

```text
Master Content
  -> Platform Versions
  -> Client Approval
  -> Schedule / Publish
  -> Platform Results
  -> Analytics / Reporting
```

The app should automate administrative steps whenever the next action can be determined safely.

---

## Application Structure

This is one application with two data contexts, not two separate dashboards.

### Top-level navigation

The working top-level navigation is:

```text
Dashboard
Content
Calendar
Approvals
Reports
Clients
Analytics
Social Accounts
```

A prominent action such as:

```text
[ + Create Content ]
```

starts a new Master Content workflow.

**Content** and **Create Content** are intentionally different concepts:

- **Content** = the library / operational view of existing Master Content packages
- **Create Content** = the action that starts a new Master Content package

### All Clients View

Shows activity across every client.

Examples:

- all content
- all scheduled posts
- all approvals
- account-health issues
- publishing failures
- new comments
- audience growth
- aggregate analytics

### Selected Client View

A client selector changes the entire app context.

```text
[ All Clients v ]
  Davis Defense
  Garden Club
  Counterpoint Law
  Nicholas Egner
```

When a client is selected, Dashboard, Content, Calendar, Approvals, Reports, Analytics, Social Accounts, and related screens show only that client's data.

Client login accounts are not part of V1. Clients interact through secure limited-purpose connection and approval links.

---

## Client Management

Adding a client should remain lightweight.

### Initial client fields

- Name
- Website
- Timezone
- Approval / Report Email
- Status defaults to Active
- Logo may be added later as an optional presentation field

The Approval / Report Email is used for:

- social-account connection requests
- client approval requests
- reapproval requests
- on-demand report delivery

### Client lifecycle and deletion

- setting a client to `Inactive` is the normal archive path and preserves its Content and history
- permanent client deletion is allowed only when the client has zero saved Master Content packages and zero connected social accounts
- if Content or social connections exist, deletion is blocked and the operator must archive the client or explicitly remove those dependent records first
- the application never silently orphans Content or OAuth connections by removing their client

### Not part of initial client creation

- CRM-style contact management
- campaign management
- complex team permissions
- required branding setup

A richer brand profile can be added later for optional AI assistance and consistency.

---

## Social Account Connections

A client can have multiple social connections. Connections are records, not fixed fields such as `client.facebookAccount`.

A client may have multiple accounts on the same platform.

### Facebook Pages implementation checkpoint — September 19, 2026

The Facebook implementation was tested with real Pages and the intended multi-client ownership model is now proven for the direct Connect path.

The key architecture is:

```text
Content Social Hub Client
-> operator authorizes with their own Facebook login
-> Meta proves which Pages that operator can manage
-> operator selects / confirms the exact destination Page
-> Content Social Hub stores the Page connection under the selected client
```

The Facebook **user account is only the authorization identity**. The Facebook user is not treated as the client and is not stored as the publishing destination. The saved destination is the specific Facebook Page, and that Page is associated with a specific Content Social Hub client record.

#### Verified direct-connect flow

The live flow that passed is:

```text
1. Select a Content Social Hub client in Social Accounts.
2. Click Connect under Facebook Pages.
3. The app creates OAuth state containing the selected client relationship.
4. Meta handles authentication; Content Social Hub never collects the Facebook password.
5. In Meta's Edit settings flow, choose the Page(s) the app is allowed to use.
6. Meta redirects to /api/connections/facebook/callback with the OAuth code and state.
7. The app exchanges the code for an access token.
8. The app inspects token permissions and Meta granular Page targets.
9. The app recovers eligible Page candidates.
10. The operator explicitly confirms the destination in the Content Social Hub Page picker.
11. The Page access token is encrypted before persistence.
12. The social connection is stored with the Content Social Hub client ID, Page ID, Page name, avatar, scopes/tasks/capabilities where available, token expiration data, and health state.
13. Account Health runs against the saved Page connection.
14. Returning to Social Accounts shows the saved Page only for the client it belongs to.
```

#### Problem 1 — relying on `/me/accounts` did not fully represent Meta's selected-Page choice

During testing, Meta's Facebook Login for Business flow allowed the operator to use **Edit settings** and explicitly choose a Page. The first implementation relied primarily on the Graph API `/me/accounts` response to discover Pages.

That is not always the best representation of the Page the operator just selected in the Meta dialog. Meta can include Page-specific targets in the token's `granular_scopes[].target_ids` data.

The fix added token inspection and selected-Page recovery:

- inspect the OAuth token through Meta's token-debug response
- read `granular_scopes`
- collect Page `target_ids` for the required Page permissions
- attempt to recover those specific Pages directly
- treat those Meta-selected target IDs as the preferred Page source
- fall back to `/me/accounts` only when the selected-target lookup does not produce a usable Page
- expose diagnostics showing the selected target count, Page-discovery source, returned Page count, and provider errors

Relevant commits:

```text
f10e510  Recover selected Facebook Pages from token targets
cfe022c  Fix selected Facebook Page recovery
```

The second change was important: the first recovery version still gave a successful `/me/accounts` result priority. `cfe022c` changed the callback so the explicit Meta selected-Page targets are attempted first, and the managed Pages list is the fallback.

#### Problem 2 — selected-Page capability lookup cleanup completed September 28, 2026

The first selected-target recovery requested this field set directly from a Page:

```text
id,name,picture.type(square){url},access_token,tasks
```

Meta rejected `tasks` on that direct Page lookup with:

```text
(#100) Tried accessing nonexisting field (tasks)
```

The Level 2 cleanup removed that unsupported direct-Page field request without weakening publishing-capability checks.

Current verified behavior:

- direct target lookup requests Page identity, avatar, and access token without the unsupported `tasks` field
- `/me/accounts` remains the verified source for Page task/capability data such as `CREATE_CONTENT`
- capabilities are merged onto directly recovered Pages by Page ID
- token granular target IDs remain useful for identifying the Page(s) Meta authorized, but are not treated as proof of Page publish capability by themselves
- Account Health still requires the necessary Page permissions and actual create-content capability
- both Davis Criminal Defense and Let Us Clean LLC returned `Healthy` after the correction

Relevant corrective commits:

```text
1737fbaf  Fix Facebook Page capability lookup
30cbbcdd  Restore Facebook Page publish capability
```

This issue is considered resolved for Level 2. Do not reintroduce direct Page `tasks` lookup merely to simplify future publishing work.

#### `business_management (declined)` diagnostic

The live Meta diagnostic also showed `business_management` as declined. The current Facebook adapter's required permission list is:

```text
pages_show_list
pages_read_engagement
pages_manage_posts
```

`business_management` is not currently one of the adapter's required permissions, and its declined state did not prevent verified Page connections from reaching `Healthy`. If this appears again, do not assume it is the cause of a failed connection unless a later feature specifically requires it.

#### Problem 3 — connected Page appeared to persist when switching clients

After the first successful Davis connection, switching the Social Accounts client selector from `Andrew_Davis` to a newly created `Let_Us_Clean` client still displayed **Davis Criminal Defense** in the Connected accounts panel.

This looked like a database association failure, but the backend relationship was already correct.

The server-side Social Accounts page does this correctly:

```text
selected client ID
-> listSocialConnections({ clientId: selectedClient._id })
-> MongoDB query filters social_connections by that client ObjectId
```

The actual bug was in `components/connections-manager.js`.

The component initialized local React state from the first server render:

```text
useState(initialConnections)
useState(initialRequests)
```

Changing the client used `router.push()` and loaded new server props, but the component's existing local state was not automatically replaced. The previous client's connected-account row therefore remained visible even though the server had returned the correct data for the new client.

The fix added `useEffect` synchronization so a client/prop change resets:

```text
connections <- initialConnections
requests    <- initialRequests
message     <- ""
error       <- ""
```

Relevant commit:

```text
40f100a  Sync social accounts when client changes
```

This fix was then tested with two real client/Page relationships:

```text
Andrew_Davis
-> Davis Criminal Defense
-> Healthy

Let_Us_Clean
-> Let Us Clean LLC
-> Healthy
```

Switching the selector now changes the connected Page shown. This proves that the connected-account UI is scoped to the selected client and that the two client records do not share one global Facebook connection.

#### Important client-scoping rule for future work

Any future social provider must preserve this relationship:

```text
Client A -> only Client A connections
Client B -> only Client B connections
```

A social connection is never global merely because the same Content Social Hub operator can administer multiple client accounts on that network.

When diagnosing future cross-client display issues, check both layers separately:

1. **Server/database scope** — is the query filtering on `clientId`?
2. **Client UI state** — is React still showing state initialized for the previous client?

Do not rewrite the database model unless the server query actually proves the records are cross-linked.

#### Level 2 closure — September 28, 2026

The remaining Level 2 work was completed and reviewed:

- selected-Page capability lookup corrected without removing publish-capability validation
- real Request Connection email delivered through Resend
- private/incognito client setup page verified not to expose the owner workspace
- `Nicholas_Egner -> GIGnovate` connected through the client-facing flow and returned `Healthy`
- completed setup link became unusable
- generating a replacement request revoked the older unfinished link
- newest replacement link remained usable as the limited-purpose client setup page
- request-history UI was corrected so replacement requests immediately show the older request as `Revoked` rather than leaving stale `Pending` state until refresh

Detailed evidence is preserved in `docs/LEVEL_2_FACEBOOK_SETUP.md`.

### Two connection paths

#### Connect

Used when the operator already has sufficient access.

```text
[ Connect ]
  -> platform OAuth
  -> use existing platform session or sign in on the platform
  -> show eligible Pages / organizations / channels
  -> explicitly choose the correct destination
  -> verify permissions
  -> run connection test
  -> save connection to this client
```

The application never collects a user's Facebook, LinkedIn, Google, or other social password.

#### Request Connection

Used when the client must authorize access.

```text
Select required networks
  -> Send Connection Request
  -> Resend sends one email
  -> client opens secure temporary setup page
  -> client connects requested accounts one by one
  -> progress updates automatically
  -> request invalidates when complete
```

The setup page only grants permission to complete the requested social connections. It does not expose the client workspace.

### Secure connection links

Connection-request links should use temporary, cryptographically secure tokens.

Rules:

- default expiration: approximately 48 hours
- token checked server-side
- token can be revoked
- generating a replacement invalidates the old token
- completed requests become unusable
- expired links show a clear expired state

### Connection progress

Track both aggregate and per-network progress.

```text
3 requested
2 connected
1 remaining
```

Connected accounts should show their actual account/page/channel name and avatar where available.

### Reconnection

If human reauthorization is required later:

```text
[ Reconnect Myself ]
[ Send Reconnect Request ]
```

Reconnect uses the same secure Resend-based connection flow.

---

## Account Health

Most token refresh should happen automatically in the background when the platform permits it.

Account Health should remain quiet when everything is healthy and become prominent when action is required.

Possible states:

- Healthy
- Expiring Soon
- Expired
- Disconnected
- Permission Problem
- API Error

Dashboard behavior:

- healthy accounts do not need a large persistent dashboard block
- expired / disconnected / permission problems surface prominently
- expiring credentials can show a softer warning

Full health details may include:

- OAuth status
- required scopes / permissions
- last refresh
- last successful API check
- last successful publish
- recent failures

---

## Dashboard

The Dashboard is an operational command center rather than a large generic analytics page.

It should answer four questions quickly:

1. What broke?
2. What changed?
3. What is going out today?
4. What needs attention next?

### Global summary

The All Clients dashboard can show compact summary counts such as:

```text
4 Needs Attention
11 New Comments
+47 Followers / Subscribers
8 Scheduled
3 Awaiting Approval
```

### All Clients client rows

The main body of the All Clients dashboard should contain one row for every client added to the application.

Example columns:

| Client | Needs Attention | New Comments | Audience Growth | Upcoming | Approvals | Recent Publish |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Davis Defense | 1 | 4 | +21 | 3 | 1 waiting | 2 today |
| Garden Club | — | 2 | +8 | 1 | Changes requested | Yesterday |
| Counterpoint Law | — | — | +3 | 2 | — | Sep 15 |

Meaningful counts should be actionable where practical. Examples:

- click `4 new comments` to open the related published items
- click a failed-post count to open Needs Attention for that client
- click a client row to enter that client's dashboard context

### Selected-client dashboard sections

A selected-client dashboard can include:

- Needs Attention
- New Comments
- Audience Growth
- Today's / Upcoming Schedule
- Approvals
- Account Health problems
- Recent Activity
- lightweight analytics snapshot

### Needs Attention

High-priority examples:

- post failed to publish
- approval changes requested
- missed schedule
- expired or disconnected account
- permission problem
- required publishing field missing

### Recent Activity

Routine successes should remain visible without generating unnecessary alerts.

Examples:

- published successfully
- approved
- social connection completed
- scheduled
- report sent

---

## Notifications

Notifications should be useful without becoming noisy.

### Notification surfaces

- **Dashboard alert** for items requiring action
- **In-app notification center** for recent changes and history
- **Resend email** for higher-value events where an active notification is useful

Events that may justify active notification include:

- post failed to publish
- client requested edits
- client approval completed when useful
- social account requires reconnection
- scheduled post missed its release time
- connection request completed
- report delivery failed

Routine successful publishes generally belong in Recent Activity rather than generating an email for every post.

Notifications should link directly to the relevant Master Content, destination version, connection, report, or error whenever possible.

### Email / notification log

Keep a lightweight record of outbound application emails and important notifications.

Example:

```text
Sep 16  8:42 PM
Approval request
Davis Defense
Delivered

Sep 17  9:15 AM
Revision ready
Davis Defense
Delivered
```

---

## Content

The top-level **Content** area is the operational home for saved Master Content packages.

`Create Content` is a separate prominent action that starts a new package.

Views should include at least:

- Board or status-oriented view
- List view
- Calendar view is handled by the dedicated Calendar screen

Useful filters:

- Client
- Status
- Platform
- Media type
- Date
- Search
- Reusable

The application should derive workflow status automatically rather than relying on users to manually move cards between arbitrary production phases.

---

## Master Content

Master Content is the central post package.

### Creation entry points

A new package can start from:

- Paste URL
- Upload Image
- Upload Video
- Start With Text

### Core fields and controls

- Internal Title — required, used throughout the app
- Client
- Text
- Primary URL
- Video
- Multiple images
- Default primary media
- Default video thumbnail / cover when video exists
- Short-form / Long-form
- Selected destination accounts / platforms
- Default release date and time
- Overall automated status
- Save for reuse

The internal title is not necessarily published. It identifies the package in:

- Content
- Calendar
- Approvals
- Publishing logs
- Analytics
- Reports
- Search

### Deleting Master Content

- deletion requires an explicit confirmation
- deleting Master Content removes the package from MongoDB
- attached S3 media is preserved and is never silently deleted
- deleting a record from this application does not delete an already-published remote social post

### Source combinations

Master Content can contain combinations such as:

- URL only
- image only
- video only
- text only
- URL + image
- URL + video
- video + supporting images
- multiple images

The available platform options should change based on the source assets and connected destination accounts.

### Media hierarchy

Master Content defines defaults, not permanent platform behavior.

Example hierarchy:

1. explicitly selected / uploaded media
2. URL metadata image
3. no visual

Each platform version can override the inherited default.

---

## Media Storage and Uploads

Every uploaded media asset should be stored in the dedicated private S3 bucket immediately.

User experience:

```text
local upload
  -> secure browser upload
  -> S3
  -> database stores S3 key/reference and metadata
```

### Storage rules

- preserve original files
- keep bucket private
- use temporary signed access where needed
- logical client separation through object-key prefixes
- do not create separate buckets per client
- deleting a post should not automatically delete reusable media
- media deletion should be explicit
- no CloudFront requirement for V1
- no automatic lifecycle deletion rules for V1

Likely key pattern:

```text
clients/{clientId}/originals/
clients/{clientId}/derivatives/
clients/{clientId}/thumbnails/
```

---

## Media Intelligence

Media Intelligence runs automatically on upload and surfaces inside Master Content.

Automatically detected facts may include:

- file type
- file size
- duration
- width
- height
- aspect ratio
- orientation
- codec
- frame rate
- bitrate where useful

User-controlled media decisions should remain small:

- Short-form / Long-form
- Default primary media
- Image order for multi-image content
- Default thumbnail / cover

Technical facts such as aspect ratio and duration should not require manual entry.

### Multiple images

Multiple images are supported and should be reorderable.

### Video thumbnail / cover

If a video exists, Master Content can define a default thumbnail / cover. Platform versions inherit it where supported and can override it.

---

## Destination Platform Selection

Master Content contains the destination selector.

Only connected and compatible destinations should be selectable.

Example:

```text
Facebook   [x] Davis Defense Lawyers
Instagram  [x] @davisdefenselawyers
LinkedIn   [x] Davis Defense Lawyers
YouTube    [x] Davis Defense Lawyers
```

If a client has multiple accounts on the same network, the actual destination account matters, not just the platform name.

Selecting a destination creates its editable platform version.

Unselecting a destination should exclude the version without immediately destroying previously entered work.

---

## Platform Versions

Each selected destination gets its own real publishing form, not just a copy of one generic caption.

Master Content supplies shared source assets and defaults. Platform versions inherit those defaults and may override them independently.

Possible per-platform fields:

- post text / caption
- title
- description
- hashtags
- CTA
- destination link
- media choice
- uploaded-media vs URL-preview treatment
- thumbnail / cover override
- first comment
- alt text
- playlist or other network-specific fields
- visibility
- audience settings
- schedule override

### Live editable post preview

The platform editor should include a live preview beside the editable fields.

Switching platform tabs changes both:

- editable fields
- preview style / supported controls

Previews should be close representations, not promises of pixel-perfect platform rendering.

### Link metadata

When a URL is entered, the app should fetch useful metadata such as:

- Open Graph title
- description
- image
- canonical URL
- site name

The user can choose platform-specific treatment.

Example:

```text
Facebook -> native website link preview
LinkedIn -> uploaded image + link
Instagram -> uploaded image + caption
```

### Master changes after customization

If a platform version has never been customized, it may continue inheriting Master changes.

If it has been customized, later Master changes must not overwrite it automatically.

Show a notice such as:

```text
Master content changed
[ Keep Platform Version ]
[ Update From Master ]
```

A `Reset to Master` action can deliberately discard the platform customization.

---

## Live Validation / Platform Preflight

Preflight is a process, not a button.

Validation should happen continuously while fields are edited.

Examples:

```text
YouTube
[x] Video
[x] Title
[ ] Visibility required
[!] Thumbnail recommended
```

### Validation levels

- Blocking error — destination cannot be approved/scheduled/published
- Warning — user may continue after reviewing it

Potential checks:

- required text/title/description fields
- file size
- duration
- aspect ratio
- resolution
- media type
- character limits
- thumbnail requirements
- destination account health
- approval state
- schedule validity

Validation runs again before approval, scheduling, and publishing.

A blocking issue affects only that destination; valid destinations should remain usable.

---

## Automated Content Status

Do not rely on users to manually maintain workflow states.

Useful automatically derived states:

- Saved
- Awaiting Approval
- Ready to Schedule
- Scheduled
- Publishing — transient
- Published
- Partially Published
- Failed

A separate `Needs Attention` filter can surface problems such as:

- requested edits
- failed publish
- missing required fields
- expired social connection

Mixed destination states must remain visible inside the Master Content item.

---

## Client Approvals

Approval is per platform/destination version.

Client actions:

- Approve
- Request Edit
- Reject
- Approve All

### Request Edit

`Request Edit` requires a comment.

The comment appears:

1. on the Master Content overview as a destination needing attention
2. directly inside that destination's editor beside the editable content

Saving the revision changes the destination to `Awaiting Reapproval` and triggers a Resend email automatically.

### Approval versioning rules

- approval belongs to a specific revision
- any edit after approval invalidates that destination's approval
- changing one destination does not invalidate approvals for other destinations
- rejected destinations are excluded from publishing rather than killing the whole Master Content package
- only the currently approved revision may publish

### Approval page

The secure approval page should show a preview for each destination and support per-destination review.

Approval activity and history should remain visible inside Master Content.

---

## Comments and Version History

This is an approval/revision audit trail, not a general chat product.

Track:

- revision number
- timestamp
- who made the change
- Request Edit comment
- optional Reject comment
- approval event
- revision that was actually published

Old revisions remain read-only and viewable.

---

## Immediate Publishing

Master Content actions include:

- Save Draft
- Publish Now
- Schedule

### Publish Now flow

```text
Publish Now
  -> confirm destinations
  -> validate
  -> verify approval rules
  -> verify account health
  -> protect against duplicate submission
  -> publish destinations independently
  -> capture platform post ID / URL
  -> update statuses
```

### Rules

- show a final confirmation before going live
- show per-destination progress
- retry only failed destinations
- never repost successful destinations during a retry
- capture post IDs and live URLs automatically when available
- when an API returns only an ID, the platform adapter may construct or retrieve the canonical live-post URL when supported
- show a `View Post` action that opens the exact remote post
- the user should not need to manually paste the final social-post URL into the app
- keep an audit record of who triggered the publish, when, and which revision went live
- once the remote network accepts the content, cancellation is no longer treated as a scheduling action

---

## Scheduling Engine

MongoDB is the system of record for schedules and publishing state.

Planned AWS responsibilities:

- EventBridge Scheduler — wake up at scheduled release time
- Lambda — perform background publishing work
- SQS — reliable queue / retry handling where appropriate
- encryption / KMS strategy for sensitive OAuth credentials

Core behavior:

- Master Content defines the default release date/time
- individual destinations may override it
- client timezone is the default scheduling timezone
- publishing continues when no browser is open
- approval is a hard gate
- live validation and account health are checked again immediately before publishing
- destinations publish independently
- scheduled items can be rescheduled/cancelled before submission

### Missed schedules

Human or permission blockers should not silently publish late.

Example:

```text
10:00 AM arrives
Approval missing
-> not published
-> Missed Schedule / Needs Attention
-> user chooses Publish Now or Reschedule
```

Temporary technical failures may retry automatically within a controlled window before escalating to Needs Attention.

---

## Calendar

The app has its own native visual calendar. Google Calendar is not required for core publishing.

The application database remains the source of truth.

Views:

- Month
- Week
- List

Filters:

- Client
- Platform
- Status

Calendar events represent actual destination schedules. If one Master Content package has different times per platform, those destination releases appear separately.

Clicking an event opens its Master Content item, focused on the relevant destination where possible.

A mature React calendar library may provide the visual mechanics; application data and scheduling logic remain ours.

Optional future Google Calendar / iCal sync can be added as a convenience view only, never as the publishing trigger.

---

## Engagement Alerts

V1 does **not** include a full Social Inbox.

Instead, the app uses lightweight engagement alerts to surface activity that may need attention without trying to replace the social platforms themselves.

### Initial V1 behavior

- detect / retrieve new comment counts where platform APIs permit
- show a `New Comments` count or tag on published content
- surface unreviewed new comments on the Dashboard
- provide `View Post` to open the exact remote social post
- provide `Mark Reviewed` so old engagement does not remain permanently flagged

Example:

```text
Davis Defense
First DWI in Minnesota
Facebook
3 new comments

[ View Post ] [ Mark Reviewed ]
```

The app does not need to reply to comments in V1.

### Explicitly out of scope for V1 engagement

- replying to comments inside the app
- direct messages
- unified conversation threads
- full customer-service inbox

Webhooks may be used where supported. Polling or periodic API checks may be used where that is the appropriate provider capability.

---

## Audience Growth

The top-level dashboard should show follower / subscriber growth by client and platform where provider APIs expose the necessary data.

The core requirement is **audience count change**, not the identity of every new follower.

Example:

```text
Last 7 days
Instagram      +18 followers
Facebook        +7 followers
LinkedIn        +5 followers
YouTube         +3 subscribers
Total          +33
```

Audience Growth should also contribute to the one-row-per-client summary on the All Clients dashboard.

When each social adapter is added, follower / subscriber analytics becomes part of that adapter's analytics checklist.

---

## Reusable Content

No complex evergreen/recycling system in V1.

Instead, Master Content can include:

```text
[ ] Save for reuse
```

Reusable items remain inside the normal Content area and are accessible through a `Reusable` filter.

`Create New Version` creates a fresh Master Content package.

May copy:

- media
- URL
- thumbnail
- selected copy if desired

Must not copy:

- old approvals
- old schedule
- old publishing status
- old remote post IDs
- old analytics history

---

## UTM Link Tracking

Master Content stores the clean destination URL.

The application generates platform-specific tracking URLs automatically.

Example:

```text
https://example.com/page
?utm_campaign=first-dwi-in-minnesota
&utm_source=facebook
&utm_medium=organic-social
```

Rules:

- `utm_campaign` can default from a normalized Master Content internal title
- `utm_source` is generated from the destination platform
- `utm_medium` defaults to `organic-social`
- existing query parameters must be preserved correctly
- editors can display the clean URL while indicating that tracking will be added at publication

A full Campaigns feature is not required to use `utm_campaign`.

---

## Analytics and Website Attribution

The app should store native social analytics and website-attribution data centrally for dashboards and reports.

### Planned social analytics sources

- Meta / Instagram APIs
- LinkedIn APIs
- YouTube Analytics API
- later adapters for additional supported networks

The same social OAuth connection should be reused for analytics where the granted permissions allow it.

### Website attribution

Planned Google analytics integration:

- Google Analytics Data API for reporting
- Google Analytics Admin API only if needed to help users discover/select accessible GA4 properties

UTM values tie website traffic back to:

- Master Content
- destination platform
- source URL

Where the client website records suitable GA4 events, reports can also include outcomes such as:

- service-page visits
- contact-page visits
- form submissions / key events

Platform-native metrics must remain stored under their original definitions. The application should not pretend a view on one network is necessarily identical to a view on another.

---

## Reports / Report Hub

Reports are generated on demand in V1. Automatic monthly report scheduling is not required initially.

The top-level **Reports** area should provide a reusable Report Hub built from the same stored analytics used by dashboards.

### Report controls

- select Client
- platform filters such as Facebook, Instagram, LinkedIn, YouTube
- preset date ranges:
  - 7 Days
  - 30 Days
  - 60 Days
  - 90 Days
- custom `From` / `To` date range
- custom range overrides a preset when used
- `Reset` returns to the default range, expected to be 30 days initially

### Possible report content

- posts published
- platform-native views / impressions / reach where available
- engagements
- link clicks
- website visits attributed through UTM data
- tracked leads / GA4 key events where available
- audience growth
- top content

### Report actions

```text
[ Download PDF ]
[ Send Report ]
```

`Send Report` uses Resend and defaults to the client's Approval / Report Email.

Use a consistent default report layout in V1 rather than building a complex report-template system.

---

## Resend

Resend is the application's single outbound email delivery layer.

Our application determines **what happened, who should be notified, and whether an email is appropriate**. Resend performs the email delivery.

Resend is used for:

- account-connection requests
- reconnect requests
- approval requests
- revision / reapproval notifications
- important publishing-failure alerts
- missed-schedule alerts
- important account-health / reconnection alerts
- on-demand report delivery

Connection and approval emails should link back to secure, limited-purpose application pages rather than directly exposing privileged application routes.

Where useful, the application should also track outbound email status through Resend webhooks and maintain the Email / Notification Log described above.

Routine successful social publishes do not need to generate email noise.

---

## Team Roles and Permissions

A full team-role and permissions system is explicitly **not part of V1**.

V1 model:

```text
Operator / Owner
-> authenticated
-> full application access

Client
-> no application account required
-> secure connection and approval links only
```

The data model should avoid choices that make future role-based access impossible, but no client-login, staff-role, or permissions-management UI needs to be built initially.

---

## AI Assistance

AI is not a V1 dependency.

The complete product must work without ChatGPT, OpenAI, or any other AI service.

Core manual workflow must remain:

```text
Master Content
-> Platform Versions
-> Approval
-> Schedule / Publish
-> Analytics
```

Possible future optional AI actions:

- generate platform-specific copy
- generate YouTube title / description
- suggest alt text
- summarize transcripts
- rewrite content to match brand voice

If AI is added, use a provider-agnostic adapter so the application is not structurally tied to one AI vendor.

---

## Deliberately Excluded From V1

The following are not part of the initial product unless real usage proves they are needed:

- Campaign management
- Content categories / pillars
- automatic evergreen recycling queues
- separate Content Hub integration
- full social inbox / unified messaging
- replying to comments inside the app
- direct-message management
- social listening
- competitor monitoring
- paid-ad management
- built-in graphic editor
- link-in-bio product
- client login accounts
- complex team-role permission matrix
- automatic scheduled monthly reports
- mandatory AI features

---

## Current Technical Direction

```text
Next.js / Amplify
  -> application UI and server routes
  -> OAuth callbacks and normal application actions

MongoDB
  -> system of record for application data
  -> clients
  -> Master Content
  -> platform versions
  -> approvals / revisions
  -> schedules
  -> connections
  -> publishing results
  -> notifications
  -> analytics

S3
  -> media only
  -> original media
  -> thumbnails
  -> future derivatives

AWS EventBridge Scheduler
  -> scheduled release trigger

AWS Lambda
  -> background publishing work

AWS SQS
  -> retry / delivery reliability where needed

Resend
  -> connection, approval, reapproval, report, and alert email
```

Additional architecture rules:

- MongoDB is the source of truth for application state
- S3 stores large media objects while MongoDB stores their keys and metadata
- scheduled publishing must continue independently of the user's browser or computer
- long-lived social credentials and provider secrets remain server-side and protected
- Resend is a delivery layer; application logic decides when email should be sent
- do not add DynamoDB merely because the project is hosted on AWS unless a concrete need appears later

---

## Implementation Strategy

The application must be built incrementally. Every phase should leave a working product that can be tested before the next phase begins.

Do not configure every social API up front. Add credentials only when the implementation reaches the feature that needs them.

### Level 0 — Foundation

Build:

- application shell
- auth
- MongoDB connection
- deployment stability
- environment-variable structure

Credential / infrastructure checkpoint:

- MongoDB connection

Pass condition:

- deployed application reliably reads and writes application data

### Level 1 — Client + Content Foundation

Build:

- lightweight clients
- top-level navigation
- Content area
- `+ Create Content` workflow entry
- Master Content
- upload to private S3 bucket
- multiple images
- video upload
- media metadata / intelligence
- internal title
- Save for reuse
- guarded client and Master Content deletion

Credential / infrastructure checkpoint:

- S3 / Amplify permissions for `content-social-hub-media`

Pass condition:

```text
Create client
-> Create Content
-> upload media
-> save
-> reopen successfully
```

### Level 2 — First Social Connection

First adapter: Facebook Pages through Meta OAuth.

Build:

- one network OAuth flow only
- Connect path
- Request Connection path
- secure expiring setup page
- Resend email
- account picker
- saved connection
- initial Account Health

Credential checkpoint:

- add `APP_BASE_URL`, `META_APP_ID`, `META_APP_SECRET`, and optional `META_LOGIN_CONFIG_ID`
- add a base64-encoded 32-byte `OAUTH_TOKEN_ENCRYPTION_KEY`
- add `RESEND_API_KEY`, `EMAIL_FROM`, and optional `EMAIL_REPLY_TO`
- configure the production callback URI documented in `docs/LEVEL_2_FACEBOOK_SETUP.md`
- add only the first social network's API credentials / OAuth configuration
- add Resend configuration needed for application mail

Pass condition:

- connect a real destination account and persist the correct account under the correct client

**Status: PASSED and CLOSED September 28, 2026.**

Verified closure evidence includes:

- direct Connect with independently scoped real client/Page mappings and healthy saved connections
- corrected selected-Page capability lookup while preserving publish-capability validation
- end-to-end Request Connection through Resend and the secure client-facing setup page
- `Nicholas_Egner -> GIGnovate -> Healthy` through the emailed client flow
- completed setup links cannot be reused
- replacement requests revoke older unfinished setup links while preserving the newest link

Detailed evidence is in `docs/LEVEL_2_FACEBOOK_SETUP.md`.

### Level 3 — First Publisher

Build:

- first platform-specific editor
- live validation
- live preview
- Publish Now
- duplicate protection / idempotency
- result logging
- retry handling
- automatic capture of remote post ID / URL
- `View Post`

Pass condition:

```text
Create Master Content
-> select connected destination
-> edit platform version
-> validate
-> Publish Now
-> save remote post ID / URL
-> View Post opens exact live post
```

**Status: PASSED and CLOSED September 29, 2026.**

Verified closure evidence includes:

- separate destination-specific Facebook platform versions with Master-default / destination-override behavior
- continuous validation, live preview, customization persistence, and Master-change protection
- real GIGnovate text/link publish with exact `View Post`
- real GIGnovate image publish from private S3 with exact `View Post`
- real GIGnovate standard video publish from private S3 with custom cover and corrected exact `View Post`
- durable provider IDs/URLs and Publish History
- successful-revision duplicate lockout, conservative ambiguous-result handling, and known-failure retry rules
- final reliability checkpoint after refresh/reopen with no duplicate remote post

Detailed evidence is in `docs/LEVEL_3_FACEBOOK_PUBLISHER.md`.

This is the first major end-to-end publishing milestone and is now complete.

### Level 4 — Scheduling

Build:

- default Master schedule
- per-platform overrides
- EventBridge / Lambda background publishing
- SQS where useful for reliable queued execution / retries
- missed-schedule behavior

Credential / infrastructure checkpoint:

- configure AWS permissions and environment values required for EventBridge, Lambda, and SQS where the implementation actually uses them

Pass condition:

- schedule a real post, close the browser, and verify background publishing occurs correctly

**Status: PASSED and CLOSED September 30, 2026.**

Verified closure evidence includes:

- client IANA timezone is authoritative for human-entered release times and the resolved UTC instant is persisted
- schedule-only metadata changes do not falsely increment publish-content revisions
- Master default and destination override scheduling both work without creating implicit schedules on save
- durable `scheduled_releases` records bind the exact destination revision and prevent duplicate active schedules
- Schedule / Reschedule / Cancel state survives refresh and already-published revisions cannot be rescheduled
- EventBridge Scheduler one-time triggers are managed through the scoped scheduler-manager Lambda and auto-delete after execution
- the background worker reuses the Level 3 Facebook publisher, validation, Account Health, idempotency, private-S3 media transfer, publish attempts, and exact result persistence
- background text/link, image, and standard-video publishing are verified with GIGnovate
- stale scheduled revisions become `Missed Schedule` and do not silently publish late
- controlled technical retry is limited to definitive transient failures; ambiguous outcomes remain locked for review
- final browser-closed GIGnovate release published exactly once with one Lambda invocation, zero Lambda errors, durable `Succeeded` state, one Publish History entry, and exact `View Post`
- deliberate worker re-entry on the succeeded release returned `noop / succeeded` without creating a duplicate post
- a separate pre-dispatch cancellation removed the AWS schedule and produced no publish attempt

Detailed evidence is in `docs/LEVEL_4_SCHEDULING.md`.

### Level 5 — Multi-Platform

Add social networks one at a time.

For each new adapter:

- provider access / eligibility verification
- OAuth / account selection
- direct Connect and secure Request Connection
- platform-specific form
- URL / media behavior
- validation rules
- publishing
- remote ID / URL capture
- Account Health
- browser-independent scheduling through the shared Level 4 worker
- duplicate-safe processing, retries, and worker re-entry
- automatic credential renewal where the provider supports it
- record analytics permissions and follower / subscriber metric availability for Level 8; do not build analytics UI in the adapter phase

Credential checkpoint:

- add that provider's credentials only when its adapter is being implemented

Pass condition:

- each required network must prove direct Connect, Request Connection, destination editing/validation, publishing, exact remote result/history, and browser-closed scheduling independently before its adapter is complete
- Level 6 cannot open until required adapters pass or Nicholas explicitly approves deferring a documented blocked provider; an OAuth screen alone is not completion

**Status: PLATFORM EXPANSION ACTIVE. Instagram adapter PASSED and CLOSED October 2, 2026.**

First additional provider: **Instagram Professional accounts**.

Closed phase record: `docs/LEVEL_5_INSTAGRAM.md`.

Verified closure evidence includes:

- real `@nicholasegner` Professional-account direct Connect and Resend Request Connection under the correct `Nicholas_Egner` client
- Healthy / publishable Account Health with encrypted server-side credential storage
- separate Instagram platform versions with inheritance, customization protection, reset behavior, media-mode detection, validation, and preview
- real single-image, carousel, and Reel publishing with durable provider IDs/permalinks, Publish History, Published locks, and exact `View Post`
- provider-processing resume semantics that reuse recorded carousel/Reel attempts rather than creating duplicate submissions
- private S3 remains private; Instagram receives only short-lived provider-accessible media URLs / explicit derivatives
- provider-aware scheduling reuses the Level 4 `scheduled_releases`, EventBridge Scheduler, scheduler-manager Lambda, and background worker rather than creating a second scheduling architecture
- real browser-closed scheduled Instagram publish reached `Succeeded`, persisted the exact result, cleaned up its one-time AWS trigger, and returned `noop / succeeded` on deliberate worker re-entry
- Work review confirmed stale-revision and pre-dispatch cancellation safety remain in the shared provider-neutral scheduling layer before provider dispatch

The Instagram closure did not open another phase by itself. Nicholas subsequently approved the following expansion order on October 2, 2026:

| Order | Provider | Roadmap status | Required scope / access checkpoint |
| --- | --- | --- | --- |
| Complete | Facebook Pages | Verified; preserve existing implementation | Connection, publishing, and shared scheduling |
| Complete | Instagram Professional | Verified; closed evidence record | Connection, image/carousel/Reel publishing, and shared scheduling |
| 1 | Google Business Profile | Active phase; adapter not implemented | Access approval, exact location selection, update posts, CTA links, images, scheduling |
| 2 | YouTube | Required; phase not opened | Channel selection, video/thumbnail/metadata/visibility, resumable processing and scheduling; API-upload audit restrictions |
| 3 | LinkedIn | Required; phase not opened | Personal profiles and company Pages must be tracked separately; verify the appropriate permissions and Community Management access |
| 4 | TikTok | Required; eligibility unresolved; phase not opened | Resolve Direct Post eligibility for the owner-only app before promising public publishing or scheduling |
| Optional | Pinterest | Candidate; not a Level 6 dependency unless Nicholas selects it | Board/Pin publishing; Trial versus Standard access and public visibility |
| Optional | X | Candidate; not a Level 6 dependency unless Nicholas selects it | Text/link/media publishing and scheduling; explicit API usage budget |

Current phase: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`. **L5-GBP-00 — Baseline Maintenance Checkpoint** is `DONE` after deployed maintenance and regression evidence accepted October 2, 2026. **L5-GBP-01 — Google Business Profile Access Readiness** is the sole `READY` task; OAuth and later Google tasks remain `WAITING`.

Provider approvals may require lead time. Read-only feasibility research is allowed; configure credentials only when the relevant task reaches its external checkpoint. If a required provider is blocked, document the exact limitation and obtain Nicholas's explicit decision before skipping it or opening Level 6.

### October 2 build review and maintenance follow-ups

Review baseline: `main` at `08bcc99`, before this roadmap update. These observations do not revoke the recorded live Facebook/Instagram successes:

- `npm run build`: passed.
- `npm test`: rejected `--experimental-default-type=module` under the review environment's Node 24.19.0. Direct `node --test tests/*.test.js`: 142 tests, 140 passed, 2 failed.
- Both failures are in `tests/instagram-carousel-publish-logic.test.js`: the mixed image/video fixture uses 9:16, while the current carousel validator requires 4:5 through 1.91:1. Reconcile current official provider rules, fixtures, and user-facing validation; do not weaken validation merely to make tests green.
- `npm run lint`: 2 errors and 6 warnings. Errors concern synchronous state updates in effects in `components/connections-manager.js` and `components/facebook-platform-editor.js`. Preserve verified client-switching and link-preview behavior during cleanup.
- Instagram Account Health checks do not renew its token automatically. Plan safe renewal plus proactive expiration checks; a health check is not a token refresh.
- Failure/missed-schedule email alerts, central Needs Attention, and derived aggregate Content status remain unfinished. The operational UI belongs to Level 6; failure/reconnection delivery and monitoring must be explicitly planned rather than forgotten.
- The worker has bounded polling but needs a demonstrated recovery/monitoring plan for interrupted or prolonged processing. Recovery must resume recorded provider work, never blindly repost an ambiguous outcome.
- The dashboard still describes Facebook as the first live adapter. Correct presentation copy when Level 6 opens.

Nicholas expanded L5-GBP-00 on October 2 to include Instagram credential renewal and interrupted scheduled-processing recovery alongside the baseline repairs. The active phase document defines this bounded scope. Notification delivery and broader cross-provider monitoring remain follow-ups; review operational readiness before Level 6 opens.

### Future blog / website destination

Blog publishing is an explicit later expansion, after required social-platform coverage and the core workflow. It is not active and is not a Level 6 dependency. Preserve the existing Master Content -> destination version model with a website connector/API. Initial fields should include title, slug, excerpt, Markdown body, hero image/alt text, SEO title/description, draft/publish state, release time, and returned live URL. Keep website credentials server-side and avoid coupling every website to one database technology. `README_GIGNOVATE_PLATFORM.md` remains a longer-term direction note; this README controls implementation scope.

### Level 6 — Workflow + Calendar

**WAITING — required platform expansion and operational-readiness review must finish first.** A blocked required platform needs Nicholas's explicit deferral decision. Provider-specific publishing forms and previews remain part of Level 5; the full Calendar/Dashboard workflow stays here.

Build:

- automated content status
- visual calendar
- Content filters/views
- Needs Attention
- Dashboard operational summaries
- All Clients row-per-client dashboard

### Level 7 — Client Approval

Build:

- secure approval page
- per-platform approval
- Request Edit comments
- revisions
- automatic reapproval emails
- approval audit history
- dashboard approval changes / alerts

### Level 8 — Engagement + Analytics + Attribution

Build:

- native platform metrics
- audience growth
- new-comment engagement alerts where supported
- `Mark Reviewed`
- UTM generation
- GA4 integration
- selected-client analytics
- All Clients summaries

### Level 9 — Reporting

Build:

- Report Hub
- 7 / 30 / 60 / 90-day presets
- custom From / To range
- platform filters
- PDF export
- on-demand Resend delivery

### Level 10 — Optional Intelligence / Expansion

- optional provider-agnostic AI assistance
- blog / website publishing through a destination connector/API
- optional networks beyond the required Level 5 providers
- team / client user roles if real usage requires them
- more advanced engagement capabilities only if needed
- automatic recurring reports only if they become useful
- only add larger advanced features after real usage proves the need

---

## Locked Product Principles

1. **Master Content is the core object.** Social posts are platform-specific distributions of that package.
2. **One app, two contexts.** `All Clients` and `Selected Client` are views of the same system.
3. **Content is the library; Create Content is the action.** Keep the management area separate from the creation trigger.
4. **Client creation stays lightweight.** Do not turn this into another CRM.
5. **Connections persist.** OAuth connections are saved to the correct client/destination until revoked or reauthorization is required.
6. **Clients never give us social passwords.** Authentication happens on the provider's OAuth page.
7. **Resend automates important communication without creating noise.** Connection, approval, revision, alert, and report loops should require as little manual follow-up as possible.
8. **The Dashboard is operational.** Problems, changes, upcoming work, comments, audience growth, and client-by-client status should be visible quickly.
9. **Master defaults, platform overrides.** Platform-specific work is protected from accidental Master overwrites.
10. **Validation is live.** No separate required Preflight button.
11. **Statuses are automated.** The system reflects observable state rather than relying on manual workflow maintenance.
12. **Approval belongs to a revision.** Edited approved content must be reapproved.
13. **Publishing is destination-specific.** One platform failure must not duplicate or block successful destinations.
14. **Remote post references are captured automatically.** Successful publishing should provide `View Post` without manual URL entry.
15. **MongoDB is the application system of record.** S3 stores media; AWS background services handle timed work.
16. **The native calendar is authoritative.** External calendar sync, if added, is only a convenience view.
17. **Engagement alerts stay lightweight in V1.** Surface new comments and link to the live post rather than building a full social inbox.
18. **Reusable content stays lightweight.** Save for reuse and create a fresh version; no automatic recycling engine in V1.
19. **Reports are on demand in V1.** Preset and custom date ranges matter more than automatic monthly delivery initially.
20. **Team roles are not a V1 requirement.** The operator has full access; clients use secure limited-purpose links.
21. **AI is optional.** The app must remain fully functional without it.
22. **Build in testable slices.** Do not attempt the complete product in one implementation pass, and add social-network credentials only as each adapter is reached.

---

## Project Management and Chat Delegation Workflow

This repository uses two different kinds of ChatGPT sessions. Keeping their responsibilities separate prevents a narrow implementation task from silently changing the product plan.

### Work session: product manager and architect

The Work session owns the product-level view. It should:

- maintain this README as the master roadmap and verified project checkpoint
- decide the active level, dependencies, acceptance criteria, and task order
- create or update the active phase document in `docs/`
- break a phase into small implementation tasks that can be tested independently
- maintain an ordered task queue in the active phase document and mark only the next bounded task `READY`
- review the implementation Chat's handoff and decide whether the checkpoint passed
- update the README only after a result is verified

### Implementation Chat: scoped delivery worker

An implementation Chat selects its work from the active phase document. It does not need the user to restate the assignment. It must:

1. Read this README in full.
2. Open the `active_phase_document` named in **AI / Work Handoff Context**.
3. Select the first task marked `READY`. That task ID and its acceptance criteria become the complete assignment.
4. Inspect the relevant implementation and existing uncommitted changes.
5. Restate the current checkpoint, selected task, acceptance criteria, and progress-log location before editing code.
6. Implement only that one `READY` task. Do not begin `WAITING`, `BLOCKED`, or later-level work.
7. Run the relevant automated checks and identify any live or manual test still required.
8. Update the task status and append evidence to the active phase document when repository edits are authorized.
9. Return the required handoff report below and stop.

If no task is marked `READY`, or if the README and phase document disagree, stop and ask the user or Work session for direction. Do not select work by guessing.

### What each project document means

| Location | Purpose | Who maintains it |
| --- | --- | --- |
| `README.md` | Master product plan, locked principles, verified level status, active stage, and operating rules | Work session |
| `docs/LEVEL_*.md` | Phase workbook: scope and acceptance criteria first, then implementation notes, test evidence, decisions, blockers, and final completion record | Work session plans it; authorized implementation Chats add task evidence |
| Chat handoff | Immediate report of exactly what changed and what still needs verification | Implementation Chat |

A phase document is not merely a historical log. It begins as the approved plan for that phase and becomes the durable completion record as its tasks are implemented and verified. Code existing is not enough to mark a checkpoint complete; the documented pass condition must be demonstrated.

Task statuses have fixed meanings:

- `DONE`: implemented and supported by the recorded verification evidence
- `READY`: the next bounded task an implementation Chat should select automatically
- `WAITING`: planned, but dependent on an earlier task or checkpoint
- `BLOCKED`: cannot proceed until a named problem or external requirement is resolved
- `MANUAL`: requires the user to perform or participate in a live external-system test

There should normally be only one `READY` task. This keeps separate implementation Chats from independently choosing overlapping work.

### Required implementation handoff

Every implementation Chat must end with this information, even when the task is blocked:

```text
Task: <task ID and title selected from the active phase document>
Result: complete | partially complete | blocked
Files changed: <paths or none>
Checks run: <commands and results>
Live/manual verification: <completed evidence or exact remaining steps>
Phase document updated: <path and section, or not authorized>
Decisions made: <only decisions inside the assigned scope>
Open risks or blockers: <items or none>
Git state: <branch, commit if authorized, and whether push is still needed>
Recommended next task: <one bounded follow-up, not an entire phase>
```

An implementation Chat must not mark a level complete in this README. It reports evidence to the Work session, which decides whether the checkpoint passed and updates project status.

### Starting a new implementation Chat

The user does not need to write a separate assignment. Start the new Chat with this instruction:

> Read `README.md` in full, especially **Implementation Status**, **Project Management and Chat Delegation Workflow**, **Locked Product Principles**, and **AI / Work Handoff Context**. Open the named `active_phase_document`, select its first `READY` task, and treat that task and its acceptance criteria as your complete assignment. Confirm what you selected and where progress will be recorded before changing code. Complete only that task, test it, update the authorized phase record, and finish with the README's required implementation handoff.

Current delegation state:

- Completed product stages: **Levels 0–4 plus Level 5 Instagram — Instagram reviewed and closed October 2, 2026**
- Active product stage: **Level 5 platform expansion — Google Business Profile**
- Active phase document: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`
- Provider selected: **Google Business Profile**
- Current task: **L5-GBP-01 — Google Business Profile Access Readiness (`READY`)**
- Objective: verify non-secret Google project/API access readiness, prerequisites, OAuth configuration plan, and the exact eligible test client/location without implementing OAuth
- Live-test client/location: **unconfirmed**; confirm an eligible client and exact Google location during `L5-GBP-01`, never guess
- Progress must be documented in: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`
- Access readiness is `READY`; OAuth, Request Connection, publishing, and scheduling tasks remain `WAITING`
- Level 6 is held until required platform coverage and operational readiness are reviewed

---

## AI / Work Handoff Context

This section exists to give a new ChatGPT / Work session a compact, machine-readable project snapshot. It does **not** replace the rest of this README. A new work session should read the full README before proposing architecture or implementation changes.

```yaml
project:
  name: Content Social Hub
  repository: egnica/content-social-hub
  default_branch: main
  status: level_5_platform_expansion_google_business_profile
  source_of_truth: README.md
  active_phase_document: docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md
  active_phase_document_status: open

current_infrastructure:
  framework: Next.js
  hosting: AWS Amplify
  app_url: https://main.d1yfjibipwjpld.amplifyapp.com/
  database: MongoDB
  media_storage:
    provider: AWS S3
    bucket: content-social-hub-media
    region: us-east-2
    public_access: blocked
    encryption: SSE-S3
  email: Resend
  scheduled_publishing:
    eventbridge_scheduler: deployed_verified
    scheduler_manager_lambda: deployed_verified
    scheduled_release_worker: deployed_verified
    worker_configuration: Secrets Manager
    sqs: not_used_not_currently_required

product_model:
  hierarchy:
    - Client
    - Master Content
    - Destination / Platform Version
  master_content_rule: Master Content stores shared source assets and defaults; each destination version can inherit and independently override those defaults.
  platform_version_storage: separate_mongodb_collection
  application_contexts:
    - All Clients
    - Selected Client
  top_level_navigation:
    - Dashboard
    - Content
    - Calendar
    - Approvals
    - Reports
    - Clients
    - Analytics
    - Social Accounts
  create_content_action: prominent + Create Content action separate from the Content library

v1_operator_model:
  authenticated_operator: owner_only
  client_login_accounts: false
  client_interaction:
    - secure social-account connection links
    - secure approval links
  team_roles_v1: false

dashboard:
  purpose: operational command center
  all_clients:
    global_summary: true
    row_per_client: true
    row_fields:
      - needs_attention
      - new_comments
      - audience_growth
      - upcoming_posts
      - approvals
      - recent_publish_activity
    actionable_counts: true
  selected_client_sections:
    - Needs Attention
    - New Comments
    - Audience Growth
    - Today's / Upcoming Schedule
    - Approvals
    - Account Health Problems
    - Recent Activity
    - Lightweight Analytics Snapshot

notifications:
  surfaces:
    - dashboard alerts
    - in-app notification center
    - Resend email for higher-value events
  email_for_routine_successful_publish: false
  important_events:
    - failed publish
    - requested edits
    - approval completion when useful
    - reconnection required
    - missed schedule
    - completed connection request
    - report delivery failure
  email_notification_log: true

engagement:
  full_social_inbox_v1: false
  new_comment_alerts: true
  view_exact_live_post: true
  mark_reviewed: true
  replies_inside_app_v1: false
  direct_messages_v1: false
  remote_post_url_manual_entry_required: false
  remote_post_id_and_url_capture: automatic_after_successful_publish

audience_growth:
  dashboard_feature: true
  primary_metric: follower_or_subscriber_count_change
  individual_follower_identity_required: false
  adapter_rule: add follower/subscriber metrics when each network supports them

reporting:
  automatic_monthly_reports_v1: false
  report_hub: true
  presets:
    - 7_days
    - 30_days
    - 60_days
    - 90_days
  custom_from_to_range: true
  default_range: 30_days
  platform_filters: true
  actions:
    - Download PDF
    - Send Report via Resend

social_connections:
  multiple_accounts_per_platform: true
  connect_paths:
    - Connect Myself via provider OAuth
    - Request Connection via secure Resend link
  client_social_passwords_collected: false
  secure_invite_default_expiration: approximately_48_hours
  reconnect_uses_same_secure_flow: true
  account_health_states:
    - Healthy
    - Expiring Soon
    - Expired
    - Disconnected
    - Permission Problem
    - API Error
  facebook_pages:
    level_2_complete: true
    direct_connect_deployed: true
    direct_connect_verified: true
    request_connection_implemented: true
    request_connection_end_to_end_verified: true
    secure_request_link_lifecycle_verified: true
    completed_link_reuse_blocked: true
    replacement_link_revocation_verified: true
    operator_facebook_login_is_authorization_identity_not_client_destination: true
    saved_destination_is_page: true
    saved_page_is_scoped_by_client_id: true
    selected_page_recovery:
      preferred_source: Meta token granular_scopes target_ids
      capability_source: /me/accounts Page tasks merged by Page ID
    verified_mappings:
      - client: Andrew_Davis
        page: Davis Criminal Defense
        health: Healthy
      - client: Let_Us_Clean
        page: Let Us Clean LLC
        health: Healthy
      - client: Nicholas_Egner
        page: GIGnovate
        health: Healthy
        connection_path: Request Connection via Resend
    verified_client_switching: true
    resolved_issues:
      direct_target_page_lookup_tasks_field: resolved_2026_09_28
      stale_client_connection_display: resolved_2026_09_19
      stale_request_revocation_display: resolved_2026_09_28
    relevant_commits:
      - f10e510 Recover selected Facebook Pages from token targets
      - cfe022c Fix selected Facebook Page recovery
      - 40f100a Sync social accounts when client changes
      - 1737fbaf Fix Facebook Page capability lookup
      - 30cbbcdd Restore Facebook Page publish capability
      - 0c66f338 Document L2-05 Request Connection verification
      - d4b569c1 Sync revoked connection request status
      - 446374e6 Document L2-06 token lifecycle verification
  instagram:
    phase_active: false
    level_5_complete: true
    work_review_passed: true
    closed_on: 2026-10-02
    professional_accounts_only: true
    login_path: Instagram Login / Business Login for Instagram
    linked_facebook_page_required: false
    direct_connect_status: verified
    request_connection_status: verified
    account_health_status: verified_healthy_publishable
    platform_version_status: verified
    single_image_publish_status: verified
    carousel_publish_status: verified
    reel_publish_status: verified
    scheduled_publish_status: verified_browser_closed
    scheduled_worker_reentry_status: verified_noop_after_success
    verified_mapping: Nicholas_Egner -> @nicholasegner
    analytics_ui_status: deferred_level_8
  google_business_profile:
    phase_active: true
    adapter_status: not_implemented
    access_status: unverified
    live_test_client: unconfirmed
    live_test_location: unconfirmed

content_and_publishing:
  client_delete_with_saved_content: blocked
  master_content_delete_preserves_s3_media: true
  platform_versions_separate_records: true
  publish_attempts_durable_records: true
  level_3_complete: true
  level_4_complete: true
  level_5_instagram_complete: true
  level_5_platform_expansion_complete: false
  facebook_text_link_publish_verified: true
  facebook_image_publish_verified: true
  facebook_video_publish_verified: true
  publish_history_live_verified: true
  level_3_approval_gate_enabled: false
  workflow_status_manual: false
  status_is_derived: true
  approval_scope: destination_revision
  edit_after_approval_invalidates_only_that_destination_approval: true
  publish_destinations_independently: true
  retry_failed_destination_only: true
  duplicate_protection_required: true
  final_publish_confirmation_required: true
  live_validation_not_preflight_button: true
  schedule_default_on_master_with_destination_overrides: true
  scheduling_phase_active: false
  client_timezone_scheduling_verified: true
  background_scheduled_publishing_verified: true
  browser_closed_scheduling_verified: true
  missed_schedule_behavior_verified: true
  pre_dispatch_cancel_verified: true
  worker_reentry_duplicate_noop_verified: true
  human_blocker_at_schedule_time: mark_missed_schedule_do_not_publish_late
  temporary_technical_failure: controlled_automatic_retry

media:
  upload_to_s3_immediately: true
  bucket_private: true
  originals_preserved: true
  multiple_images: true
  reorder_images: true
  default_video_thumbnail_or_cover: true
  database_stores_s3_reference_and_metadata: true
  separate_bucket_per_client: false
  cloudfront_v1: false
  lifecycle_auto_delete_v1: false
  publishing_rule: transfer media server-side or provide short-lived signed provider access; do not make S3 public

tracking_and_analytics:
  standard_utm_tracking: true
  utm_medium_default: organic-social
  ga4_attribution_planned: true
  preserve_platform_native_metric_definitions: true

v1_exclusions:
  - Campaign management
  - Content categories / pillars
  - complex evergreen recycling queues
  - separate Content Hub integration
  - full social inbox / unified messaging
  - replying to comments inside the app
  - direct-message management
  - social listening
  - competitor monitoring
  - paid-ad management
  - built-in graphic editor
  - link-in-bio product
  - client login accounts
  - complex team-role permission matrix
  - automatic scheduled monthly reports
  - mandatory AI

implementation:
  strategy: small_testable_vertical_slices
  configure_all_social_apis_up_front: false
  add_social_networks_one_at_a_time: true
  completed_levels:
    - level_0_foundation
    - level_1_client_content_foundation
    - level_2_first_social_connection
    - level_3_first_publisher
    - level_4_scheduling
    - level_5_instagram
  current_stage: level_5_google_business_profile
  active_phase_document: docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md
  current_task: L5-GBP-01
  current_task_status: READY
  level_5_provider_selected: google_business_profile
  required_remaining_provider_order:
    - google_business_profile
    - youtube
    - linkedin
    - tiktok
  optional_providers:
    - pinterest
    - x
  level_6_gate: required_adapters_verified_or_explicitly_deferred_by_Nicholas_and_operational_readiness_reviewed
  future_blog_destination: planned_later_not_active
  level_5_phase_document_created: true
  level_5_instagram_work_review: passed_2026_10_02
  level_5_platform_expansion_status: open
  verified_instagram_live_test_client: Nicholas_Egner
  verified_instagram_live_test_destination: "@nicholasegner"
  google_business_profile_live_test_client: unconfirmed
  google_business_profile_live_test_location: unconfirmed
  level_5_instagram_task_order:
    - L5-01 DONE Instagram connection / OAuth / Account Health foundation
    - L5-02 DONE Instagram Request Connection + client-scoped live verification
    - L5-03 DONE Instagram destination/platform version/validation/preview
    - L5-04 DONE single-image Instagram publishing
    - L5-05 DONE Instagram carousel publishing
    - L5-06 DONE Instagram Reels/video publishing
    - L5-07 DONE Instagram background scheduling + final checkpoint
  first_major_end_to_end_milestone:
    status: completed_level_3
    steps:
      - create_client
      - create_master_content
      - upload_media_to_s3
      - connect_one_social_account
      - create_destination_version
      - live_validate
      - publish_now
      - save_remote_post_id_and_url
      - view_post_opens_exact_live_post
  credential_checkpoints:
    level_0: MongoDB connection
    level_1: S3 and Amplify permissions
    level_2: first social provider OAuth credentials plus Resend
    level_4: EventBridge Scheduler and Lambda permissions/configuration; SQS not required by the completed implementation
    level_5_instagram: completed_configuration_and_live_verification
    level_5_google_business_profile: verify_API_access_eligibility_project_approval_exact_location_and_OAuth_configuration_in_L5_GBP_01_before_L5_GBP_02

architecture_rules:
  application_source_of_truth: MongoDB
  media_source: S3
  timed_work: AWS background services
  long_lived_social_credentials: server_side_only
  social_connection_scope: per_client_and_destination_not_global_operator_account
  resend_role: delivery_layer_not_business_logic
  dynamodb_without_concrete_need: false
  ai_required_for_core_product: false

work_session_rules:
  read_full_readme_first: true
  work_owns_product_roadmap_and_verified_status: true
  implementation_chat_selects_first_ready_task_from_active_phase_document: true
  implementation_chat_completes_one_ready_task_per_session: true
  active_phase_document_is_plan_and_completion_record: true
  implementation_chat_must_return_required_handoff: true
  implementation_chat_must_not_mark_level_complete: true
  preserve_locked_product_decisions_unless_user_reopens_them: true
  build_incrementally: true
  stop_at_checkpoint_and_test_before_next_level: true
  stop_when_new_external_credentials_are_required_and_walk_user_through_setup: true
  never_commit_secrets: true
  github_read_and_diagnose_without_confirmation: allowed
  github_create_edit_delete_commit_push_rename_or_modify: requires_explicit_user_confirmation

next_expected_action:
  goal: Complete Google Business Profile access-readiness verification and confirm the exact eligible test destination before OAuth implementation.
  task_source: docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md
  selection_rule: select_only_the_first_READY_task_and_preserve_user_GitHub_write_confirmation_rules
  active_task: L5-GBP-01
  do_not_jump_ahead_to:
    - Level 6 Workflow / Calendar until required providers pass or Nicholas explicitly defers documented blockers and Work reviews operational readiness
    - L5-GBP-02 or later Google tasks before the access-readiness checkpoint passes
    - YouTube / LinkedIn / TikTok implementation before its own phase is deliberately opened
    - optional X / Pinterest or blog publishing before Nicholas selects their phase
    - Level 7 approvals before that phase is deliberately opened
    - Level 8 analytics/engagement before that phase is deliberately opened
    - optional AI
  level_2_checkpoint: passed_and_closed_2026_09_28
  level_3_checkpoint: passed_and_closed_2026_09_29
  level_4_checkpoint: passed_and_closed_2026_09_30
  level_5_instagram_checkpoint: passed_and_closed_2026_10_02
  level_5_platform_expansion_checkpoint: pending
```

### Instructions for the next work session

Read this README in full before beginning implementation. Follow **Project Management and Chat Delegation Workflow**. Treat decisions marked as locked or explicitly described as V1 scope as the current product direction unless the user asks to revisit them.

Levels 2, 3, 4, and the Level 5 Instagram adapter are closed. Broader Level 5 platform expansion is active. Do not reopen or rebuild the working Facebook or Instagram connection, publishing, or shared scheduling architecture unless a specific regression is demonstrated. The verified system now includes client-scoped OAuth/Request Connection, encrypted provider credentials, Account Health, destination-specific Facebook and Instagram editors, private-S3 provider transfer, durable provider results and Publish History, duplicate protection, exact `View Post`, client-timezone scheduling, EventBridge/Lambda background execution, missed-schedule behavior, controlled retry rules, and browser-closed scheduled publishing with real Facebook and Instagram results.

`docs/LEVEL_5_INSTAGRAM.md` remains a closed evidence record. The active phase is `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`; `L5-GBP-00` (Baseline Maintenance Checkpoint) is `DONE` with deployed evidence accepted October 2, 2026, and `L5-GBP-01` (Google Business Profile Access Readiness) is the sole `READY` task. Complete access readiness before OAuth implementation. Preserve explicit user authorization requirements for repository writes; a `READY` task does not waive them.

Instagram is now proven through Instagram Login / Business Login for Instagram with a real Professional account. Preserve Instagram as its own `social_connections` record under the selected Content Social Hub client rather than treating it as a field on the Facebook Page connection.

Preserve private media. Do not make `content-social-hub-media` public for any provider. The verified Instagram path uses short-lived provider access / explicit derivatives while the database continues storing private S3 references.

Preserve the Level 3 idempotency/result boundary and Level 4 schedule safety now shared by Facebook and Instagram. Any future provider should reuse those verified provider-independent seams rather than bypassing them or triggering a speculative broad refactor.

Do not open Level 6 Workflow + Calendar until required platform coverage and operational readiness pass review, or Nicholas explicitly defers a documented blocked provider. Do not invent fake approval state; client approvals remain Level 7. Do not pull analytics, follower metrics, comment management, messaging, or reporting forward from Level 8/9 merely because Instagram exposes those APIs.

Add social networks one at a time. Instagram has passed that full connection / publishing / background-scheduling bar. A future provider is not complete merely because an OAuth screen or UI exists; it must meet the same end-to-end evidence standard before closure.

Do not introduce new infrastructure solely because it is available. Prefer the architecture already established here unless a concrete implementation problem requires a change.

Never commit secrets to the repository. Never modify, create, delete, rename, commit, or push repository content without the user's explicit approval for that change.

**Next expected work:** read `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md` and complete **L5-GBP-01 — Google Business Profile Access Readiness**. Confirm the exact eligible test client/location and inspect the non-secret Google project/API approval, prerequisites, enabled APIs, OAuth scopes/callback/consent plan, and location-selection mechanism. Do not implement OAuth in this task. L5-GBP-00 is closed; actual Instagram renewal/recovery edge-case live proofs and broader carousel-video ratio evidence remain explicitly deferred as recorded in the phase document.


Maintenance verification runtime: Node **24.19.0** (`npm test`, `npm run lint`, `npm run build`). See the active phase document for complete local evidence, retained runtime warnings, manual checkpoints, and deployment constraints. New renewal/recovery behavior is prepared locally; it is not yet deployed or proven live.
