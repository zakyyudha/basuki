# Basuki — UI/UX Follow-up Audit and Remediation Plan

**Audit date:** 2026-09-14
**Version context:** 3.1.0 release candidate, after the first UX remediation pass
**Audience:** Contributors implementing and verifying the remaining UX fixes
**Purpose:** Turn the follow-up review into actionable work with explicit behavior contracts and acceptance criteria.
**Related document:** [Original UI/UX improvement analysis](./ux-improvement.md)

This is a separate follow-up report. The original analysis remains the historical baseline. This document distinguishes changes already present in source from defects that remain, incomplete implementations, and improvements that still need verification.

## Implementation Status

Current source now contains remediation for all seven named findings: persisted editor drafts with recovery/discard controls, durable session presets with normalized launch URLs, shared dialog focus containment, storage-aware mutation feedback, strict HTTP/HTTPS validation, pre-confirmation import validation, and paused-state visual/terminology handling. It also contains the related pattern tester, cross-adapter hit tracking, Inspector localization and responsive styling, update chip state, offline system font stacks, skeleton loading cards, install welcome page, queued draft writes, and regression coverage for validation/matching behavior.

Automated evidence currently passes `npm test` including redirect, pause/ALL, URL/import validation, and matcher edge-case checks; `npm run build`; `git diff --check`; and manifest JSON parsing. Browser-only evidence remains required for popup dismissal, Chrome storage/runtime failure injection, focus behavior in a live extension popup, screen readers, contrast measurements, zoom/height constraints, install lifecycle, and end-to-end pause behavior in already-open pages. Those items are verification work, not unimplemented source requirements.

## 1. Executive Summary

The first remediation pass improved several important behaviors: pause now has a storage-backed flag, the intercept matcher recognizes `ALL`, new redirect/mock rules are not written to storage immediately on Add, and the intercept accordion no longer nests interactive buttons. Those improvements do not make the original roadmap complete.

The follow-up review found seven priority issues:

1. **Unsaved editor changes still disappear when the popup closes.** There is no persisted editor draft or resume flow.
2. **A saved session preset can disappear or launch the wrong URL.** New presets remain in component state, while the launch path prefers an older URL over the edited origin.
3. **Dialog accessibility is incomplete.** Dialog roles and Escape handling exist, but focus is not trapped or restored, and parent updates can move focus unexpectedly.
4. **Mutation feedback can still be false or silent.** Pause updates its display before persistence succeeds; delete can report success after failure; save failures lack actionable feedback.
5. **URL validation does not reject misspelled protocols.** Parsing with `new URL()` alone accepts URLs such as `htp://localhost:3000`.
6. **Import failures still appear only in debug logs.** Confirmation runs before schema validation and does not accurately describe all affected state.
7. **Paused UI still labels enabled rules as active.** Counts and visual emphasis do not consistently distinguish configuration from execution.

These should be addressed before additional decorative polish. They affect data retention, keyboard access, and confidence in the extension's behavior.

### Correction to the previous completion summary

The earlier completion summary overstated coverage. In particular:

- Adding dialog roles and moving initial focus is not complete modal focus management.
- Keeping new rules out of persistent configuration is not draft recovery.
- Removing a remote font import is not bundling fonts locally.
- Storing hit timestamps and showing redirect timestamps is not complete per-rule diagnostics for both rule types.
- Passing a build and matcher tests is not browser-level UX verification.

Future completion claims should identify the specific behavior verified and the evidence supporting it.

## 2. Scope, Evidence, and Limitations

### 2.1 What this report covers

The follow-up review examined the popup shell, redirect/mock/session editors, storage-backed system state, mutation feedback, navigation, and the remaining items from the original roadmap. Findings refer to recognizable components and functions rather than depending on line numbers that will move during remediation.

Primary implementation landmarks include:

- `AppShell`, including `updateSystemOn`, `showToast`, rule CRUD handlers, session handlers, and the footer/tab counters.
- `RedirectEditor`, `InterceptEditor`, `SessionEditor`, `ModalShell`, and `ConfirmDialog`.
- Configuration import/export adapters and session runtime adapters.
- The traffic Inspector, language preferences, popup styles, and update-check behavior.

