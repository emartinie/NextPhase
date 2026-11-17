# NextPhase · HomeGroups

NextPhase opens to the current weekly Bible study. It is a development and review environment with simulated Fellowship discussions, private conversations, games, and preparedness exercises. Sample activity and drafts are stored in the current browser. The app has no accounts or connection to HomeGroups production data.

- **Study** has the weekly schedule, daily readings, Passage reader, and personal notes.
- **Study Tools** opens Covenants & Commandments, New Testament Notes, Hebrew Library, Teachers & Scholars, Sources and Investigations, Learning, Preparedness, and Calendar.
- **Study discussion** flips to the current week's Fellowship. From there you can try game invitations and preparedness drills.
- The **Theme Manager** in the header previews the original Cosmic Glass, Midnight Sapphire, and Ancient Parchment palettes adapted to the NextPhase layout. Save a theme to keep it in the current browser. Leaving an unsaved preview restores the saved appearance. Open the temporary diagnostic palette with `Ctrl+Alt+Shift+D` or by tapping the study title five times within three seconds. [HomeGroups theme diagnostic](https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/js/themeDiagnostic.js)
- **Olam HaBa** (עולם הבא, The World to Come) uses a static gradient atmosphere and shared glass tokens for the app chrome and dialogs. Compact surfaces use blur where available, with solid surfaces as a fallback. Expanded reading panels use solid glass colors. The same glass tokens are available for future floating controls.

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
```

The [MainStage notes](MAINSTAGE-REVIEW.md) describe reader and schedule limitations. The [migration notes](LEARNING-MIGRATION.md) record Learning, Calendar, and source curation. The [HomeGroups source license](corpus/LICENSE) is bundled. Third-party source attribution and applicable reuse notices appear with their respective editions.

## Local Fellowship invitation pilot

Set `FIRESTORE_EMULATOR_JAR` to the local Firestore emulator JAR and `JAVA_BIN` to the Java executable if needed. Run `node tests/fellowship-pilot/server.cjs` and open the URL printed in the terminal. The server listens on this computer only. `FELLOWSHIP_PILOT_PORT` overrides its default port of 8769.

Choose **Miriam Ellis**, open **Invite a member**, and create a link. Copy the link to a separate browser tab, choose **Outside Tester**, and accept. The new member can read the discussion and post a reply that appears in Miriam’s tab. The link is valid for one acceptance within 12 hours. The pilot uses simulated sign-in and discards group membership changes, messages, and invitations at restart. The pilot rules must be reviewed and tested with real identities before any hosted rollout.

With the emulator and Playwright configured, run `node tests/fellowship-pilot/check.cjs` for rules checks and `node tests/fellowship-pilot/browser.cjs` for the phone-sized and desktop flows.
