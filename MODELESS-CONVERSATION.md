# Persistent communication experiment

The later [full-screen Communicator presentation](COMMUNICATOR-PRESENTATION.md) supersedes the floating/dragging visual contract below. This file preserves its implementation and validation history; the messaging, privacy and session-continuity foundations are reused.

## Integration approval — 22 November 2026

The owner approved merging this iteration and cleaning up its disposable artifacts. The owner reports completing the iPhone conversation journey before the latest viewport-only commit; a subsequent phone screenshot shows the full header/week selector and bottom app navigation clear of Safari controls. That screenshot does not expose a build marker, so it is evidence of the observed phone layout rather than independent identification of the deployed commit. The final code checkpoint is `10c2923ff925443f0311d9f31dc78667d970b0b8`; the final viewport, syntax and packaging checks passed as recorded below. Personal design preferences are deferred to future iterations, not treated as blockers to this approved merge.

Merge through the existing PR into the NextPhase development repository. Its existing GitHub Pages publication is separate from the Firebase `iphone-pilot` channel. This approval does not deploy Firebase live Hosting, rules, authentication settings or real records, and does not affect the original HomeGroups production application. The known source/provider, page-memory draft persistence and inherited Orbit lifecycle limitations remain documented. Preserve source tests, uploaded originals, screenshots and useful validation evidence; cleanup is limited to reproducible temporary packaging and disposable browser profiles.

## Visible workspace and Safari chrome — 21 November 2026

### Native browser insetting candidate after phone measurements

Physical review of `07f7cab4` still showed the header beneath the status bar and navigation beneath Safari's toolbar. The owner's iPhone SE reports iOS 26.5.2 and Safari text size **100%**. Its supplied report shows a 375-by-481 visual viewport, zero offsets, scale 1, a 63px header at y=0 and a 60px dock ending at y=481. These apparently valid DOM bounds do not establish that the controls are physically unobstructed. The preceding synthetic checks therefore did not reproduce the remaining presentation failure.

The new candidate removes `viewport-fit=cover` from the viewport meta tag and relies on Safari's default safe-area insetting. This is one reversible viewport policy change, not a guessed status-bar or toolbar height, a navigation redesign or a claim of an identified WebKit bug. Existing grid, viewport/keyboard sizing, pinch zoom, shared activity geometry, themes, readers, conversation state and audio remain unchanged. [WebKit's safe-area explanation](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) documents that the default policy automatically insets content, while `cover` opts out and transfers that responsibility to the page.

The opt-in local layout report additionally records the viewport policy, screen dimensions/pixel ratio, standalone display mode and measured native safe-area insets. This distinguishes device dimensions from the report's historical `screen` object (which contains window dimensions). It contains no account, message, draft, URL, location or storage data and sends nothing automatically. Normal navigation has no new diagnostic interface.

The 22 November focused retry passed the viewport suite: header recovery, toolbar/small-viewport caps, keyboard offsets, narrow/enlarged controls, dock/launcher/handle reachability, conversation/reader bounds, retained workspace/reader/audio state, pinch zoom and the expanded opt-in report. It uses a 60-second timeout through an optional test-only environment setting on this resource-constrained machine; the default remains 12 seconds and assertions were not relaxed. The earlier startup timeout and tool reset remain inconclusive runs, not successful tests. The passing log is ignored under `.pilot-tmp/safari-native-inset-retry-20261122.log`.

Physical iPhone review remains the acceptance gate: refreshed portrait view with Safari controls visible; scroll within the workspace; toolbar collapse/expansion; keyboard open/dismissed in a conversation; landscape; both header controls and bottom navigation reachable. Desktop automation cannot verify native browser-chrome insetting. Do not call this candidate a confirmed fix before that review. No production Hosting, live Firebase, security rules, Authentication or real records are changed.

### Header recovery after physical review

The owner refreshed the hosted `iphone-pilot` build: bottom navigation appeared, but the header disappeared. This supersedes the earlier assumption that the fixed whole-app frame was sufficient. A focused negative-offset fixture reproduced header loss in the previous implementation. It does not establish that the phone supplied that exact offset; device measurements remain necessary if the revision fails physically.

The app is now a stationary normal-flow grid again. Only its available width/height change; it is not translated with `visualViewport.offsetTop/offsetLeft`. The viewport rectangle clamps negative/out-of-layout measurements, and floating activities use its intersection with the app. Page-scroll restoration is reset outside editing/pinch zoom while internal workspace/reader scroll remains intact. The existing small-viewport cap still protects the bottom navigation. Positive keyboard offsets and pinch zoom retain separate floating-window bounds without moving the entire page frame.