### 2.2 Evidence classification

| Classification | Meaning |
|---|---|
| Source-confirmed defect | The implementation contains a concrete path that can produce the described problem. |
| Source-confirmed gap | The requested behavior is absent or only partially implemented. |
| Browser verification required | Source suggests an issue or improvement, but visual, keyboard, extension-lifecycle, or assistive-technology behavior still needs direct verification. |
| Proposed behavior | A remediation recommendation, not a claim about current behavior. |

The reproduction steps below are verification procedures derived from source. They are not claims that every scenario has already been reproduced in a running browser.

### 2.3 Existing verification and what it proves

The prior implementation pass reported a successful production build, redirect matcher checks, global pause/`ALL` matcher checks, manifest parsing, and a whitespace check.

Those checks provide useful evidence for compilation and a narrow runtime matching contract. They do not establish:

- Draft recovery after extension-popup dismissal.
- Reliable session persistence or correct launch destinations.
- Modal focus containment, restoration, or screen-reader behavior.
- Correct user feedback when storage or runtime operations fail.
- Import confirmation accuracy.
- Visual contrast, text readability, or layout at reduced available height.
- End-to-end pause propagation in already-open pages.

No browser interaction, screenshot audit, measured contrast audit, or screen-reader session was performed during the follow-up source review.

## 3. Severity and Implementation Order

| Priority | Meaning | Findings |
|---|---|---|
| High | Data loss, wrong action target, blocked keyboard workflow, or misleading mutation result | UX-F01–UX-F04 |
| Medium | Validation, import clarity, and execution-status defects that undermine reliable use | UX-F05–UX-F07 |
| Follow-up | Remaining diagnostics, localization, visual consistency, onboarding, and verification work | Section 5 |

Severity describes user impact, not estimated implementation size. A short fix can still deserve high priority.

## 4. Detailed Findings

### UX-F01 — Unsaved editor changes are still lost on popup dismissal

**Severity:** High
**Evidence:** Source-confirmed gap
**Original references:** §2.4; roadmap item 5 and its associated draft-recovery requirements

#### Current behavior

Each editor initializes its draft with React state. Redirect and mock Add actions now create local drafts rather than immediately saving placeholder rules. This addresses orphan persisted rules, but the editable values still exist only inside the popup's component tree.

There is no separate persisted draft record, no recovery affordance, and no distinction between an explicit discard and the browser dismissing the popup.

#### User impact

A developer can spend several minutes editing a response body and lose it by clicking outside the popup. The same risk applies to edits of existing rules, not only newly added rules. The absence of orphan rules does not compensate for losing authored content.

#### Reproduction procedure

1. Open an existing mock or create a new one.
2. Change its pattern and enter a recognizable response body without saving.
3. Click outside the popup so the browser dismisses it.
4. Reopen the popup.
5. Check whether the unsaved work can be resumed.

**Expected from current source:** No recovery flow; local draft values are lost.

#### Proposed behavior

- Keep saved configuration and unsaved drafts separate.
- Persist a draft record containing editor kind, item identity, whether it is new, editable values, and a last-edited timestamp.
- Save draft changes promptly enough to survive sudden popup dismissal. If debouncing is used, explicitly account for losing the final changes when dismissal happens before the debounce fires.
- On reopen, offer **Resume unsaved draft** and **Discard** with enough context to identify the draft.
- Keep the draft until a confirmed successful save or explicit discard.
- Report draft-persistence failure without pretending recovery is available.
- Handle malformed or obsolete draft data without crashing the popup.

For existing items, recovery must not silently overwrite a newer saved version or recreate an item deleted elsewhere. At minimum, detect a missing target and ask whether to save the recovered work as a new item.

#### Acceptance criteria

