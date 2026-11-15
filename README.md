# NextPhase · HomeGroups

NextPhase opens to the current weekly Bible study. It is a development and review environment with simulated Fellowship discussions, private conversations, games, and preparedness exercises. Sample activity and drafts are stored in the current browser. The app has no accounts or connection to HomeGroups production data.

- **Study** has the weekly schedule, daily readings, Passage reader, and personal notes.
- **Study Tools** opens Covenants & Commandments, New Testament Notes, Hebrew Library, Teachers & Scholars, Sources and Investigations, Learning, Preparedness, and Calendar.
- **Study discussion** flips to the current week's Fellowship. From there you can try game invitations and preparedness drills.

## Local review

Run `node serve-preparedness.cjs` and open [the local preview](http://127.0.0.1:8767/). Node is required for the local server and tests. The app itself is static and loads from the repository root with no build step.

Install Playwright with Chromium to run the seven suites below. Set `NEXTPHASE_PLAYWRIGHT` to an existing Playwright module or `NEXTPHASE_CHROME` to a local Chromium executable. Each suite serves the app under `/NextPhase/` to exercise project-site URLs.

```text
node check.cjs
node check-study-tools.cjs
node check-fellowship-games.cjs
node check-preparedness.cjs
node check-learning.cjs
node check-calendar.cjs
node check-people.cjs
```

The [MainStage notes](MAINSTAGE-REVIEW.md) describe reader and schedule limitations. The [migration notes](LEARNING-MIGRATION.md) record Learning, Calendar, and source curation. The [HomeGroups source license](corpus/LICENSE) is bundled. Third-party source attribution and applicable reuse notices appear with their respective editions.
