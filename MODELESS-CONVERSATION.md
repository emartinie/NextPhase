# Persistent communication experiment

## Current iteration — 21 November 2026

This reversible experiment continues `feature/operational-fellowship-pilot` after checkpoint `46ed290658ce161f9479f8d98215147f4a228577`. It reuses the existing Firebase SDK, authentication, membership checks, immutable message schema, provisioned rooms, Theme Manager and public readers. No live records, rules, database structures or authentication configuration were changed.

### One surface, available globally

- The communication launcher is available from Study and across the workspace in the Firebase pilot. It opens the conversation list rather than navigating to Fellowship. Shared room entries recheck membership when opened; private entries come from scoped saved-pairing queries. No presence, unread counts, preview text or activity is fabricated.
- Selecting a room or person replaces the list with the conversation inside the same surface. Back restores the list. Each account/conversation retains its independent page-memory draft, Scripture attachment and supported message position.
- Minimize keeps the current list/chat view and now uses an edge arrow. Direct **×** dismisses the surface in one action, stops that chat listener and clears the implicit sharing destination; reopening shows the list with the normal global launcher. Closing does not erase saved messages or the page-memory draft.
- Header dragging works with pointer capture on touch and mouse, with a small movement threshold. Only the title/grip is draggable; message scrolling and text selection retain their own gestures. Vertical movement stays bounded. Horizontal dragging may cross either edge; releasing with clear edge intent hides the surface and leaves its arrow. Cancelled drags snap safely back onscreen. A noninteractive clipping layer prevents offscreen movement from creating page overflow; it has no additional visible panel.
- Edge docking uses the existing `minimized` mode, not a separate lifecycle state. The same launcher becomes a 44-by-44-pixel arrow target at the center of the usable viewport on the chosen side. It does not track the arbitrary release height or workspace content. The minus button uses the last side, initially right. The side lasts for the current page/account session; no handedness setting or new persistence mechanism was added.
- The grip supports arrow keys, Home to reset placement, and Alt+Left/Right to dock without dragging. Reopening clamps the retained window to the usable screen, keeps the current list/chat view and resumes its supported position/draft. Existing incoming updates continue while minimized; they do not force reopening or invent unread counts. Expanded/reduced sizes respect the app bar and dock when space permits.
- Opening a resource or changing workspaces does not automatically minimize the conversation. It remains visible in the chosen position until the user moves, minimizes or closes it.
- The composer remains inside the viewport-sized surface. Resize/keyboard-sized layouts re-clamp the window. This is browser validation, not proof of every physical Safari keyboard/browser-bar behavior.
- Incoming and outgoing messages use compact, differentiated bubbles. A saved checkmark means persistence, not that the recipient read the message. Member details are an inline disclosure; the primary journey has no nested close panel or second messaging selector on Fellowship.
- The normal phone footprint is reduced to at most 312 pixels high and 92% of usable width. Centralized communication role tokens in `theme.css` provide a charcoal/slate surface with blue outgoing bubbles and restrained green/blue accents. Parchment receives a light slate variant and the diagnostic palette remains conspicuous. Existing theme selection and unrelated workspace colors are unchanged.
- Fellowship keeps the existing map, community discovery and contextual tools. Its conversation/community actions hand off to the same global surface, without navigating away from the workspace. Unsupported map-to-private-chat invitations have not been invented or permission checks bypassed.

### Contextual Scripture sharing

The existing public KJV reader remains available beside the conversation. Selected verses take priority over the current passage. **Add to chat** prepares a stable Scripture reference in the active draft; it does not send. The user reviews and deliberately sends through the existing message operation. The composer plus control also retains the manual-reference and external-sharing options.

Back to the list and Close clear the implicit recipient. With no active conversation, reader **Share** uses external sharing/copying. Public links contain no account, room, draft or membership grant. Opening a reader uses the existing modeless resource/history machinery in Firebase communication mode. Other resource types remain explorable; new attachment adapters for maps, games and ancient texts are deferred.

### Files and focused validation

- `conversation-window.js`: list/chat lifecycle, global launcher, dragging, viewport bounds and direct close.
- `app.js`: global authenticated host, resource/share handoff and removal of duplicate primary selectors.
- `fellowship-firebase.js`, `fellowship-chats.js`: existing authorization and saved-room picker inside the global list.
- `styles.css`, `theme.css`: centralized activity colors, compact rows/bubbles, clipping, edge arrows, touch/scroll separation and composer sizing.
- `tests/fellowship-pilot/communication-browser.cjs`: actual UI/readers with synthetic Auth/Firestore adapters.