- [ ] A new redirect, mock, and session draft each survive popup dismissal.
- [ ] Edits to existing redirect and mock rules survive dismissal.
- [ ] Draft recovery restores all editable fields, including empty strings and response-body formatting.
- [ ] Saving successfully clears the corresponding recovery record.
- [ ] A failed save preserves the editor values and recovery record.
- [ ] Discard removes the recovery record and does not modify saved configuration.
- [ ] Drafts never appear as executable rules before Save succeeds.
- [ ] Corrupt recovery data produces a recoverable UI state.

### UX-F02 — Session Save does not reliably preserve configuration or launch the edited destination

**Severity:** High
**Evidence:** Source-confirmed defects
**Implementation landmarks:** `addSession`, `saveSession`, `refreshSessions`, `launchSession`, and `SessionEditor`
**Original references:** §2.4 and §5.5

#### Current behavior

New sessions start with both `origin: 'example.com'` and `url: 'https://example.com'`. The editor updates `origin`, but its save payload leaves the earlier `url` intact. Launch uses `session.url || session.origin`, so the stale URL wins.

For sessions without an `isolationId`, Save only updates the local session list. The saved preset is not durable across popup closure. Runtime session refreshes replace the session list, which can also remove local presets or a new session currently being edited.

For runtime-managed sessions, Save currently renames the session. Editable origin and note fields should not imply that those changes are persisted or applied if the backend only accepts a name change.

#### User impact

- A user changes the destination to their application but Launch opens `example.com`.
- A user clicks Save, reopens the popup, and cannot find the saved preset.
- Runtime updates can interrupt session drafting.
- Editable fields imply capabilities that the Save operation does not actually provide.

#### Reproduction procedure

1. Create a session and change Origin to a recognizable host or HTTP/HTTPS URL.
2. Save it, then launch it without closing the popup.
3. Compare the opened destination with the entered value.
4. Repeat creation and Save, but close and reopen the popup before launching.
5. Separately edit an existing runtime session's origin or note and inspect whether those changes persist.

#### Proposed behavior

- Define a durable **session preset** separately from an active **runtime session**.
- Persist presets on successful Save, including the user-authored name and supported metadata.
- Use one normalized launch URL as the source of truth. Derive it from the validated host-or-URL input rather than retaining two independently editable destination values.
- Merge preset and runtime state intentionally; runtime refreshes must not erase saved presets or unsaved editor work.
- Expose only supported editing operations for active sessions. If only rename is supported, other fields should be read-only or absent in that context.
- Keep the User-Agent field explicitly display-only, or rename it to Note. Do not imply a browser User-Agent override.
- Define whether launch retains a reusable preset; a reusable saved preset is the recommended behavior.

#### Acceptance criteria

- [ ] Save survives popup closure without launching a tab.
- [ ] Launch uses the exact normalized destination derived from the edited input.
- [ ] Host-only input and full HTTP/HTTPS URL input behave consistently.
- [ ] Runtime session changes do not remove saved presets or close unrelated editors.
- [ ] Supported changes to active sessions persist; unsupported changes cannot be submitted as if supported.
- [ ] Runtime failure is visible and does not remove the preset.
- [ ] Removing a preset and closing a runtime session have clearly defined, distinct effects.

### UX-F03 — Dialog semantics exist, but keyboard behavior remains incomplete

**Severity:** High
**Evidence:** Source-confirmed gap; browser verification required for exact focus transitions
**Implementation landmarks:** `ConfirmDialog` and `ModalShell`
**Original reference:** §4.4

#### Current behavior

Both overlays declare dialog semantics. Escape handling exists, and each effect explicitly focuses a button. However:

- There is no focus trap or native modal behavior preventing navigation behind the overlay.
- The previously focused trigger is not restored when the dialog closes.
- The delete confirmation initially focuses the destructive button.
- The editor focus effect depends on `onClose`, which the parent supplies as a new inline function on rerender. Live parent updates can therefore rerun the focus effect and move focus back to Close.
- Nested editor/delete confirmation dialogs require coordinated focus ownership; independent window-level key handlers do not establish that contract.

Removing the global Enter handler was useful, but the currently focused delete button still activates on Enter. A non-destructive initial focus target is preferable for this confirmation.

#### User impact

