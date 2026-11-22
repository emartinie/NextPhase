# Orbit presentation integration review

Initial assessment: 21 November 2026. The owner subsequently authorized the focused presentation implementation below. No production Hosting, live Firebase configuration, rules or real user records were changed.

## Unified recorded audio — 21 November 2026

The owner authorized making Orbit the primary recorded-audio controller before the next iPhone review. `audio-session.js` now owns the existing persistent `#audio` element, its current recording, language-aware queue, progress, speed, completion and playback/error state. Orbit no longer creates a second audio element or runs a competing playlist engine. Its circular face, original video (still muted), breathing, orbital controls, parking and retrieval remain intact. Controller removal unsubscribes its audio view and leaves the shared recording in place, exposing the native fallback; this does not claim a complete rewrite of every inherited Orbit listener/timer cleanup path.

Existing weekly orientation and Scripture Listen actions now select that session. Listen builds queues from the same supplied URLs and preserves its existing MP3/provider-link distinction and ESV language filter. Next advances within available recordings; Language cycles only the variants actually supplied for that track. Unsupported Next/Language controls are disabled. Auto-next ends at the end of the queue rather than looping forever; deliberate Next can wrap. A page load never starts an empty or unsolicited recording. Opening a different week/resource does not silently replace the active recording or its queue. Reopening the same source preserves its current position.

Orbit observes actual native media events for its title, Play/Pause, progress ring, rate and compact status. Blocked playback offers a deliberate Play retry, and unavailable recordings have a clear error. Stale play promises cannot overwrite a newer selection or undo Pause/Stop. The scrolling duplicated title is replaced by stationary compact playback status. Source URLs accept HTTP(S); no uploads, new content, external credentials or provider substitutions were introduced.

The original native control element remains mounted outside Orbit and resource panels. Listen's **Playback controls** reveals the existing dock controls and dismisses the resource panel through its normal history path, making seeking and Close/Stop reachable without another window. It also acts as the fallback when Orbit is absent. Parking keeps the same audio element, source and time; it does not pause or reload audio.

The supplied Alephbet song now uses that same element. Its lesson keeps a Playback controls action; leaving the lesson disposes local observers while the recording continues under Orbit. Explicit lesson changes retain their pause behavior. Article read-aloud and Greek pronunciation still use device speech, which cannot be converted into a seekable HTML audio recording by this patch. They claim shared sound ownership: starting speech pauses recorded audio; starting recorded audio, including through native controls, cancels the application's owned speech and resets its local controls. Finishing speech does not automatically restart a recording. Speech retains its existing local controls and panel cleanup. Orbit does not pretend its ring measures synthesized speech.

Focused validation for this iteration is recorded with the development checkpoint: deterministic session tests cover switching, completion, language availability, URL validation, same-source position, speech ownership, late completion/failure races, blocked-play retry and Stop. Phone-sized touch and desktop browser journeys use the actual Listen/Orbit interface and synthetic WAV responses with valid range delivery. They cover one media element, pause/resume, rate, seeking/progress, parked workspace continuity, playlist/language controls, failure/recovery, native fallback and Stop. This is not a new live-provider availability audit. The focused Learning sound check uses the supplied local Alephbet file and synthetic device speech. The inherited broader Learning test's two audio selectors were updated for the shared element; unrelated Learning tests were not reopened.

Physical iPhone Safari must still verify a real supplied recording, first-tap playback, pause/resume, native seeking, parked playback, orientation/browser controls, interruption by another app and the device's actual voices. Background/lock-screen continuity depends on Safari and iOS and is not guaranteed here. Media Session/lock-screen integration, reload/device playback recovery, externally embedded players and a curated replacement of broken legacy provider URLs remain deferred. These changes do not modify Firebase rules, authentication, member records, messaging or database structures. No main merge or Hosting release is included.

Historical statements below that describe independent audio engines or defer shared audio ownership are superseded by this section; they remain as source provenance and defect history.

Final focused results:

