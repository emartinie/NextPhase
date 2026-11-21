# Persistent conversation experiment

This is a reversible UI iteration on `feature/operational-fellowship-pilot`, after checkpoint `d0b35619417c6677e6a694793c33d0432268df4d`. It preserves the existing Firebase SDK, authentication, membership checks, immutable message schema, provisioned conversations, Theme Manager and public readers. No database structures, rules or authentication configuration change.

## Interaction

- Fellowship Home retains the map and compact conversation selector. This selector placement is provisional.
- Selecting a room opens exactly one modeless window. Desktop uses a bounded window; mobile uses a partial-height panel. Minimize leaves a named reopening control; expand/reduce changes only the window size. Closing dismisses the activity and keeps its UID-scoped page-memory draft/history position.
- The conversation is outside workspace routes and reader frames. Existing authenticated listeners stay alive across week, workspace and resource changes. Workspace transitions and resource opening minimize it rather than destroy it.
- Public resource panels use the existing dialog/history machinery in modeless mode while a conversation is active. They do not make the conversation or underlying app inert. No modal focus trap is added to the conversation region.
- The window follows the visual viewport and has explicit minimize/expand/details controls. Drag repositioning, window layouts and multiple simultaneously active conversations are outside this experiment.

## One contextual sharing journey

Open the existing KJV reader while a conversation is active. Share in the reader offers Add to the active conversation plus external sharing/copying. Selecting text within verses prioritizes that same-chapter range over the full passage. Opening the composer's plus control offers the current Scripture context as well as manual reference entry and an external link option. Preparing a reference stores a stable draft attachment and opens the conversation for review; only the existing Send reply submits it.

Recipients open the shared reference through the same local/public reader while their conversation remains available. The external link is `?card=reader&ref=...`; it contains no pilot flag, recipient, private room ID, message, draft or membership grant and opens without login. KJV is explicitly identified. No other edition or source text is substituted. Maps, games and Ancient Library remain explorable while a conversation is active, but contextual attachment adapters for those resource types are deferred.

## Validation

`node tests/fellowship-pilot/modeless-browser.cjs` runs focused phone-sized/desktop browser contracts using the actual UI/readers with synthetic Auth/Firestore adapters. It covers direct workspace interaction, nonmodal readers, minimize/expand/reopen, incoming messages while minimized, history position, draft/attachment stability across weeks/workspaces, explicit verse selection, review before send, persisted two-identity delivery, independent private drafts, sign-out cleanup, outsider denial and a public reader link without authentication. `session-check.cjs` separately covers scope isolation and sign-out cleanup. Browser adapters are not an actual Firestore rules engine and do not verify live Google sign-in or physical Safari. The existing household rules were previously emulator-tested and owner-published; this iteration changes none of them.

Screenshots and temporary browser profiles belong under ignored `.pilot-tmp/` on F:. The browser contexts are closed after the focused run. The earlier full browser suite retains its historical inline-UI expectations and is not claimed as rerun; the new focused suite imports only its existing synthetic backend/SDK fixtures.

Recorded results: the final focused modeless phone/desktop browser run passed, including explicit verse selection; the session isolation check passed; JavaScript parsing and scoped whitespace checks passed. Two earlier harness runs required correcting the return-to-MainStage helper and waiting for a changed week's content to load before clicking workspace navigation. No unresolved failure is hidden by those final results. No full regression campaign or live-account destructive testing was run.

## Limits and preview release

Drafts and attachments survive in-page navigation, minimizing, dismissing/reopening and conversation switching. They are intentionally not written to browser storage or restored after reload/sign-out; cross-device/session draft recovery remains undecided. The existing newest-50 message window and its history limit remain unchanged. This experiment does not add read receipts, presence, notifications, emails or new conversations.

The established `tests/fellowship-pilot/package-preview.py --commit <sha>` creates the Hosting-only archive on F:, excluding private account mappings, screenshots, tests, rules and original uploaded reference binaries; runtime corpora remain included. Publication must target only `iphone-pilot` in `homegroups-fellowship`, never the live Hosting channel. Local tooling currently has neither a Firebase CLI login nor an authenticated Firebase management connector, so successful publication requires the owner's existing Cloud Shell session. A Git commit or archive must not be reported as an updated online preview without the Hosting release result.
