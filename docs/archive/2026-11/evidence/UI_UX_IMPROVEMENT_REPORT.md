# CodeRank UI/UX improvement report

2026-10-20. Baseline: master a4c9a87d043a5f68321af077bd8589468d2c7115.

Code-based review of the workspace, editor, console and login. The configured deployment returns DEPLOYMENT_NOT_FOUND. Visual layout, contrast, screen-reader behavior and mobile usability remain unverified. Estimates below assume one engineer.

| Priority | Evidence and impact | Recommended improvement | Acceptance criterion | Estimate |
|---|---|---|---|---|
| P0 | WorkspaceLayout Run/Submit await handleSaveCodeToDB before showing busy state; slow save appears unresponsive | Show Saving immediately; lock duplicate actions and capture an immutable source snapshot | Feedback within 100 ms; one click sequence creates one job; saved and executed source match | 1 day |
| P0 | Both job polling loops lack a deadline | Shared job-wait hook with elapsed time, configurable 60-second deadline, abort on navigation and terminal auth/missing-job errors | Worker outage, 401/403/404 and navigation terminate cleanly; draft preserved | 1–2 days |
| P0 | dynamic.js assigns sample cases zero marks then compares raw score to total practical marks | Derive sample verdict from every case passing; score only final submissions | Passing samples show success independently of marks | 0.5 day |
| P1 | judgeState has loading/success/error without queue or execution phases | Show Saving → Queued → Running → Recording → Done with elapsed time | Server-backed phases; no invented queue ETA | 1–2 days |
| P1 | LocalStorage fallback clears unsaved state after a failed server save | Distinguish Saved on this device from Synced, with timestamp/retry/restore | Offline save never claims server sync; refresh restores draft | 1 day |
| P1 | MonacoEditorPanel unconditionally blocks copy/cut/paste | Restrict only under explicit exam policy; permit normal practice editing and explain restrictions | Practice supports clipboard and assistive input; exam restrictions visible | 1 day |
| P1 | alert/confirm interrupts language switching, reset and history restoration | Accessible destructive-action dialogs, inline errors and per-language draft snapshots | Cancel preserves code; undo reset; keyboard focus returns correctly | 1–2 days |
| P1 | Fixed viewport, horizontal panes and 450px settings dialog risk narrow-screen clipping | Tabbed Problem/Editor/Results on narrow screens; bounded dialogs and touch targets | All actions reachable at 360/390/768/1280px widths and 200% zoom | 2 days |
| P1 | Icon controls rely on titles; control styles remove outlines | Accessible names, visible focus, live result announcements, keyboard resizing and dialog focus management | Complete core flow with keyboard; screen reader announces final result once | 1–2 days |
| P2 | WorkspaceLayout mixes saves, job lifecycle, history and layout with duplicated polling | Extract shared lifecycle and draft hooks | Run/Submit share error handling and cleanup behavior | 2 days |

## Recommended workspace behavior

Keep Run samples and Submit for grading explicitly labeled, with draft sync status beside them. Results should lead with verdict, passing-case count and current-attempt score; label best score separately. Expand the first failed public case. Hidden cases show only permitted verdict/marks. Preserve code after every error.

Use contextual recovery: sign in again after expired authentication, retry after the supplied interval for throttling, and recheck execution availability during outages. Queue acceptance is not completed grading. Distinguish program runtime from queue waiting and full turnaround.

## Validation plan

First test delayed saves, missing workers and all-passing samples. Then verify responsive layouts and keyboard/screen-reader behavior on a working deployment. Run task sessions with 5–8 students: open a practical, edit, run, interpret failure, submit, recover a draft and find best score. Record completion rate, errors, feedback delay and Run/Submit confusion. Proposed targets: 100% draft recovery in controlled offline tests, feedback within 100 ms and at least 90% core task completion. These targets are unmeasured.

UI changes remain recommendations. This change set implements worker batching and test tooling.