The final focused phone-sized/desktop browser run passed: global Study entrance; one list/chat surface; independent drafts/positions; direct close versus minimize/reopen; left/right mouse and CDP touch docking/retrieval; cancelled drag recovery; keyboard docking; predictable handles across workspace/viewport changes; incoming updates while minimized; no horizontal page overflow; text selection; keyboard-sized composer; selected-Scripture review before send; external-link handoff; persisted two-identity receipt; and sign-out/outsider isolation. Sampled activity text, muted text and accents meet a 4.5:1 contrast threshold against their tested backgrounds across NextPhase, Cosmic, Sapphire, Parchment, Olam HaBa and diagnostic tokens. This does not establish full accessibility compliance. The fixture uses synthetic identities, not the four household account records. These adapters do not replace a rules emulator or live Google sign-in. No rules changed, and this iteration does not claim a new rules test. Earlier household emulator results remain historical evidence.

Screenshots and browser profiles are under ignored `.pilot-tmp/` on F:. Browser contexts close after the run. Review screenshots intentionally remain there for inspection; they are not packaged or committed. No broad regression campaign was run. `session-check.cjs`, JavaScript parsing and scoped whitespace checks passed. An earlier run stalled while accessing the system clipboard and was stopped; the final passing test uses a synthetic clipboard for that contract rather than claiming native clipboard verification. At the preceding checkpoint, a small disposable packaging fixture passed: Hosting-only configuration, Study entrance, runtime corpora included, and raw originals excluded. Packaging code is unchanged in this iteration.

Cleanup removed the interrupted run's artifact directory. Its ignored browser profile `.pilot-tmp/playwright_chromiumdev_profile-T74M7E` remained locked and was retained; no unrelated Chrome process was terminated to remove it. The final passing run closed its contexts and removed its temporary profile normally.

### Deliberate limits

Drafts/attachments survive in-page navigation, switching, minimize and close/reopen, but not reload, sign-out or another device. Sign-out clears UID-scoped private state. Existing newest-50-message/history behavior remains. Real family-account Google provider linkage remains unverified. Physical iPhone Safari must verify header drags versus native edge-back gestures, portrait/landscape safe areas, keyboard opening/dismissal, dynamic browser toolbar movement, arrow reachability, message scrolling/selection and VoiceOver. Automated phone sizing is not a hardware keyboard test. The external-link browser assertion uses a synthetic clipboard to avoid system focus/clipboard dependencies; native share-sheet behavior still needs physical review. No read receipts, presence, unread notifications, new recipients, email invitations or additional backend capabilities were added. Orbit/media/menu docking and a handedness preference are future work, not implemented here.

### Existing preview channel only

`tests/fellowship-pilot/package-preview.py --commit <sha>` creates a Hosting-only package, excluding private mappings, screenshots, tests, rules and original uploaded module binaries. Runtime corpora remain included. The preview root now opens Study with the global launcher rather than forcing Fellowship.

Use the owner's existing Cloud Shell and a pinned source commit. Publication must target only `iphone-pilot` in `homegroups-fellowship`, never live Hosting:

`firebase hosting:channel:deploy iphone-pilot --project homegroups-fellowship --expires 7d --no-authorized-domains`

The last flag disables automatic Auth-domain synchronization; see the [official Firebase CLI implementation](https://github.com/firebase/firebase-tools/blob/master/src/commands/hosting-channel-deploy.ts). If the channel hostname lacks Google sign-in authorization, report the blocker rather than changing Auth automatically. A commit or package is not an updated online release. The previously published preview remains the previous build until its release command succeeds.

## Previous experiment checkpoint

`d0b35619417c6677e6a694793c33d0432268df4d` preserves the preceding focused excursion. `1876adf899ec9919b267516f5cd7121e10df2dca` introduced the first modeless conversation; `2a137346cc4cadc236569405ef675fdcfa38c097` documented the no-Auth-domain release guard. In that version the selector remained on Fellowship, workspace changes minimized the chat, and dragging was not implemented. Its `modeless-browser.cjs` and session checks passed using synthetic adapters. Those historical expectations are not the current interaction contract; the new focused suite imports only the existing backend fixtures. The checkpoints preserve the earlier source and notes without maintaining a duplicate application.

`46ed290658ce161f9479f8d98215147f4a228577` preserves the first global list/chat surface with fully bounded dragging and the original green activity styling, before edge docking and slate tokens.
