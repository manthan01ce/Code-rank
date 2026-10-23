# CodeRank UI and UX change specification

Date: 22 October 2026. Reviewed baseline: f165cdd9628900ed925aa2b66918e6592128a43b. Status: proposed changes, with existing features preserved.

## Decisions and scope

### Purpose

Prioritize the next UI and interaction changes for students and faculty. Current master already includes immediate save feedback, action locking, draft restoration, narrow-screen workspace views and native dialogs. Extend those features rather than repeating the earlier redesign.

### Release context

Reviewed origin/master at f165cdd on 22 October 2026. The public deployment returns DEPLOYMENT_NOT_FOUND and the local application reports degraded database, queue and execution readiness. Treat the work below as a proposed change specification; browser acceptance remains to be verified in a working environment.

### Priority order

P0: make keyboard actions consistent and keep execution state trustworthy. P1: improve draft sync, language switching, result interpretation, mobile focus and error recovery. P2: reduce large collection loading and simplify the workspace implementation.

### Preserve existing behavior

Keep captured source snapshots, one-job-per-action locking, account and job ownership validation, hidden-case redaction, draft recovery, bounded waits and explicit exam clipboard policy. Do not turn off these protections to make actions look faster.

## Student actions and draft recovery

### P0 Consistent keyboard actions

Problem: Monaco binds Ctrl or Cmd plus Enter to Submit, while the window listener binds it to Run. Use one shared action registry. Recommended map: Ctrl or Cmd plus Enter runs samples; add Shift to submit for grading; Ctrl or Cmd plus S saves. Update Monaco actions, visible hints and global handlers together. Test focus inside the editor, toolbar, dialogs and form inputs. Acceptance: each shortcut triggers exactly one intended action and never submits from an unrelated input.

### P1 Separate saving from execution

The current action waits up to eight seconds for draft sync before enqueueing. Preserve a local source snapshot immediately, distinguish device save from acknowledged server revision, and avoid a redundant save when the revision is already synced. If a combined save-and-enqueue API is chosen, define its authorization and idempotency contract first. Acceptance: delayed sync cannot change the executed source; repeated clicks create one job; save failure provides a retry and preserves the draft.

### P1 Safe language switching

The current handler saves first and then performs an unbounded language-load fetch. Use bounded, abortable requests with a language/problem revision guard. Restore the pending local draft without allowing a stale response to overwrite it. Acceptance: a rapid Python to C++ to Java switch shows the final selected language and its correct draft; network loss has a clear recovery path.

### Source locations

WorkspaceLayout.js: performAction, handleSaveCodeToDB, handleLangChange and handleKeyDown. MonacoEditorPanel.js: editor.addAction. Exact repository directories are listed in the Markdown specification.

## Execution results and accessible screens

### P1 Explain waiting and completion

Retain server-backed Queued and Running states and show elapsed time separately from announcements. A wait timeout must explain that the server job may still complete and offer submission history before retry. Consolidate the polling lifecycle and use scoped notifications plus adaptive polling as fallback. Acceptance: dropped notifications, reconnects, expired auth and missing jobs settle correctly; final verdict is announced once.

### P1 Make results easy to interpret

Lead with current-attempt verdict and passing-case count. Label current score and best recorded score separately using authoritative history data. Open the first failed public case, or a summary when only hidden cases fail. Distinguish program CPU time, worker elapsed time and total turnaround; current runtimeMs includes orchestration overhead. Acceptance: students can identify the failure and their saved best result without confusing queue acceptance with grading.

### P1 Verify mobile and keyboard access

Keep Problem, Editor and Results views below the existing 767px breakpoint. Preserve the draft, selected case and focus across view changes. Ensure toolbar actions remain reachable, dialogs fit the viewport and focus returns to the trigger. Acceptance: core flow works at 360, 390, 768 and 1280px, 200 percent zoom, and keyboard-only input; touch targets are at least 44px.

### P1 Keep policy and errors explicit

Preserve visible exam clipboard policy and ordinary practice editing. Display inline recovery for auth expiry, denied access, throttling and unavailable services. Preserve drafts through sign-in recovery. Browser and server behavior must agree; frontend controls are not the authorization boundary.

## Delivery plan and acceptance

### Stage one Interaction correctness

Implement the shared shortcut map, language-load cancellation and revision guards. Add interaction tests for editor versus window handlers, duplicate input events, late responses, navigation and dialogs. Verify draft restoration and avoid stale save acknowledgements.

### Stage two Performance and result clarity

Instrument save, enqueue and result visibility. Reduce redundant sync and polling while retaining authority checks. Add current versus best score and first public failure selection. Confirm that hidden test inputs, expected output and actual output remain protected.

### Stage three Faculty and large lists

Large selectors currently drain cursor pages sequentially. Use server search or bounded pages with progressive results, retain filters and cursors on refresh, and make offline/stale data visible. Keep marks tables paginated and responsive. Acceptance: loading another page does not reset selection or replace newer data with an older response.

### Validation and release gates

First restore deployment and real database, Redis and runner readiness. Then run production browser traces, keyboard and screen-reader checks, and task sessions with five to eight students. Proposed targets: feedback within 100ms, one action per gesture, 100 percent controlled draft recovery, and at least 90 percent core task completion. Validate loading, offline, expired auth, 429, 503, job timeout and final grading states.

### Review status

172 unit tests and critical lint pass on the reviewed commit. Production build and browser rendering are blocked by the host memory-inspection error; the font download also failed in this network. Timing and accessibility targets above are proposed acceptance criteria, not measured achievements. Record measured save-to-enqueue, queue wait, worker time and final visibility separately before closing the changes.

## Repository references

- apps/web/src/components/compiler/WorkspaceLayout.js
- apps/web/src/components/compiler/MonacoEditorPanel.js
- apps/web/src/components/compiler/ConsolePanel.js
- apps/web/src/components/compiler/ProblemPanel.js
- apps/web/src/components/compiler/ConfirmAction.js
- apps/web/src/lib/job-lifecycle.js and wait-for-job.js
- apps/web/src/lib/fetch-collection.js
- apps/web/src/app/faculty/page.js
- apps/web/src/app/student/code/[id]/page.js
- packages/core/src/security/active-actor.js

Implementation estimates should be assigned after an owner confirms scope and the environment is usable. This document authorizes no claim that the proposed changes have already shipped.
