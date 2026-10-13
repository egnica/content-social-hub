# Level 5 — YouTube

Active phase for Content Social Hub beginning October 13, 2026, by Nicholas's explicit decision to continue required social-platform coverage **without manufacturing posts on his live LinkedIn account**. Source of truth: `README.md`. Previous LinkedIn implementation, owner-approved review and outstanding real-post verification: `docs/LEVEL_5_LINKEDIN.md`. Paused Google API case: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`.

## Phase state

- **Status:** OPEN — access readiness only; **no YouTube integration implemented or verified**.
- **Active phase document:** `docs/LEVEL_5_YOUTUBE.md`
- **First and sole READY task:** `L5-YT-01 — YouTube API & Channel Access Readiness`
- **Provider:** `youtube` (proposed internal adapter key; verify existing code conventions before implementation).
- **Target Content Social Hub client:** UNCONFIRMED.
- **Exact YouTube channel identity:** UNCONFIRMED. Require Nicholas to select/approve the actual channel to avoid posting to the wrong one.
- **Google Cloud project / YouTube Data API entitlement / OAuth client and consent configuration:** UNVERIFIED. Do not assume the existing Google Business Profile application approval or credentials grant YouTube publishing.
- **Live publish / schedule:** NOT TESTED. No test-only upload required during access-readiness work.
- **Outstanding parallel checkpoints:** LinkedIn `L5-LI-06 MANUAL`, `L5-LI-07 MANUAL`, `L5-LI-03 BLOCKED` (Company Page approval). Google Business Profile `L5-GBP-01 MANUAL` pending API approval. TikTok follows YouTube in the required platform queue. Level 6 is not open.

## Scope and locked boundaries

Implement a client-owned YouTube **channel** destination, preserving one Master Content and independently editable destination versions, server-side credentials, private S3 media, durable publish attempts and remote video IDs/links, provider processing states, exact `View Post`, and the existing Level 4 scheduler and background worker. YouTube is video-first: do not assume Facebook-style text/image-only posts are valid YouTube destinations. Requirements from README include channel identity, supported long-form video and thumbnail, title/description, visibility/privacy and required audience declarations, optional compatible chapter timestamps, resumable or recoverable video upload/processing, quotas/audit/verification constraints, and browser-closed scheduling without duplicate video uploads.

- No new scheduling architecture, global-account credential sharing, public S3 bucket, unapproved public uploads, channel creation or live posting just to test.
- Separate YouTube ownership, selected channel identity and upload privileges. Verify whether a user can manage multiple YouTube channels and how the channel is safely chosen. A Google sign-in alone does not prove upload authorization to a particular channel.
- Confirm current official YouTube Data API/Google OAuth documentation for scopes, Google Cloud project verification, testing-mode refresh expiry, quota allocation, upload restrictions (including possible privacy limitations for unaudited projects), processing status and supported thumbnails before coding or promising public publication.
- Design for large private-S3 video objects: bounded/resumable transfer, durable upload session, provider state polling/recovery and safe idempotency. A completed upload is not the same as a fully processed and publicly visible video. Never retry an uncertain create/upload from scratch without reconciliation.
- Retain platform-specific metadata, including YouTube title, description, visibility, optional thumbnail and compatible chapters; validate provider limits and required `madeForKids`/audience declarations from current specifications before enabling publication.
- Resend email Request Connection is an existing proven pattern. Keep client-facing OAuth limited purpose; never expose credentials. Analytics permissions can be recorded for later Level 8 but no analytics UI, content calendar rewrite, creator AI generation, comment management or unrelated provider work belongs in this phase.
- Link YouTube completion to verified evidence, or secure explicit owner approval for each documented exception. Facebook/Instagram regressions must remain protected. Level 6 stays gated on remaining required adapters or explicit owner decisions plus operational-readiness review.

## Ordered task queue

