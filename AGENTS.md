<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Content Social Hub Agent Instructions

This repository is managed as a staged product build. A new implementation chat must continue from the documented project state instead of asking the user to restate the project or choosing work from memory.

## Start every implementation session

1. Read `README.md` in full.
2. Find `active_phase_document` in the README's **AI / Work Handoff Context**.
3. Read that active phase document in full.
4. Inspect the current Git status and recent relevant commits.
5. Select the first task marked `READY` in the active phase document.
6. State the active phase, selected task ID, objective, acceptance criteria, and where progress will be recorded before changing code.
7. Unless the user requested planning, review, or diagnosis only, treat that one `READY` task as the complete implementation assignment.

If no task is marked `READY`, more than one unrelated task is marked `READY`, or the README and phase document disagree, stop and ask the user for direction. Do not guess.

## Source-of-truth order

Use project information in this order:

1. `README.md` for the product definition, architecture, locked decisions, roadmap, implementation status, and active phase pointer.
2. The active phase document for its ordered task queue, acceptance criteria, dependencies, progress log, live-test requirements, and blockers.
3. The current application code and automated tests for the actual implementation state.
4. Recent relevant Git history as supporting evidence, not as a replacement for the README or phase log.

Do not rely solely on prior chat memory. Re-read the repository documentation at the start of each implementation session.

## Task statuses

- `DONE`: implemented and supported by the required evidence.
- `READY`: the next bounded task that may be implemented.
- `WAITING`: planned but dependent on another task or checkpoint.
- `BLOCKED`: cannot continue until a specific problem is resolved.
- `MANUAL`: requires the user to complete or verify an external action.

There should normally be only one `READY` task.

## Working rules

- Complete only one `READY` task per implementation session.
- Follow the selected task's acceptance criteria.
- Do not begin `WAITING`, `BLOCKED`, or later-phase work.
- Do not redesign working architecture unless the selected task requires it.
- Preserve locked product decisions unless the user explicitly reopens them.
- Investigate before changing code and make the smallest complete change that satisfies the acceptance criteria.
- Run the relevant automated checks and distinguish automated verification from live or manual verification.
- Do not treat a successful build as proof that an external integration works.
- Stop at external-account, credential, deployment, or live-testing checkpoints and explain exactly what the user must do.
- Never expose or commit credentials, access tokens, API keys, OAuth secrets, or encryption keys.
- Never create, edit, delete, commit, push, rename, or otherwise modify anything in GitHub unless the user explicitly confirms that GitHub write action.

## Documenting progress

The active phase document is both the implementation plan and the completion record.

After working on a task, append a dated progress entry containing:

- task ID and outcome
- files changed
- checks and tests run, with results
- live-test status
- decisions made
- blockers or manual steps
- remaining work

Update a task status only when supported by evidence. When a task becomes `DONE`, identify which dependent task should become `READY`; do not mark unrelated tasks ready in parallel.

Do not declare an entire phase or implementation level complete without the user's review. Update the README's overall implementation status only after that review. Do not create scattered status files when the information belongs in the existing active phase document.

## Required handoff

End every implementation session with:

- active phase
- selected task ID and final status
- what changed and files changed
- checks run and results
- live verification completed or still required
- documentation updated
- blockers or manual actions
- next task that should become `READY`
- Git status
- commit and push status

## Current documentation map

- Product roadmap and source of truth: `README.md`
- Level 0-1 setup record: `docs/LEVEL_0_1_SETUP.md`
- Closed Facebook, publishing, scheduling, and Instagram records: `docs/LEVEL_2_FACEBOOK_SETUP.md`, `docs/LEVEL_3_FACEBOOK_PUBLISHER.md`, `docs/LEVEL_4_SCHEDULING.md`, `docs/LEVEL_5_INSTAGRAM.md`
- Active Level 5 Google Business Profile plan and progress log: `docs/LEVEL_5_GOOGLE_BUSINESS_PROFILE.md`
- Current first task: `L5-GBP-01` — Google Business Profile Access Readiness (`READY`; L5-GBP-00 accepted and closed October 2, 2026)
- Required provider order before Level 6: Google Business Profile, YouTube, LinkedIn, TikTok; X and Pinterest are optional
- Level 6 requires verified required adapters or Nicholas's explicit deferral of documented blockers, plus operational-readiness review
- Blog / website publishing is planned later and has no active task

Always follow the `active_phase_document` named in the README rather than assuming Level 2 will remain active permanently.