The final focused browser check passed negative offsets, stale positive offsets, restored root scroll, simultaneous header/footer boundaries, reader/workspace position, ongoing audio and existing viewport cases. The synthetic conversation journey and package fixture passed. No broad suites were run. The first negative-offset run intentionally failed against the earlier frame, before the fix.

An optional `layout=check` query adds **Copy layout details** only for troubleshooting. It copies local geometry, font size and the public build marker; it does not collect account, conversation, storage, location, URL query/hash or message information, and sends nothing to a service. Normal navigation has no extra diagnostic control. The preview packager stamps `homegroups-build` with the pinned commit and hashes those packaged index bytes; the fixture verifies both. Local previews identify themselves as `local`.

Physical Safari must validate this candidate correction. If the header/footer still differ from the fixture, the owner can copy the readout from the affected phone rather than relying on more guessed CSS. [Apple's developer forum](https://developer.apple.com/forums/thread/800125) records stale visual-viewport offsets after keyboard dismissal; it is relevant context, not a diagnosis of this phone. [MDN offsetTop](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport/offsetTop) defines the coordinate relationship used by the shared geometry.

### Earlier viewport correction

The owner's physical iPhone screenshot showed bottom navigation beneath Safari's floating toolbar, a clipped week selector and outer-page scrolling. This is confirmed visual evidence; the device's exact viewport measurements/OS version were not available, so no specific WebKit defect is asserted as its cause.

`edge-docking.js` initializes one visible workspace rectangle, tracks visual-viewport resize/scroll, browser restoration and header/dock resizing, and publishes the existing window geometry from that rectangle. The first implementation moved the fixed app frame with it; the header-recovery correction above replaces that part. Scrolling stays inside the workspaces. Touch browsers cap the frame at the small viewport height (`100svh`) so essential controls remain conservative when browser chrome expands. This can leave spare background space when browser chrome contracts; it is an intentional safety choice pending physical Safari review, not a fixed guess at toolbar height. Installed/full-screen contexts retain their normal small-viewport extent. Native pinch zoom is not disabled or reflowed by this update.

The header can shrink its brand text while preserving the theme/week controls. Navigation wraps when a narrow screen or enlarged text requires it, and long daily passage labels can wrap. The existing navigation destinations and theme palettes are unchanged. Readers, Conversations, normal launchers, parked arrows and Orbit use the same app bounds. Orbit keeps its position when it fits and clamps when the visible area changes; its media session is untouched. Dock/header ResizeObserver updates also account for native audio controls becoming visible. No conversations, drafts, readers or media are remounted just to resize the app.

Focused validation: `tests/fellowship-pilot/viewport-browser.cjs` covers a simulated browser-toolbar exclusion, a short small-viewport cap despite a tall reported visual viewport, keyboard offsets, 320px width, enlarged header/navigation text, navigation/launcher/arrow reachability, reader/window bounds and retained reading/audio state. Its screenshot `.pilot-tmp/safari-viewport-phone.png` explicitly labels the simulated Safari toolbar; it is not a physical Safari capture. The existing phone audio and synthetic conversation journeys were also checked. No broad regression campaign, production Hosting, authentication, rules or real data changes are part of this patch.

Physical Safari must still confirm the actual toolbar overlap is gone in portrait/landscape, with browser controls shown, keyboard open/dismissed and text/zoom preferences. This code cannot correct an OS viewport report that is inconsistent with every available viewport measurement.

Research references: [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) describes the visible versus layout viewport and keyboard/zoom effects; [WebKit viewport units](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/) explains small versus dynamic browser-chrome sizing. [WebKit report 281063](https://bugs.webkit.org/show_bug.cgi?id=281063) records a similar navigation-bar/viewport-reporting regression; it provides context, not proof about the owner's device.

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
- `edge-docking.js`: shared viewport bounds and edge-handle placement. Orbit's existing dock button uses a second handle slot below Conversations; conversation lifecycle, drafts and authorization remain unchanged. See `ORBIT-PRESENTATION-REVIEW.md` for the later parking checkpoint and focused validation.
- `app.js`: global authenticated host, resource/share handoff and removal of duplicate primary selectors.
- `fellowship-firebase.js`, `fellowship-chats.js`: existing authorization and saved-room picker inside the global list.
- `styles.css`, `theme.css`: centralized activity colors, compact rows/bubbles, clipping, edge arrows, touch/scroll separation and composer sizing.
- `tests/fellowship-pilot/communication-browser.cjs`: actual UI/readers with synthetic Auth/Firestore adapters.

The final focused phone-sized/desktop browser run passed: global Study entrance; one list/chat surface; independent drafts/positions; direct close versus minimize/reopen; left/right mouse and CDP touch docking/retrieval; cancelled drag recovery; keyboard docking; predictable handles across workspace/viewport changes; incoming updates while minimized; no horizontal page overflow; text selection; keyboard-sized composer; selected-Scripture review before send; external-link handoff; persisted two-identity receipt; and sign-out/outsider isolation. Sampled activity text, muted text and accents meet a 4.5:1 contrast threshold against their tested backgrounds across NextPhase, Cosmic, Sapphire, Parchment, Olam HaBa and diagnostic tokens. This does not establish full accessibility compliance. The fixture uses synthetic identities, not the four household account records. These adapters do not replace a rules emulator or live Google sign-in. No rules changed, and this iteration does not claim a new rules test. Earlier household emulator results remain historical evidence.

Screenshots and browser profiles are under ignored `.pilot-tmp/` on F:. Browser contexts close after the run. Review screenshots intentionally remain there for inspection; they are not packaged or committed. No broad regression campaign was run. `session-check.cjs`, JavaScript parsing and scoped whitespace checks passed. An earlier run stalled while accessing the system clipboard and was stopped; the final passing test uses a synthetic clipboard for that contract rather than claiming native clipboard verification. At the preceding checkpoint, a small disposable packaging fixture passed: Hosting-only configuration, Study entrance, runtime corpora included, and raw originals excluded. Packaging code is unchanged in this iteration.

Cleanup removed the interrupted run's artifact directory. Its ignored browser profile `.pilot-tmp/playwright_chromiumdev_profile-T74M7E` remained locked and was retained; no unrelated Chrome process was terminated to remove it. The final passing run closed its contexts and removed its temporary profile normally.

### Deliberate limits

Drafts/attachments survive in-page navigation, switching, minimize and close/reopen, but not reload, sign-out or another device. Sign-out clears UID-scoped private state. Existing newest-50-message/history behavior remains. Real family-account Google provider linkage remains unverified. Physical iPhone Safari must verify header drags versus native edge-back gestures, portrait/landscape safe areas, keyboard opening/dismissal, dynamic browser toolbar movement, arrow reachability, message scrolling/selection and VoiceOver. Automated phone sizing is not a hardware keyboard test. The external-link browser assertion uses a synthetic clipboard to avoid system focus/clipboard dependencies; native share-sheet behavior still needs physical review. No read receipts, presence, unread notifications, new recipients, email invitations or additional backend capabilities were added. General media/menu docking and a handedness preference remain future work; the later Orbit button-parking adapter is documented separately above.

### Existing preview channel only

`tests/fellowship-pilot/package-preview.py --commit <sha>` creates a Hosting-only package, excluding private mappings, screenshots, tests, rules and original uploaded module binaries. Runtime corpora remain included. The preview root now opens Study with the global launcher rather than forcing Fellowship.

Use the owner's existing Cloud Shell and a pinned source commit. Publication must target only `iphone-pilot` in `homegroups-fellowship`, never live Hosting:

`firebase hosting:channel:deploy iphone-pilot --project homegroups-fellowship --expires 7d --no-authorized-domains`

The last flag disables automatic Auth-domain synchronization; see the [official Firebase CLI implementation](https://github.com/firebase/firebase-tools/blob/master/src/commands/hosting-channel-deploy.ts). If the channel hostname lacks Google sign-in authorization, report the blocker rather than changing Auth automatically. A commit or package is not an updated online release. The previously published preview remains the previous build until its release command succeeds.

## Previous experiment checkpoint

`d0b35619417c6677e6a694793c33d0432268df4d` preserves the preceding focused excursion. `1876adf899ec9919b267516f5cd7121e10df2dca` introduced the first modeless conversation; `2a137346cc4cadc236569405ef675fdcfa38c097` documented the no-Auth-domain release guard. In that version the selector remained on Fellowship, workspace changes minimized the chat, and dragging was not implemented. Its `modeless-browser.cjs` and session checks passed using synthetic adapters. Those historical expectations are not the current interaction contract; the new focused suite imports only the existing backend fixtures. The checkpoints preserve the earlier source and notes without maintaining a duplicate application.

`46ed290658ce161f9479f8d98215147f4a228577` preserves the first global list/chat surface with fully bounded dragging and the original green activity styling, before edge docking and slate tokens.