Keyboard users can activate controls hidden behind a supposedly modal overlay. A live update can interrupt typing. Closing a dialog can leave focus in an unpredictable location, and nested confirmations can close or focus the wrong layer.

#### Reproduction procedure

1. Open each editor using only the keyboard.
2. Press Tab and Shift+Tab through the complete focus cycle.
3. Trigger a live update while an input is focused.
4. Open Delete confirmation from the editor.
5. Press Escape once, then inspect which layer remains open and where focus returns.
6. Close the editor and inspect whether focus returns to its trigger.

#### Proposed behavior

Prefer the native modal `<dialog>` mechanism where it fits the extension layout; otherwise implement a shared, complete modal focus lifecycle.

Required behavior is independent of the chosen implementation:

- Move focus into the dialog once when it opens.
- Choose Cancel as initial focus for destructive confirmation.
- Prevent keyboard and pointer interaction with obscured background controls.
- Keep focus in the topmost dialog.
- Let Escape dismiss only the active layer.
- Restore focus to the previous trigger, or a sensible surviving fallback if deletion removed it.
- Do not rerun initial-focus behavior merely because callback identity or live data changed.
- Provide a programmatic title and appropriate description for each dialog.

#### Acceptance criteria

- [ ] Tab and Shift+Tab cannot leave the active modal.
- [ ] Background header, tabs, footer, and list controls are unavailable while the modal is active.
- [ ] Live traffic or storage updates do not move focus away from an edited field.
- [ ] Delete confirmation opens on Cancel.
- [ ] Escape closes only the topmost dialog.
- [ ] Focus restoration works after Cancel, Save, and Delete.
- [ ] Screen readers identify the dialog title and current control correctly.

### UX-F04 — Success, failure, and pending states are not trustworthy across mutations

**Severity:** High
**Evidence:** Source-confirmed defects
**Implementation landmarks:** `updateSystemOn`, rule CRUD handlers, session handlers, and `showToast`
**Original references:** §2.1, §5.2, and §11

#### Current behavior

`updateSystemOn` changes popup state immediately and does not inspect the result of `setSystemEnabled`. A failed storage write can leave the popup showing Paused while the stored state remains enabled.

Delete handlers update the list only on success, but close the editor and announce Deleted regardless of the operation result. Save handlers return silently on failure. Clipboard, export, import, and Inspector-opening errors are not consistently surfaced to the user.

Pending operations do not have a consistent disabled/busy state. Toasts create independent timers, so an older timer can dismiss a newer message prematurely.

#### User impact

The same class of trust issue that motivated the original audit remains possible on failure paths: the UI can claim that an operation happened when it did not. Silent failure encourages repeated clicks and leaves users unsure whether their work was saved.

#### Proposed operation contract

| State | Required behavior |
|---|---|
| Idle | Action is available when prerequisites are met. |
| Pending | Show progress appropriate to the operation; prevent duplicate submissions. |
| Success | Apply the confirmed result and show a concise localized confirmation. |
| Failure | Preserve user work, retain or restore the last confirmed state, and show an actionable error. |

Optimistic updates are acceptable only with explicit rollback and visible failure handling. For the global pause switch, confirmed persistence before a final Paused indication is the clearest contract.

Storage acknowledgement also does not prove that every already-open page has processed the update. Verify the content-script propagation path separately before claiming end-to-end pause behavior.

#### Acceptance criteria

- [ ] Simulated pause-write failure leaves the UI consistent with the last confirmed system state.
- [ ] Delete failure keeps the item and does not show Deleted.
- [ ] Save failure keeps all draft values and explains how to retry.
- [ ] Double-clicking Save, Delete, or Launch cannot submit unintended duplicate operations.
- [ ] Runtime response failure is handled even when message transport itself succeeds.
- [ ] Clipboard, export, import, and Inspector errors have visible feedback.
- [ ] Each new toast replaces the previous message and resets its dismissal timer.
- [ ] Failure messages remain discoverable long enough to read and act on.

### UX-F05 — URL parsing is mistaken for application-level validation

**Severity:** Medium
**Evidence:** Source-confirmed defect
**Implementation landmarks:** Redirect and session editor validation
**Original reference:** §5.1

