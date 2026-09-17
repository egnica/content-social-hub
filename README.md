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

### All Clients View

Shows activity across every client.

Examples:

- all content
- all scheduled posts
- all approvals
- account-health issues
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

When a client is selected, Content, Calendar, Analytics, Social Accounts, and related screens show only that client's data.

Future client users can be restricted to their own client context and never see `All Clients`.

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
- automated monthly reports

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

## Content

The top-level **Content** area is the operational home for saved Master Content packages.

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
- capture post IDs and live URLs when available
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

## Dashboard and Automated Reports

Analytics can be shown in both:

- selected-client dashboards
- All Clients summaries

Possible client metrics:

- posts published
- video views
- impressions / reach where available
- engagements
- link clicks
- website visits attributed to social
- tracked website conversion / form events where available

Monthly reports should be generated automatically and delivered through Resend to the client's Approval / Report Email.

Reports should be based on the same stored analytics used by the dashboard.

---

## Resend

Resend is the application's outbound email layer for:

- account-connection requests
- reconnect requests
- approval requests
- revision / reapproval notifications
- monthly reports
- important account-health or publishing alerts where appropriate

Connection and approval emails should link back to secure, limited-purpose application pages rather than directly exposing privileged application routes.

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
- social inbox / unified messaging
- social listening
- competitor monitoring
- paid-ad management
- built-in graphic editor
- link-in-bio product
- complex team-role permission matrix
- mandatory AI features

---

## Current Technical Direction

```text
Next.js / Amplify
  -> application UI and server routes

MongoDB
  -> clients
  -> Master Content
  -> platform versions
  -> approvals / revisions
  -> schedules
  -> connections
  -> publishing results
  -> analytics

S3
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

Do not add DynamoDB merely because the project is hosted on AWS unless a concrete need appears later.

---

## Implementation Strategy

The application must be built incrementally. Every phase should leave a working product that can be tested before the next phase begins.

### Level 0 — Foundation

- application shell
- auth
- MongoDB connection
- deployment stability

### Level 1 — Client + Content Foundation

- lightweight clients
- Content area
- Master Content
- local upload to S3
- multiple images
- video upload
- media metadata / intelligence
- internal title
- Save for reuse

### Level 2 — First Social Connection

- one network OAuth flow
- Connect path
- Request Connection path
- secure expiring setup page
- Resend email
- account picker
- saved connection
- initial Account Health

### Level 3 — First Publisher

- first platform-specific editor
- live validation
- live preview
- Publish Now
- duplicate protection
- result logging
- retry handling

### Level 4 — Scheduling

- default Master schedule
- per-platform overrides
- EventBridge/Lambda background publishing
- reliable retries
- missed-schedule behavior

### Level 5 — Multi-Platform

- additional platform adapters
- platform-specific forms
- URL metadata preview
- media/thumbnail overrides
- destination-account selection

### Level 6 — Workflow + Calendar

- automated content status
- visual calendar
- Content filters/views
- Needs Attention

### Level 7 — Client Approval

- secure approval page
- per-platform approval
- Request Edit comments
- revisions
- automatic reapproval emails
- approval audit history

### Level 8 — Analytics + Attribution

- native platform metrics
- UTM generation
- GA4 integration
- client dashboard

### Level 9 — Reporting

- monthly client reports
- automatic Resend delivery

### Level 10 — Optional Intelligence / Expansion

- optional provider-agnostic AI assistance
- additional networks
- only add larger advanced features after real usage proves the need

---

## Locked Product Principles

1. **Master Content is the core object.** Social posts are platform-specific distributions of that package.
2. **One app, two contexts.** `All Clients` and `Selected Client` are views of the same system.
3. **Client creation stays lightweight.** Do not turn this into another CRM.
4. **Connections persist.** OAuth connections are saved to the correct client/destination until revoked or reauthorization is required.
5. **Clients never give us social passwords.** Authentication happens on the provider's OAuth page.
6. **Resend automates client communication.** Connection, approval, revision, and reporting loops should require as little manual follow-up as possible.
7. **Master defaults, platform overrides.** Platform-specific work is protected from accidental Master overwrites.
8. **Validation is live.** No separate required Preflight button.
9. **Statuses are automated.** The system reflects observable state rather than relying on manual workflow maintenance.
10. **Approval belongs to a revision.** Edited approved content must be reapproved.
11. **Publishing is destination-specific.** One platform failure must not duplicate or block successful destinations.
12. **MongoDB is the application system of record.** S3 stores media; AWS background services handle timed work.
13. **The native calendar is authoritative.** External calendar sync, if added, is only a convenience view.
14. **Reusable content stays lightweight.** Save for reuse and create a fresh version; no automatic recycling engine in V1.
15. **AI is optional.** The app must remain fully functional without it.
16. **Build in testable slices.** Do not attempt the complete product in one implementation pass.
