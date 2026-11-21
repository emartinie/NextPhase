# Orbit presentation integration review

Initial assessment: 21 November 2026. The owner subsequently authorized the focused presentation implementation below. No production Hosting, live Firebase configuration, rules or real user records were changed.

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

