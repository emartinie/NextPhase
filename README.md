# NextPhase · HomeGroups

NextPhase opens to the current weekly Bible study. It is a development and review environment. The default demo mode includes local simulated Fellowship discussions, private conversations, games and preparedness exercises. The separate HomeGroups Fellowship Firebase pilot uses real authentication and authorized persisted messages; see its operational section below. Neither mode connects to the original HomeGroups production data.

- **Study** has the weekly schedule, daily readings, Passage reader, and personal notes.
- **Study Tools** opens Covenants & Commandments, New Testament Notes, Hebrew Library, Teachers & Scholars, Sources and Investigations, Learning, Prayer Map, and Calendar.
- **Study discussion** flips to the current week's Fellowship. Game invitations remain in its contextual actions.
- The workspace order is **MainStage → Learning Hub → Preparedness**. Swipe across a card surface or use the compact **‹ / ›** dock controls to move to the adjacent workspace. The Preparedness front hosts the existing catalog, Radio Map, radio resources, research, and **The Common Ground**. **Communications** flips to the existing Wednesday drill and a local preparedness conversation. Swipe right or use **‹** to return through Learning Hub to MainStage. Each card keeps its own face, scroll positions, disclosures, and drafts for the open session. Maps, fields, horizontal readers, open panels, and the browser's edge gestures retain their own interactions.
- All three cards use the existing Theme Manager, media dock, modal excursions, browser history, and local Fellowship reply controls. Preparedness discussions are browser-local demonstrations. Authenticated preparedness membership and delivery require a separately reviewed integration with the existing Fellowship infrastructure.
- The **Theme Manager** in the header previews the original Cosmic Glass, Midnight Sapphire, and Ancient Parchment palettes adapted to the NextPhase layout. Save a theme to keep it in the current browser. Leaving an unsaved preview restores the saved appearance. Open the temporary diagnostic palette with `Ctrl+Alt+Shift+D` or by tapping the study title five times within three seconds. [HomeGroups theme diagnostic](https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/js/themeDiagnostic.js)
- **Olam HaBa** (עולם הבא, The World to Come) uses a static gradient atmosphere and shared glass tokens for the app chrome and dialogs. Compact surfaces use blur where available, with solid surfaces as a fallback. Expanded reading panels use solid glass colors. The same glass tokens are available for future floating controls.

## Learning Hub workspace

Learning Hub reuses the existing Learning Paths, Articles, Hebrew and Greek Language Lab, Visual Teachings, Topical Teachings, Assessments, Teachers & Scholars, Sources Library, Listen, and Investigations. Open **?workspace=learning**, or use the existing Study Tools shortcut.

**Fellowship** flips the card to learning conversations. **Discuss** in a learning-resource panel opens a conversation for that resource. **Return to resource** restores the retained panel and its exact position during the session. **Continue learning** on the front resumes the latest learning activity. Both use the existing readers and shared local Fellowship composer, posts, drafts, and Scripture attachments.

Replies, drafts, conversation references, the latest resource reference, and the original learning-path progress persist in this browser. Exact panel scroll, alphabet selection, and other view controls are retained within the current session. After a reload, the resource opens from its saved reference and its own supported progress. The four unavailable legacy learning paths remain identified as unavailable. Shared authenticated learning conversations require a future approved Fellowship integration.

Learning Hub has its own independent face and scroll state alongside MainStage and Preparedness. The week chooser remains specific to MainStage. Existing contextual Study Tools links continue to work with their original workspace context.

Run **node check-learning-workspace.cjs** for the new interaction checks, **node check-learning.cjs** for the reused learning resources, and **node check-workspaces.cjs** for the shared swipe/flip navigation. Tests use **F:\Development\NextPhase-Temp** when launched with the configured temporary-file environment. Physical iPhone Safari remains a review step.

## Local review