#### Current behavior

Redirect validation checks whether `new URL()` throws. That only establishes URL syntax, not whether Basuki supports the resulting protocol. For example, `htp://localhost:3000` can parse without throwing.

Session validation prepends HTTPS to values without `://` and then parses them. It does not fully define accepted protocols or what counts as a valid host. Validation occurs on Save rather than on blur, and error messages are not fully associated with inputs for assistive technology.

#### Proposed behavior

- Accept only HTTP and HTTPS for redirect destinations and session launch URLs.
- Accept host-only session inputs through a documented normalization rule, such as HTTPS by default.
- Define host validation explicitly, including localhost, ports, IPv4, and bracketed IPv6 if supported by the launch/relay path.
- Reject unsupported schemes with a specific error rather than a generic parse failure.
- Keep substring matching distinct from destination URL validation. Matching text is not necessarily a complete URL.
- Validate individual fields on blur, while retaining final validation at Save.
- Associate field errors programmatically and focus the first invalid field after a rejected submission.
- Apply equivalent validation at import and other configuration entry points so alternate inputs cannot bypass the contract.

#### Acceptance examples

| Input | Context | Expected behavior |
|---|---|---|
| `http://localhost:3000` | Redirect destination | Accepted. |
| `https://api.example.com/v1` | Redirect destination | Accepted. |
| `htp://localhost:3000` | Redirect destination | Rejected with HTTP/HTTPS guidance. |
| `javascript:alert(1)` | Launch or destination URL | Rejected. |
| `app.example.com` | Session host input | Normalized according to the documented default scheme. |
| `https://app.example.com/path?q=1` | Session URL input | Path and query preserved. |
| `api.example.com/v1` | Rule matching text | Treated as a substring, not forced into URL syntax. |
| `api.example.com/*` | Rule matching text | Rejected with the existing unsupported-wildcard explanation. |

#### Acceptance criteria

- [ ] Misspelled and unsupported protocols are rejected consistently.
- [ ] Session hostname rules are explicit and tested, rather than inferred from successful parsing.
- [ ] On-blur and on-save validation agree.
- [ ] Invalid fields expose accessible error relationships.
- [ ] Raw response bodies remain allowed; JSON-looking invalid bodies receive a non-blocking warning.

### UX-F06 — Import preview and failure feedback remain incomplete

**Severity:** Medium
**Evidence:** Source-confirmed defects and gaps
**Implementation landmarks:** `handleImportFile` and the configuration import adapter
**Original reference:** §5.3

#### Current behavior

The popup parses JSON, derives rule counts, and asks for confirmation before the adapter validates the snapshot. Malformed JSON is recorded only in logs. Adapter rejection does not produce a visible error toast.

Confirmation says that current rules will be replaced, but the adapter writes only supplied domains. The preview therefore does not precisely explain what is replaced, retained, or otherwise affected. It also does not compare the incoming counts with current counts or explain session-state effects.

#### User impact

A user may confirm an invalid import, get no visible outcome, and assume success. A valid partial snapshot can also affect a different scope than the confirmation suggests.

#### Proposed workflow

1. Read and parse the selected file.
2. Validate the full snapshot structure and supported domain contents without writing storage.
3. Build a preview from the validated payload and current state.
4. State which domains will change, incoming counts, current counts, and what will remain untouched.
5. Obtain confirmation with Cancel as the safe initial action.
6. Apply the validated payload and await the result.
7. Report success with useful counts, or preserve current state and show a visible failure.

Session runtime metadata requires particular care. Do not describe importing live tab identifiers or cookie-restoration state as an ordinary reusable session preset. Define what the import format supports before offering that data as portable configuration.

#### Acceptance criteria

- [ ] Malformed JSON produces visible feedback before any confirmation dialog.
- [ ] Invalid schema produces visible feedback and no storage write.
- [ ] Empty or unsupported snapshots have an explicit outcome.
- [ ] Partial snapshots accurately identify affected and retained domains.
- [ ] Preview includes incoming and current rule counts.
- [ ] Cancel makes no configuration changes.
- [ ] Failed persistence does not announce success.
- [ ] Successful import updates the visible lists and confirms the imported scope/counts.