- `tests/fellowship-pilot/audio-session-check.cjs`: passed deterministic playback, queue, speech-ownership, cancellation and error contracts.
- `tests/fellowship-pilot/audio-browser.cjs`: passed phone-sized touch and desktop journeys; the final phone run includes native fallback focus after resource dismissal. Synthetic WAV responses test delivery/seek behavior without claiming the original remote providers are available. The fixture was corrected to supply byte ranges; a direct `card=listen` reference opens the separate Learning Listen shelf, so this check uses the actual MainStage Listen → Scripture audio journey.
- `tests/fellowship-pilot/audio-learning-browser.cjs`: passed the actual supplied local Alephbet file, lesson-close continuity, retained position, and coordinated article/Greek speech with a synthetic device voice.
- `tests/fellowship-pilot/orbit-browser.cjs --phone-only`: passed original media/face/ring/controls and parking with the shared element. Its old private-element/data-URL setup was replaced by the shared-session HTTP fixture.
- `tests/fellowship-pilot/communication-browser.cjs`: final run passed the existing synthetic identity, draft, positioning, Scripture, receipt and account-isolation journey. An earlier run hit the previously recorded resize timing failure; `bounded()` now waits for actual geometry before retaining all original boundary assertions. No conversation implementation or permission checks were changed.
- JavaScript parsing and `tests/fellowship-pilot/orbit-package-check.py`: passed. The package fixture explicitly includes `audio-session.js` and verifies original media bytes, exclusion rules and Hosting-only configuration; it removed its disposable directory.

The phone playing screenshot is `.pilot-tmp/orbit-audio-playing-phone.png`. Screenshots and logs remain on F: for review, outside the package. Browser contexts closed; no new browser-profile directories remained after the final runs. Previously locked profiles from earlier iterations were retained. No broad regression campaign or live-account destructive testing was run.

## Existing dock button: side parking — 21 November 2026

Subsequent owner refinement: Cosmic Glass is now the global visual reference and startup palette for sessions without a valid saved preference. The entry HTML and browser theme color match that baseline before application startup; Theme Manager still honors personal saved choices and retains every palette and diagnostic shortcut. Orbit's former **⫶** glyph is now an outward **›** or **‹**, refreshed on hover/focus/touch, drag completion and retrieval to reflect the nearer parking edge. Its retrieval arrow points inward. This changes presentation only; the established button-parking/media behavior remains. The existing Theme Manager suite passed at phone and desktop sizes for default appearance, unsaved-preview rollback, saved-theme reload, alternative palettes and diagnostics. The focused phone Orbit suite passed with both arrow directions. No online publication occurred.

The owner authorized reusing the existing right-hand **⫶** control. It now parks the same player at the nearer left or right screen edge and exposes a 44-pixel retrieval arrow. Restoring reveals the existing player, selected face and media elements; parking does not pause, reload, replace or create playback. The old dock-bar/container interaction is removed. This is button-driven parking; the player's legacy body drag/snap behavior remains unchanged.

`edge-docking.js` extracts the existing conversation bounds/handle placement into a small shared helper. Conversations retain their original center handle slot; Orbit uses the next slot, 52 pixels lower, to keep both arrows reachable. Handles follow viewport changes and safe horizontal insets. Restoration clamps Orbit to the available workspace with orbital-control clearance where space permits. No new theme colors or window surface were introduced. Hidden waveform drawing stops and resumes on restoration; its existing decorative random-bar behavior remains.

Focused validation passed separately at phone and desktop sizes: actual dock-button parking on both sides, retrieval, retained audio/video node identity, continued synthetic silent-track playback while parked, selected video face, separate conversation/Orbit handles, viewport resizing, original logo transparency, video switching, progress geometry, breathing, other controls and native Scripture audio preservation. The left-side test positions the player explicitly before pressing the real button; it does not claim validation of legacy body dragging. The existing synthetic conversation journey also passed after the geometry extraction, including independent drafts/positions, touch/mouse docking, Scripture review/send and account isolation. Its launcher selector now distinguishes the two activities, and completed contexts close earlier to limit memory use.

The package fixture passed with the shared helper included, exact original media bytes, unrelated-upload exclusion and missing-media guard. Phone/desktop runs were serialized after an earlier overlapping attempt hit Windows memory limits. A first Orbit run exposed an unreliable left-drag test setup; the final checks use the explicit placement described above. Screenshots/logs stay under ignored `.pilot-tmp` on F:, outside the published package.

Physical iPhone Safari remains unverified for the new button: tap **⫶**, continue listening, retrieve using the arrow, park both activities, rotate the phone and open/dismiss the keyboard. Safari may manage hidden/background video differently from Chrome; no uninterrupted-video guarantee is inferred from the automated result. Audio ownership, weekly queue integration, full lifecycle cleanup and drag-to-edge Orbit parking remain separate future work. No Hosting deployment or main merge is part of this change. The historical assessment below describes the earlier versions and is retained for provenance; its dock-button deferral is superseded by this section.