Run `node serve-preparedness.cjs` and open [the local preview](http://127.0.0.1:8767/). Node is required for the local server and tests. The app itself is static and loads from the repository root with no build step.

Install Playwright with Chromium to run the suites below. Set `NEXTPHASE_PLAYWRIGHT` to an existing Playwright module or `NEXTPHASE_CHROME` to a local Chromium executable. Each suite serves the app under `/NextPhase/` to exercise project-site URLs.

```text
node check.cjs
node check-study-tools.cjs
node check-fellowship-games.cjs
node check-preparedness.cjs
node check-learning.cjs
node check-calendar.cjs
node check-people.cjs
node check-theme.cjs
node check-olam-haba.cjs
node check-workspaces.cjs
node check-common-ground.cjs
node check-learning-workspace.cjs
```

The [MainStage notes](MAINSTAGE-REVIEW.md) describe reader and schedule limitations. The [migration notes](LEARNING-MIGRATION.md) record Learning, Calendar, and source curation. The [HomeGroups source license](corpus/LICENSE) is bundled. Third-party source attribution and applicable reuse notices appear with their respective editions.

## Fellowship community map

Open **Fellowship** to explore the map. **World**, **Nearby**, zoom, and **People** sit inside the map. The weekly discussion is directly below it. The local discussion demo is optional, while the signed-in preview shows authorized replies from the Wednesday HomeGroup pilot. **Study** flips back to the reading, and the **Fellowship actions** menu holds games, archives, and the other contextual tools.

**Invitations** includes a local sample with Accept and Decline. Acceptance in that sample opens the existing demo conversation, and decline closes off that path. The email version uses a one-time decision link. The server checks the sender’s Wednesday HomeGroup access and looks up the recipient’s address from the matching original map outside the public directory. The decision page never includes the recipient’s contact information.

Live email still needs a private backend reachable by recipients, durable invitation and rate-limit storage, and a private messaging path after acceptance. The current server verifies the flow with local settings `FELLOWSHIP_INVITE_MAP_SOURCE` (private path to the exact original GeoJSON), `FELLOWSHIP_INVITE_FROM` (approved address on a verified sending domain), `FELLOWSHIP_INVITE_RESEND_KEY` (server-only mail credential), `FELLOWSHIP_INVITE_ACCESS_THREAD` (existing private Week 7 document ID), and `FELLOWSHIP_INVITE_REVIEW_URL` (HTTPS Fellowship review page served by the same invite backend). The local preview leaves mail delivery disabled. Invitation state and the three-per-sender daily limit are in memory and reset with a server restart. Keep the raw map and provider key outside the static server root. [Email API](https://resend.com/features/email-api) · [Firebase Hosting backend options](https://firebase.google.com/docs/hosting/functions)

The map uses the 2,000 listings in the original feed at blob `020d27841c604da018747f9e6b6d33170a7be71e`. The exporter accepts the visibility value present in that audited feed and keeps the original layer's two-decimal marker precision. Marker profiles can show a display name, explicitly labeled city, state or province, and country, public notes, and a website. The exporter strips contact fields and redacts contact details and exact coordinate pairs it recognizes in free text. Direct messaging links are excluded. The browser renders the filtered profile and never loads the raw source. Markers show legacy listings. Group participation and permissions still depend on Fellowship membership. [Original map feed](https://github.com/emartinie/HGBibleApp/blob/main/data/HomeGroupsMap.geojson) · [Legacy map implementation](https://github.com/emartinie/HGBibleApp/blob/main/js/prayermap.js)

Fellowship starts at world scale and requests the visitor's location once. On permission, the map rounds the position to one decimal in memory and fits and highlights up to 100 closest listings. Manual pan or zoom restores the full marker layer for exploration. Selecting a marker cancels any pending automatic location change. **View World** returns to the global view, and **Find nearby** can request the visitor's location again. The app uses the device position in memory. The street-map provider receives raster tile requests for the viewed area, including the view selected automatically, without the visitor's coordinates or member records. [Geolocation permission and privacy](https://www.w3.org/TR/geolocation/#privacy)

OpenStreetMap provides roads and place labels when its tiles are available. The app requests only tiles intersecting the settled view and lets the browser honor the provider’s cache headers. The local overview uses the Natural Earth v5.1.2 land outline, 1:110m country and state/province boundaries, and 1:50m populated places. It remains available without a tile connection. [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/) · [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)

Refresh the snapshot with `node collect-fellowship-map.cjs <legacy-map.geojson> <ne_110m_land.geojson> corpus/fellowship/community-map.json` using the original map feed and the Natural Earth v5.1.2 land data. Run `node check-fellowship-home.cjs` for the focused checks. [Natural Earth source and terms](https://www.naturalearthdata.com/about/terms-of-use/)

## Local Fellowship invitation pilot

Set `FIRESTORE_EMULATOR_JAR` to the local Firestore emulator JAR and `JAVA_BIN` to the Java executable if needed. Run `node tests/fellowship-pilot/server.cjs` and open the URL printed in the terminal. The server listens on this computer only. `FELLOWSHIP_PILOT_PORT` overrides its default port of 8769.

Choose **Miriam Ellis**, open **Invite a member**, and create a link. Copy the link to a separate browser tab, choose **Outside Tester**, and accept. The new member can read the discussion and post a reply that appears in Miriam’s tab. The link is valid for one acceptance within 12 hours. The pilot uses simulated sign-in and discards group membership changes, messages, and invitations at restart. The pilot rules must be reviewed and tested with real identities before any hosted rollout.

With the emulator and Playwright configured, run `node tests/fellowship-pilot/check.cjs` for rules checks and `node tests/fellowship-pilot/browser.cjs` for the phone-sized and desktop flows.

### Operational Fellowship-to-Scripture pilot

The household extension adds a separate shared room and six owner-approved private pairings, using the same message/Scripture reader. The owner created the four-account household records, confirmed the real desktop message/Scripture-return journey, ran the household rules suite successfully in Cloud Shell and published the approved household rules. [Household setup, permission scope and activation record](HOUSEHOLD-PILOT.md).

The isolated Firebase pilot includes group-visible names, Scripture sharing, page-memory drafts and explicit pending/saved/error states. Its global communication launcher opens one movable surface: a conversation list and an active chat are views of that same surface. Header dragging, minimize, expand and direct close preserve the appropriate session state; Close clears the sharing destination and reopens to the list. Public Scripture can be prepared in the active draft before deliberate sending. Fellowship retains discovery rather than duplicating messaging selectors. Use `Start-Fellowship-Pilot.cmd` for the local preview. [Interaction experiment and focused validation](MODELESS-CONVERSATION.md). Dorothy/Lisa's Google provider linkage and physical iPhone Safari remain unverified. [Earlier implementation and validation boundaries](FELLOWSHIP-PILOT.md).

## Reference Library

The Sources Library in Learning Hub now opens the supplied reference collection through shared readers: Strong's Hebrew and Greek plus the combined word index, four dictionaries, eight commentaries, nine Bible editions, three topical works, cross-references, and Daily Light. Browse or search entries, look up Strong's numbers and definitions, read passages, follow Scripture links, and return through the existing resource panels. KJV Word study uses the actual supplied phrase tags.

Open **?workspace=learning&card=reference-library**. Content loads by entry, chapter, or requested search shard. The seven unavailable groups remain unavailable; missing text is never silently replaced. [Integration report and source-specific blockers](REFERENCE-LIBRARY.md) · [Original-resource directory](corpus/reference/README.md) · [Conversion ledger](REFERENCE-INTEGRATION-LEDGER.json).

The merge retains the existing validation record: 16 suites passed; three final runs were incomplete because Windows/Node exhausted memory, and further tests were stopped at the user's request. Physical iPhone Safari review and edition-publication permission follow-up remain necessary.