| ID | Status | Task | Acceptance checkpoint |
| --- | --- | --- | --- |
| L5-YT-01 | `READY` | YouTube API & Channel Access Readiness | Current official requirements researched; correct intended Google/YouTube channel and client selected or clearly marked MANUAL; API entitlement, Google Cloud/OAuth consent, upload quota/audit/privacy restrictions and required scopes identified; non-secret configuration plan and named blockers recorded |
| L5-YT-02 | `WAITING` | Channel OAuth, Account Health, reconnect | Explicit selected channel identity, secure client-scoped tokens, refresh/expiry health and safe same-channel reconnect verified; no credentials in Git |
| L5-YT-03 | `WAITING` | Secure Request Connection and isolation | Existing limited-purpose emailed authorization adapted; one-time expiry/invalidation and cross-client/channel isolation verified |
| L5-YT-04 | `WAITING` | YouTube destination editor and validation | Independent title/description/privacy/audience/thumbnail/chapter metadata, video selection and Master revision protections; real provider-specific constraints |
| L5-YT-05 | `WAITING` | Video upload, processing, results | Private-S3 transfer through approved YouTube upload flow, persisted recoverable processing, published video URL/ID/history, certainty-aware retries and duplicate protection |
| L5-YT-06 | `WAITING` | Thumbnail and chapter completion | Supported custom thumbnail/chapters and remaining video metadata handled against current API rules without breaking uploads |
| L5-YT-07 | `WAITING` | Browser-independent YouTube scheduling | Shared scheduler with release-time Account Health, exact revision, provider processing/resume, safe cancel/reschedule, no duplicate video submission |
| L5-YT-08 | `WAITING` | Final live integration review | Real intended channel and privacy/visibility evidence, data persistence, worker results, client isolation, regressions and explicit owner acceptance or documented exceptions |

Only **one READY task** at any time. Implement exactly the selected task; do not pull a later task forward merely because an API screen appears accessible. At an OAuth/developer-console/manual checkpoint, document the exact user action and stop.

## L5-YT-01 — YouTube API & Channel Access Readiness

**Objective:** establish whether the specific Content Social Hub application and intended channel can use the relevant YouTube Data API endpoints and OAuth flow for the requested publishing workflow, with accurate security, audit, scope and quota assumptions.

**In scope (read-only research/planning):**

1. Inspect repository's currently implemented provider/connection adapters and the shared scheduling seams. Confirm no YouTube adapter already exists before proposing changes.
2. Consult current official Google/YouTube API documentation, including upload eligibility, privacy defaults/restrictions for unverified or unaudited projects, project verification, OAuth scopes and consent/app-user restrictions, publishing quotas, resumable upload and post-upload processing states.
3. Define the exact intended client and channel/account selection strategy. If Nicholas has not confirmed the precise target channel or appropriate console permissions, mark those external steps `MANUAL` rather than guessing.
4. Identify the required non-secret callback URL format and proposed environment-variable **names only**; credentials remain private and must not be sent through the repository.
5. Record the target API project strategy without assuming the pending Google Business Profile API request satisfies YouTube access. Surface any restriction needing owner action, verification or audit prior to live posting.
6. Define a minimal implementation/testing path for later tasks, with real posts only when Nicholas has legitimate content. Document safe negative tests and account-ownership checks that do not publish publicly.

**Not in scope:** OAuth code, new AWS services, UI changes, Google Cloud changes, account authorization, API upload, scheduling, YouTube video publication, or TikTok / Google Business Profile implementation.

**Done condition:** current provider eligibility and constraints are documented with source links, exact identity assumptions or manual blockers, approved non-secret integration design, and an explicit decision whether `L5-YT-02` can become READY. Nicholas must complete any external console actions at a designated checkpoint.

## Progress

### October 13, 2026: YouTube handoff opened after owner-approved LinkedIn testing deferral

- **Task selected:** `L5-YT-01 READY`; **objective:** API and exact-channel readiness. This entry prepares the task; it does **not** execute it.
- **Decision:** Nicholas wants to continue building Social Hub and will not publish fake posts on his professional LinkedIn account. LinkedIn `L5-LI-06` and `L5-LI-07` remain `MANUAL`, to be validated opportunistically against genuine future posts; `L5-LI-08` is a DONE transition review with explicit exceptions, not end-to-end LinkedIn certification.
- **Files changed for handoff:** `docs/LEVEL_5_LINKEDIN.md`, newly created `docs/LEVEL_5_YOUTUBE.md`, `README.md`, `AGENTS.md`, and paused-provider phase pointer in `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`.
- **Checks:** Read README and LinkedIn phase, reviewed recent `main` commits, roadmap constraints, existing Google paused checkpoint and AGENTS handoff. Checked documentation task sequencing; no application test, lint, build, API verification, account connection, scheduled trigger or live upload performed during this docs-only handoff.
- **External status:** Intended YouTube channel/client, API entitlement, upload audit/privacy and OAuth configuration still unverified. No credential requests or secrets recorded.
- **Next:** On opening next development chat, read README then this file in full, select `L5-YT-01`, perform access-readiness research, document results here and stop at any necessary external action. `L5-YT-02` remains WAITING.
- **Git:** Docs-only GitHub changes approved October 13. Final merge/push status is to be confirmed in the handoff; no local checked-out working tree.