### UX-F07 — Paused status conflicts with active-rule counters and visual emphasis

**Severity:** Medium
**Evidence:** Source-confirmed inconsistency
**Implementation landmarks:** `activeRules`, `tabCounts`, footer statistics, and enabled-rule styling
**Original references:** §2.1, §3.2, and §3.3

#### Current behavior

The master switch can pause execution without changing individual rule flags. This is the correct preservation model, but counters still use the per-rule enabled flags and the footer labels them ACTIVE. Count chips and rule emphasis remain execution-like while the header says Paused.

#### Required vocabulary

| Term | Meaning |
|---|---|
| Enabled rule | A saved rule configured to participate when the system is running. |
| Active execution | The system permits configured rules to run; this is not proof of a recent match. |
| Paused system | Global rule execution is disabled while per-rule configuration is retained. |
| Hit | A recorded match, not proof that a destination request succeeded. |
| Active session | A runtime session state, separate from rule execution. |

#### Proposed behavior

- Label configuration counters **Enabled n/m**, or show an explicitly execution-aware count of zero while paused alongside the retained enabled count.
- Keep per-rule switches in their saved positions while paused.
- Mute execution-like glows or add a clear paused explanation without implying rules were individually disabled.
- Keep Inspector history visible while paused; historical traffic does not mean the extension is currently executing rules.
- Make the toolbar icon, header, footer, and debug summary agree about global execution state.
- Clarify that pausing redirect/mock execution does not automatically close isolated sessions.

#### Acceptance criteria

- [ ] Pausing preserves every rule's enabled setting.
- [ ] No surface implies rules are executing while the system is paused.
- [ ] Resuming restores execution eligibility without mutating saved rule selections.
- [ ] Toolbar and popup system indicators agree in paused, enabled-with-no-rules, and enabled-with-rules states.
- [ ] Session activity remains distinguishable from redirect/mock execution.

## 5. Remaining Original-Roadmap Coverage

The following items are still relevant after the seven findings above. These are not all equally urgent, and source presence alone is not a verified completion claim.

| Area | Follow-up status | Remaining work | Completion evidence |
|---|---|---|---|
| Inspector localization | Incomplete | Translate controls, headings, confirmations, empty states, copy feedback, and errors; share language preference. | Full Inspector walkthrough in EN and ID. |
| Inspector visual consistency | Incomplete | Use the popup's design tokens and typography; verify long URLs and narrow layouts. | Side-by-side visual review and responsive checks. |
| Inspector section defaults | Incomplete | Expand request/response bodies by default; collapse less immediately useful headers/timing; preserve Expand all/Collapse all/Reset. | Select representative traffic entries and inspect initial disclosure state. |
| Intercept diagnostics | Partial | Show hits and last-hit time for mocks as well as redirects; verify hit reporting across supported request paths. | Runtime requests produce correct visible counts/timestamps. |
| No-match guidance | Missing | Add a time-qualified, subtle no-match annotation; explain that zero hits can mean no relevant traffic. | Enabled old zero-hit rules receive guidance without being labeled broken. |
| Pattern tester | Missing | Test an entered URL against the actual shared matching semantics. Include method context for mocks where applicable. | Tester and runtime matcher agree for positive, negative, and `ALL` cases. |
| Form validation | Partial | Add protocol/host checks, on-blur validation, accessible errors, and JSON soft warnings. | Field-level and alternate-entry-point checks pass. |
| Response content type | Unresolved clarity gap | Explain or control the effective response content type; avoid a universal claim if fetch/XHR/other adapters differ. | UI description matches runtime behavior. |
| Font packaging | Incomplete | Bundle the intended fonts locally with appropriate license assets, or explicitly adopt system fonts as a documented design decision. | Offline popup and Inspector use the intended fonts without remote requests. |
| Update availability | Partial | Daily checking exists; add a visible update-available surface linked to the release. Verify alarm lifecycle and stored result behavior. | Available update is visible without relying on a notification. |
| Welcome/onboarding | Missing | Provide a small install-time introduction to redirects, mocks, and sessions, with accurate limitations. | Fresh install opens the intended page once; upgrade behavior is deliberate. |
| Minimum text size | Partial | Complete the pass over remaining 9px labels and controls; prioritize readable hints and errors. | Computed-style and visual review across both languages. |
| Contrast | Partially adjusted, not measured | Measure foreground/background pairs, including hints, placeholders, disabled states, and badges. | Recorded contrast results for meaningful text and controls. |
| Popup height and zoom | Unverified | Ensure the footer and editor actions remain reachable at constrained available height and zoom. | Browser checks with short/long content and reduced viewport height. |
| Loading states | Unverified/incomplete | Avoid a blank popup during bootstrap; distinguish loading, empty data, and failed hydration. | Slow-storage and bootstrap-failure scenarios remain understandable. |
| Inline-style consolidation | Partial | Continue moving repeated visual patterns into shared classes/tokens where it prevents inconsistent behavior. | Repeated surfaces share definitions without visual regressions. |
| Iconography | Partial | Replacing/removing text symbols is not the same as adding consistent SVG icons. Complete only where icons improve recognition. | Icons have text labels or accessible names and consistent rendering. |
| Accordion behavior | Partial | Default-collapsed behavior exists; reveal the just-created/edited item and retain sensible scroll position. | Save a mock in a long list and locate it immediately. |