## Authorized presentation implementation

The existing pilot now includes the owner's imported saved player, face adapter and byte-identical original media. The uploaded source remains preserved on main at `1c7f797d44af0364f8243357485dd7f6a47983bc`; the pilot work builds on `e207ff867298cadee0c356868da2cd0efcdb2227`. Integration is restricted to the development branch, not a publication or main-branch update.

Applied changes:

- Added `orbit-player.css`, scoped to `#floatingPlayer`, restoring the original `.hidden` semantics, explicit 170px progress size and the local glow/face/progress/controls layer order. Existing global SVG sizing and Theme Manager palettes remain unchanged.
- In `SAVEorbitFloatingPlayer.js`, added stable styling hooks, a 170-unit viewBox and two-axis SVG centering. Kept the circle geometry, progress calculations, playlist handlers and original breathing/glow/orbital controls. Initial placement now centers the player above the existing dock with control clearance, and its root layer sits below readers and conversations. A button-target guard prevents the legacy drag handler from snapping Orbit when a control is pressed. These are presentation/interaction changes, not playback changes.
- In `bullseyeMedia.js`, assigned face classes and removed the conflicting inline face z-index values so the scoped layers apply. Kept the owner's correct relative asset paths, mode-switch logic, original video and waveform behavior.
- Added the stylesheet and the two classic script hooks to the pilot's current `index.html`, preserving its conversation and resource headers rather than replacing that file with main's older version.
- Added only `HGHousesnew.png` and `bg-motion.mp4` to the preview packager's explicit asset allowlist. Packaging now fails clearly if either is absent; arbitrary root uploads remain excluded. `serve-preparedness.cjs` supplies PNG/MP4 media types and retains its existing byte-range support.
- Restored local asset bytes from existing F: reference/backup files, with Git-blob SHA-1 checks against the owner's exact uploads. No source backup was moved, modified or deleted; no alternative image or video was substituted.

The owner's nine existing commits are retained as the source history: `a284da9b`, `ee7a8159`, `7e48c5cd`, `e18b9152`, `9261e48f`, `db0582da`, `6c796f8d`, `cec7ed74`, `1c7f797d`. Comparison with the common baseline confirmed only five affected paths: the two scripts, two media assets and entry HTML. No unrelated main-branch changes were imported.

Validation:

- `tests/fellowship-pilot/orbit-browser.cjs`: phone-sized and desktop checks passed for exclusive logo/video/waveform visibility, exact logo decoding, actual local muted inline MP4 playback and pause, centered progress geometry at multiple values, preserved animation and controls, existing native audio, global conversation/menu access, MIME types and byte-range delivery. After the button-target guard, the final run also checks that controls do not snap the player. Final result is recorded at the source checkpoint.
- `tests/fellowship-pilot/communication-browser.cjs`: the focused synthetic-account journey passed with Orbit present, retaining drafts, positions, edge docking, background updates, Scripture review/send, external-link handoff and account isolation. An earlier run reported an out-of-bounds keyboard-sized geometry check; the final rerun passed without removing that assertion. Physical Safari viewport behavior remains a required review item.
- `tests/fellowship-pilot/orbit-package-check.py`: exact uploaded asset hashes/bytes, media inclusion, unrelated-upload exclusion, Hosting-only configuration and missing-media guard passed. The disposable fixture was automatically removed.
- Syntax/whitespace checks accompany the checkpoint. No broad regression campaign, live-account destructive testing, rules deployment, production Hosting publication or main merge is part of this patch.

Physical iPhone review: repeat Video on/off and return to the logo, inspect ring alignment during breathing, confirm orbital buttons remain tappable, and verify conversation/reader controls and native media playback still behave as expected. The browser run does not establish Safari-specific autoplay/touch behavior or shared audio ownership. Orbit's old drag/snap behavior remains; the shared edge-minimize adapter is a subsequent focused iteration.

## Original assessment and preserved findings

### Logo transparency correction after iPhone review

The owner's subsequent screenshots exposed the opaque background of the uploaded `HGHousesnew.png`. Inspection confirmed RGB format at 1362 by 1155 with no alpha channel; the near-black corners are actual image pixels, not a CSS background. The uploaded file and its recorded hash remain untouched.

