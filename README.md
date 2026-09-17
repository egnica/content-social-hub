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

Levels 0 and 1 are implemented, deployed, and verified in the live application.

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

Verified in the deployed application:

- MongoDB health, reads, and writes
- client creation, editing, filtering, and client separation
- Master Content creation, editing, saving, reopening, and Save for Reuse
- private image and video uploads to S3
- multiple media attachments, ordering, and default primary-media selection
- browser-detected media metadata and persistence after reopening
- Amplify SSR compute-role access to the private media bucket
- S3 CORS for secure browser uploads from the Amplify application

Environment, S3 CORS, and runtime IAM requirements are documented in `docs/LEVEL_0_1_SETUP.md`.

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
- permanent client deletion is allowed only when the client has zero saved Master Content packages
- if Content exists, deletion is blocked and the operator must archive the client or delete its Content first
- the application never silently orphans Content by removing its client

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
- Lambda — perform background publishing
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

- add only the first social network's API credentials / OAuth configuration
- add Resend configuration needed for application mail

Pass condition:

- connect a real destination account and persist the correct account under the correct client

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

This is the first major end-to-end milestone.

### Level 4 — Scheduling

Build:

- default Master schedule
- per-platform overrides
- EventBridge / Lambda background publishing
- SQS where useful for reliable queued execution / retries
- missed-schedule behavior

Credential / infrastructure checkpoint:

- configure AWS permissions and environment values required for EventBridge, Lambda, and SQS

Pass condition:

- schedule a real post, close the browser, and verify background publishing occurs correctly

### Level 5 — Multi-Platform

Add social networks one at a time.

For each new adapter:

- OAuth / account selection
- platform-specific form
- URL / media behavior
- validation rules
- publishing
- remote ID / URL capture
- Account Health
- analytics permissions where appropriate
- follower / subscriber metrics where supported

Credential checkpoint:

- add that provider's credentials only when its adapter is being implemented

Pass condition:

- each network must connect and publish independently before another adapter is treated as complete

### Level 6 — Workflow + Calendar

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
- additional networks
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

## AI / Work Handoff Context

This section exists to give a new ChatGPT / Work session a compact, machine-readable project snapshot. It does **not** replace the rest of this README. A new work session should read the full README before proposing architecture or implementation changes.

```yaml
project:
  name: Content Social Hub
  repository: egnica/content-social-hub
  default_branch: main
  status: level_0_1_deployed_and_verified
  source_of_truth: README.md

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
  scheduled_publishing_planned:
    - EventBridge Scheduler
    - Lambda
    - SQS where retries or queue reliability require it

product_model:
  hierarchy:
    - Client
    - Master Content
    - Destination / Platform Version
  master_content_rule: Master Content stores shared source assets and defaults; each destination version can inherit and independently override those defaults.
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

content_and_publishing:
  client_delete_with_saved_content: blocked
  master_content_delete_preserves_s3_media: true
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
  current_next_stage:
    - level_2_first_social_connection
  first_major_end_to_end_milestone:
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
    level_4: EventBridge Lambda and SQS permissions/configuration
    level_5: each additional provider added individually

architecture_rules:
  application_source_of_truth: MongoDB
  media_source: S3
  timed_work: AWS background services
  long_lived_social_credentials: server_side_only
  resend_role: delivery_layer_not_business_logic
  dynamodb_without_concrete_need: false
  ai_required_for_core_product: false

work_session_rules:
  read_full_readme_first: true
  preserve_locked_product_decisions_unless_user_reopens_them: true
  build_incrementally: true
  stop_at_checkpoint_and_test_before_next_level: true
  stop_when_new_external_credentials_are_required_and_walk_user_through_setup: true
  never_commit_secrets: true
  github_read_and_diagnose_without_confirmation: allowed
  github_create_edit_delete_commit_push_rename_or_modify: requires_explicit_user_confirmation

next_expected_action:
  goal: Implement and verify Level 2 with one social network only
  do_not_jump_ahead_to:
    - multiple social-provider integrations
    - scheduling infrastructure before the first publisher is proven
    - analytics before publishing pipeline exists
    - optional AI
  first_checkpoint: connect one real destination account and persist the correct account under the correct client
```

### Instructions for the next work session

Read this README in full before beginning implementation. Treat decisions marked as locked or explicitly described as V1 scope as the current product direction unless the user asks to revisit them.

Build incrementally and stop at implementation checkpoints for real testing. When a new external API, OAuth application, secret, AWS permission, or environment variable becomes necessary, explain exactly what is required and walk the user through that setup at that point rather than collecting every credential in advance.

Add social networks one at a time. A provider is not considered complete merely because an OAuth screen or UI exists; its relevant checkpoint must work end to end before expanding to the next provider.

Do not introduce new infrastructure solely because it is available. Prefer the architecture already established here unless a concrete implementation problem requires a change.

Never commit secrets to the repository. Never modify, create, delete, rename, commit, or push repository content without the user's explicit approval for that change.

**Next expected implementation work:** begin Level 2 with one social network only. Implement and verify its OAuth connection, Connect and Request Connection paths, secure expiring setup page, Resend delivery, account picker, saved connection, and initial Account Health before beginning Level 3 publishing.