### 5.1 Important diagnostic wording

A zero-hit rule should not be labeled invalid merely because time has passed. The user may not have sent a matching request. Prefer **No matches recorded yet**, with a pattern-testing affordance and explanation of supported matching behavior.

Likewise, **Hits** should remain distinct from successful network responses. A redirect may match correctly while the local service is unavailable.

### 5.2 Localization requirements apply to errors too

Localization is incomplete if only ordinary labels are translated. Include:

- Recovery prompts and discard confirmation.
- Validation messages and unsupported-protocol guidance.
- Import preview text and failure messages.
- Pending and successful mutation feedback.
- Empty states and no-match annotations.
- Inspector copy failures and clear confirmation.
- System Enabled/Paused terminology and relative-time formatting.

Technical values such as HTTP methods, URLs, JSON keys, and `curl` should remain intact.

## 6. Recommended Implementation Slices

### Slice A — Preserve user-authored work

**Includes:** UX-F01 and UX-F02.

Implement separate durable editor drafts and saved session presets. Normalize session launch destinations. Keep runtime refreshes from replacing local editor work.

**Exit condition:** A contributor can create, edit, dismiss, reopen, resume, save, and launch each supported workflow without losing data or targeting an older URL.

### Slice B — Make mutations truthful

**Includes:** UX-F04, UX-F06, and UX-F07.

Define pending/success/failure behavior, repair pause/delete/save feedback, validate import before confirmation, and align enabled-versus-active language.

**Exit condition:** Injected storage/runtime failures never produce false success or destroy the user's draft.

### Slice C — Complete keyboard and form access

**Includes:** UX-F03 and UX-F05.

Complete modal focus behavior, accessible field validation, safe initial confirmation focus, and supported destination validation. Verify the existing tab navigation alongside dialogs.

**Exit condition:** Main workflows can be completed with a keyboard, including nested confirmation and recovery from invalid input.

### Slice D — Complete diagnostics and localization

**Includes:** Inspector i18n, shared preferences, mock hit history, no-match guidance, pattern testing, and response-content-type clarity.

**Exit condition:** Users can determine whether matching is configured correctly, inspect supported traffic, and complete the same tasks in EN and ID.

### Slice E — Finish visual consistency and onboarding

**Includes:** Font packaging, measured contrast, text sizing, viewport constraints, repeated styles, appropriate icons, update visibility, and welcome content.

**Exit condition:** Visual and first-run behavior are verified in the extension, with no hidden footer/editor actions or offline typography surprises.

## 7. Verification Plan

### 7.1 Automated checks