Orbit now uses the existing original HomeGroups `images/HGHouses.png`, copied byte-for-byte as `HGHouses-transparent.png`: RGBA, 398 by 335, alpha range 0–255, Git blob `0f37a658f3077ee94c362eab0c2608657c6db69d`. It is an older, lower-resolution rendition of the logo, not a background-removal edit or regenerated image. Its source copy remains unchanged. The face adapter changes only its image path for this correction; video, styling, controls and playback are unchanged.

The packaging allowlist now includes this transparent runtime asset as well as the preserved opaque upload and original video. The package integrity fixture checks all three exact hashes/bytes. Browser verification samples the decoded logo's actual alpha pixels and confirms that transparent surroundings and opaque artwork coexist. No broad regression run is required for this asset/path correction; physical iPhone confirmation remains the owner's next review step.

## Reviewed versions and integration location

At initial review, the uploaded integration was on NextPhase main at commit `1c7f797d44af0364f8243357485dd7f6a47983bc` and was not present in the local pilot checkout or conversation experiment checkpoint `e207ff867298cadee0c356868da2cd0efcdb2227`. The implementation above subsequently carried its assets and deliberate script/style hooks into the pilot without replacing the pilot's index/app/styles with main's older versions.

- [NextPhase entry](https://github.com/emartinie/NextPhase/blob/1c7f797d44af0364f8243357485dd7f6a47983bc/index.html#L63): loads `SAVEorbitFloatingPlayer.js`, then `bullseyeMedia.js`.
- [Saved player](https://github.com/emartinie/NextPhase/blob/1c7f797d44af0364f8243357485dd7f6a47983bc/SAVEorbitFloatingPlayer.js): blob `7a34f8ee7c9c03bf8266c9f46015611f8686f29c`.
- [Face adapter](https://github.com/emartinie/NextPhase/blob/1c7f797d44af0364f8243357485dd7f6a47983bc/bullseyeMedia.js): blob `f736ce97f05718ceae16f6e8cb40c6701c49b9fb`.
- Root assets: `HGHousesnew.png` (1,258,063 bytes) and `bg-motion.mp4` (4,569,043 bytes). The current adapter paths match the uploaded names and case.
- [Original saved source](https://github.com/emartinie/HGBibleApp/blob/e34bba17f78cb093cb15b63260b00f553d50b37e/js/SAVEorbitFloatingPlayer.js): identical to the NextPhase upload after normalizing CRLF/LF line endings.
- [Original face adapter](https://github.com/emartinie/HGBibleApp/blob/e34bba17f78cb093cb15b63260b00f553d50b37e/js/bullseyeMedia.js): the NextPhase copy changes only the two asset paths. The newer `js/orbitFloatingPlayer.js` is a materially different implementation and should not silently replace this saved version.

The owner verified rendering, controls and original background-video playback on a physical iPhone. This review verified source contracts and file metadata, not a new physical-device playback or computed-style test. No media was downloaded or played by the reviewer.

## Finding 1: missing visibility dependency explains the face layering

[Original index lines 94–96](https://github.com/emartinie/HGBibleApp/blob/e34bba17f78cb093cb15b63260b00f553d50b37e/index.html#L94) define the `.hidden` class as `display:none!important`; the original page also loads Tailwind at line 41.

The imported adapter assigns `.hidden` to video and canvas (lines 50 and 67), then toggles that class between the logo, video and waveform (lines 83–96). NextPhase's reviewed stylesheets define `[hidden]` for the HTML attribute, but do not define the `.hidden` class. These are different contracts.

Both logo and video are positioned at the center with inline z-index 10000. Video is appended later (adapter lines 41–63), so with both visible its equal stacking level paints over the logo. A higher logo z-index alone would break the opposite transition instead of making modes exclusive.

Smallest compatibility fix: restore visibility semantics only inside `#floatingPlayer`, or deliberately change this adapter to use the already-supported HTML hidden attribute. A scoped class rule is the smaller first patch and avoids adding Tailwind or altering global visibility behavior. Test initial logo, video toggle on/off, and waveform toggle; exactly one face should be visible, and inactive video should be paused by the existing logic.

## Finding 2: global icon sizing displaces the SVG progress ring

[NextPhase styles.css line 2](https://github.com/emartinie/NextPhase/blob/1c7f797d44af0364f8243357485dd7f6a47983bc/styles.css#L2) sets every SVG to 23-by-23 CSS pixels for interface icons.

[Saved player lines 89–120](https://github.com/emartinie/NextPhase/blob/1c7f797d44af0364f8243357485dd7f6a47983bc/SAVEorbitFloatingPlayer.js#L89) create a 170-by-170 SVG through attributes, with circle center (85,85), radius 76 and stroke width 6. The SVG has no viewBox or inline CSS width/height. The stylesheet dimensions override the attribute-based sizing. With overflow visible, the circle keeps its large internal coordinates while the much smaller SVG box is centered, explaining the apparent displacement.

Smallest fix: give only this progress SVG explicit CSS dimensions consistent with its 170-unit coordinates; center it on both axes. Adding a 0 0 170 170 viewBox makes future proportional sizing explicit. Do not change NextPhase's global icon rule or redesign the ring.

## Finding 3: local layering must accompany the geometry fix

The face adapter gives the media z-index 10000, while the saved SVG has no explicit z-index. Once the SVG is correctly centered it can be obscured by the full-size circular video. Define a small Orbit-local ordering: background/glow, active face, progress ring, then title/play/orbital controls. Prefer a few stable class hooks with scoped rules; do not escalate global z-index values or create another overlay/window.

Preserve the current circular clipping, original video, button locations and breathing/glow animation. The face media already have pointer-events:none; keep that property so presentation layers do not intercept controls.

## Recommended next focused implementation

1. Bring the exact uploaded Orbit scripts/assets and their entry hooks into the existing pilot branch without replacing its other files.
2. Add a small scoped Orbit compatibility stylesheet, loaded after the existing shared styles, with visibility, progress geometry and local stacking rules. Add only minimal class hooks in the imported constructors where needed. No broad NextPhase CSS rewrite, Tailwind import, playback changes or replacement player.
3. Explicitly include the two root media assets in `tests/fellowship-pilot/package-preview.py` before any future preview release. Its current allowlist includes root HTML/JS/CSS and runtime corpus files; root PNG/MP4 files are not included. Adding scripts alone would publish a player with missing imagery/video.
4. Validate the actual face-switch sequence and centered ring on phone and desktop, several progress values, orbital-control hit targets, breathing and original video. Recheck physical iPhone Safari inline video and media controls. Retain conversation controls and existing app icons unchanged.
5. After that presentation patch is reviewed, adapt the proven edge-minimize/retrieval behavior to Orbit without mounting a second player or creating another playback engine.

These were the initial recommendations. The authorized presentation items are now implemented as recorded above; shared edge docking remains subsequent work. No production deployment is proposed.

## Preserved legacy limitations and future integration work

- The saved player creates a separate audio element (lines 191–195). NextPhase already uses its native `#audio` player (`app.js` lines 31 and 811–827). Shared playback ownership and prevention of overlapping audio are future integration work; neither engine should be changed during the presentation patch.
- The saved player consumes `window.weekData` and `player:updatePlaylist` / `player:setLang` (lines 459–465). These hooks are not currently emitted by the inspected local NextPhase app. Visible Orbit controls do not establish connection to weekly-study playback.
- Its existing Dock control expects `floating-player-root` or `playerHost` (lines 333–379), neither present in the reviewed NextPhase entry. Its four-edge snap behavior (lines 445–457) is not Conversations' edge minimization. Those should be integrated intentionally later, not enabled by reproducing obsolete dock containers.
- The animation injected at lines 473–514 moves/rotates the outer player slightly. A later docking adapter must account for that animated geometry while preserving the visual effect; reduced-motion behavior also needs review.
- The global player/audio variables are shadowed by setup-local constants (lines 4–5 versus 21 and 192), so `destroyFloatingPlayer` at lines 539–553 does not own the live instances. The optional resource-manager hooks are commented out. This cleanup defect must be addressed before reusable persistent mounting/unmounting is claimed.
- The waveform adapter draws random bars, not measured audio samples. Preserve it as an existing visual mode without representing it as a real audio analyzer.
- The first optional timer block looks up the player before it has been appended (lines 45–73), so that block is inactive on normal setup; the later injected animation supplies the visible motion. Do not revive the inactive auto-orbit timer as part of fixing CSS.
- At initial review the script's root z-index 9999 sat above the conversation experiment's layer 10. The compatibility patch lowers Orbit's root to layer 3 so readers and conversations retain priority; shared retrieval-handle collision rules remain part of the later docking step.

These are recorded rather than silently fixed or discarded. They do not require changing audio playback to correct the two reported presentation problems.