Retain the existing build and matcher checks, then add small, behavior-oriented checks for the newly implemented contracts. Prefer the current test setup rather than adding a framework solely for these fixes.

Recommended coverage:

- Draft serialization, recovery, discard, and successful-save cleanup.
- Session host/URL normalization and rejection of unsupported schemes.
- Saving a session preset independently of runtime tabs.
- Import validation before writes, including malformed/partial snapshots.
- Mutation failure paths that must preserve state and suppress success feedback.
- Matcher/tester agreement for substrings, empty patterns, unsupported wildcards, and HTTP methods.

Focus and visual behavior require browser-level verification even if supporting helpers have unit tests.

### 7.2 Manual browser matrix

| Scenario | Steps | Required result |
|---|---|---|
| New draft recovery | Edit each kind, dismiss popup, reopen, resume. | All authored fields return; no executable placeholder is created. |
| Existing-rule recovery | Edit a stored rule, dismiss, reopen. | Recovery is offered without silently overwriting saved state. |
| Session durability | Save a preset, close popup, reopen. | Preset is present and launches its edited destination. |
| Runtime refresh during edit | Edit a session/rule while traffic or session state changes. | Draft and focus remain stable. |
| Keyboard editor | Open, navigate all fields/actions, close. | Focus remains inside modal and returns predictably. |
| Nested deletion | Open editor Delete confirmation, press Escape once. | Only confirmation closes; editor remains usable. |
| Save failure | Force storage failure, submit a populated form. | Draft remains, error is visible, retry is possible. |
| Delete failure | Force deletion failure. | Item remains and no Deleted message appears. |
| Pause failure | Force global flag write failure. | Popup does not claim a confirmed pause. |
| Successful live pause | Pause with rules enabled in an already-open page, then send new requests. | New matching work is gated; saved selections remain intact. |
| Invalid import | Select malformed JSON and invalid-schema JSON. | Visible error, no configuration change. |
| Partial import | Import one supported domain. | Preview accurately describes replaced and retained state. |
| Rapid actions | Trigger consecutive notifications and repeated Save clicks. | Latest toast stays readable; no duplicate operation. |
| Localization | Complete core workflows in EN and ID, including failures. | No unexplained English-only control or error. |
| Long content | Use long URLs, long names, and large mock bodies. | Full values remain accessible and actions remain reachable. |
| Reduced height/zoom | Test constrained browser viewport and representative zoom. | Footer and editor actions remain reachable. |
| Offline startup | Open popup and Inspector offline. | UI remains usable and typography does not require remote resources. |

### 7.3 Verification record format

For each implemented finding, record:

- Finding ID and behavior being verified.
- Browser version and whether the test ran in an actual extension popup, Inspector window, or test fixture.
- Initial state and any injected failure conditions.
- Steps or automated command.
- Observed result.
- Pass/fail and remaining limitation.

A static browser fixture can help verify layout, but it is not equivalent to testing real popup dismissal or Chrome storage/runtime behavior.

## 8. Definition of Done

The follow-up remediation is complete only when:

- [ ] UX-F01–UX-F07 have implementation and acceptance evidence.
- [ ] Draft loss and wrong-destination session launch are covered by regression checks.
- [ ] All user-triggered mutations have explicit pending, success, and failure behavior.
- [ ] Modal keyboard behavior is verified in a browser, including live updates and nested confirmation.
- [ ] Enabled configuration and active execution are described consistently.
- [ ] Remaining original-roadmap items are individually marked complete, deliberately revised, or still open with an explicit reason.
- [ ] Build and relevant automated checks pass after the final code changes.
- [ ] EN/ID and constrained-layout scenarios are verified for affected screens.
- [ ] Completion reporting distinguishes source inspection, automated verification, and browser verification.

## 9. Maintainer Handoff

Start with user-work preservation and truthful outcomes. Avoid broad styling refactors before these contracts are stable.

Use the finding IDs in implementation notes and regression checks so future reviewers can trace each fix to an observable requirement. Keep the original audit as the baseline, and update completion evidence in follow-up work rather than treating an earlier successful build as proof that every UX requirement was delivered.
