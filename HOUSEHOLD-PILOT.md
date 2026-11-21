# Household conversations — local implementation and activation

The four owner-selected household accounts are the intended pilot audience. Actual account IDs and their preferred names are held in ignored `.pilot-tmp/household-participants.json`, never committed or exposed through the preview server. No Authentication accounts, live records, rules, releases or deployments were changed by this iteration.

## Experience

- Fellowship exposes **Chat with…**, **Household conversation**, and **Weekly study conversation** through the existing controls and inline discussion surface. Online presence is not required or recorded.
- The separate household community is `groups/household-pilot`. The shared room is `studyThreads/household` within that community. It has a stable identity and does not reset with the weekly curriculum or annual archive cycle.
- Six owner-provisioned private pairings cover every pair of the four accounts. Each account sees its three saved private conversations. These are preapproved household test contacts, not a general invitation or contact-consent policy for future members.
- Private metadata and messages live under `groups/household-pilot/privateChats/{id}`. They are deliberately separate from group-readable study threads.
- Picking a person reopens that persisted conversation. Sign-out clears the previous account's drafts and private screen content; signing back in retrieves the saved conversation list and messages from Firestore.
- Both room types use `fellowship-firebase-discussion.js`, the existing message schema and shared Scripture reader. Reader excursions, inline room changes, week navigation, drafts, errors and pending-send handling reuse the existing architecture.
- The old weekly community, MainStage, other workspaces, map masking, themes and content remain intact.

## Safe owner setup

`tests/fellowship-pilot/provision-household.py` is a standard-library Python utility for the project owner's Cloud Shell. It targets only `homegroups-fellowship` and defaults to a dry run.

The apply operation:

1. Obtains the owner's existing gcloud OAuth credential in memory without displaying or saving it.
2. Looks up only the four supplied Authentication UIDs and refuses to write if one is missing or disabled. It reports Google-provider linkage that still needs checking; it never changes Authentication.
3. Checks for unexpected household members or private conversations, then reads the proposed document paths and preserves existing memberships, roles, names, rooms, private pairings and messages. An unexpected audience, conflicting existing pairing or closed household room stops the operation before any writes.
4. Atomically creates only missing documents with `exists:false` preconditions: one community, four memberships, four name profiles, one shared room, and six private pairings (at most 16 documents).
5. Never publishes rules, sends email, changes billing, deletes records or grants application leadership based on a display name.

Owner-approved household names are also saved once as `memberLabels` in the protected household room metadata. This documented transitional snapshot makes group authors recognizable under the already published group rules. It contains only approved names keyed by account ID and is visible only to authorized members of that household community. When profile access becomes available, the live profile name takes precedence. Messages continue to store only author UID, body and timestamp.

The owner can activate the shared household room under the current published rules. Enabling private conversations requires the separately reviewed participant-only rule addition.

### Owner setup authentication finding

The owner's Cloud Shell diagnostic confirmed that Authentication lookup returned HTTP 403 without an explicit quota project and HTTP 200 with `x-goog-user-project: homegroups-fellowship`. Firestore returned HTTP 404 for the not-yet-created household document with either header setting. The setup utility now includes that project header on its requests; a mocked transport check verifies it. This fixes the confirmed request configuration issue without changing IAM roles, APIs, Authentication accounts or Firestore rules. Household creation still requires a successful rerun; the diagnostic itself made no writes.

## Local checks and boundaries

```powershell
node tests/fellowship-pilot/session-check.cjs
node tests/fellowship-pilot/firebase-browser.cjs
node tests/fellowship-pilot/firebase-browser.cjs --published-baseline
node check-fellowship-home.cjs
python tests/fellowship-pilot/household-plan-check.py
node tests/fellowship-pilot/household-check.cjs
```

The browser suite uses synthetic Auth/Firestore adapters, not real family accounts. It covers six distinct pairings, the four-person group room, account switching/relogin, separated group/private histories, private drafts, Scripture return and absence of other participants' messages. The setup unit check covers stable pair IDs, duplicate/invalid account rejection, missing-only atomic writes and preservation of existing roles/names.

The actual rules suite is blocked locally by the missing Java/emulator JAR. A source review and browser adapters do not substitute for execution of those rule assertions. The existing Git index lock/active Git work also remains untouched; implementation changes are not merged or deployed.

Recorded local results: the full browser contract **passed**, including household entry without weekly-community access; the published-baseline browser contract **passed**, including readable owner-approved household names without profile grants; the existing Fellowship Home regression, draft checks, setup-plan checks and JavaScript syntax/whitespace checks **passed**. Setup safeguards also reject an unexpected member or a profile containing contact fields before writing. The actual household rule test was attempted and stopped at the missing-emulator preflight; its assertions have **not** passed. The owner setup ZIP was verified against its source files. Its private account file and ZIP return HTTP 404 from the preview server, while the household review page returns HTTP 200.

## Candidate permissions

`tests/fellowship-pilot/household-pilot.rules` starts with the owner's supplied published rules and adds names and participant-scoped private chats **only under `groups/household-pilot`**. It does not broaden profile access in the weekly community or contain the older invitation-enrollment/self-membership grants from the extended legacy test fixture.

- Membership and private-conversation metadata remain owner-provisioned and immutable to clients.
- Profiles contain only a nonblank display name of up to 80 characters. Enrolled members may read their household's names and write only their own profile.
- Private list queries must contain the authenticated UID in `participantIds`, with a limit of 20; each private history query has a limit of 50.
- Only the listed participants who still belong to the household may read private histories. Both participants must remain enrolled for new messages.
- Message authorship, size limits, server timestamps and immutability follow the existing validator.
- Other household members, outsiders and unauthenticated callers cannot read a pair's private messages. Clients cannot add participants or make themselves members.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for the household pilot by enforcing group membership, private participant checks, immutable conversation metadata and UID-bound messages. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

### Emulator check in the owner's existing Cloud Shell

The prepared setup ZIP also includes the candidate, the emulator helper and the household rule test. With Java and the existing Firebase CLI available, run from the extracted ZIP root:

```bash
firebase emulators:exec --project demo-homegroups-fellowship-pilot --config household-emulator.json --only firestore "node tests/fellowship-pilot/household-check.cjs"
```

The helper accepts only a loopback emulator endpoint and always uses a hard-coded `demo-` project. This command does not deploy or test against real family accounts. If the runtime is unavailable, stop and report the error instead of publishing unvalidated rules.

### Owner-reported Cloud Shell result — 2026-11-20

The owner ran the packaged candidate with `firebase emulators:exec` against `demo-homegroups-fellowship-pilot`. Firestore started, `household-check.cjs` reported its six participant-only pairs, four-person shared room, scoped queries, immutable metadata/messages and revocation checks passed, and the script exited with code 0. The CLI then shut down the emulators normally. IPv6 availability warnings did not prevent execution. This supersedes the local missing-runtime blocker for this particular household suite; it does not establish results for other unrun rule suites or live private-chat access. No rules were published by the test.

The owner subsequently approved publishing this tested household candidate and requested no additional testing. The scoped publication command, from the existing extracted Cloud Shell directory, is `firebase deploy --only firestore:rules --config household-emulator.json --project homegroups-fellowship`. This targets Firestore rules alone, not Hosting, indexes, Authentication or the original HomeGroups project. Publication is authorized but remains unconfirmed until successful CLI output is received; local tools do not have an authenticated Firebase management connection.

## Remaining activation steps

1. **Owner-confirmed complete:** Cloud Shell reported creation of all 16 missing household records atomically after the quota-project header fix. No rules or Authentication accounts were changed by that operation.
2. **Owner-confirmed desktop journey:** Eddie and Admin exchanged persisted household messages with distinct names and saved confirmations. The owner then confirmed the Scripture excursion/return checks, including draft and position preservation; a shared Ezekiel 37 reference is visible in the supplied screenshot. This is hands-on owner verification, not an automated live-account test or an iPhone Safari result. Dorothy and Lisa's Google sign-in linkage remains unverified and was flagged by setup. The explicit household link is `http://localhost:8770/NextPhase/?pilot=firebase&face=fellowship&week=7&room=household`.
3. **Household rules suite passed in the owner's Cloud Shell:** review the tested candidate and approve private-rule publication separately. The agent has not published it; the current live permissions remain unchanged.
4. After approved publication, **Chat with…** opens each account's three persisted private pairings. Verify real two-device message exchange and iPhone Safari separately; physical Safari and real account provider linkage have not been verified here.

The initial pilot has no client-created arbitrary private rooms, new-contact invitation flow, read receipts, online presence or automatic email. Those are outside this four-person, owner-provisioned iteration. The shared message query retains the existing newest-50 window; full history pagination remains deferred.

## Focused conversation presentation — local iteration, 2026-11-21

The owner supplied successful `Deploy complete!` output for the approved rules-only publication. Subsequent screenshots showed household names, private-chat entries and a saved private message. This records owner-provided publication evidence; this UI iteration did not change or publish any rules.

Following the owner's screenshots of the long inline page, the Firebase path now uses a compact conversation list on Fellowship Home and opens selected weekly, household or private conversations in the existing full-size excursion panel. The map is retained below the list. The conversation has a compact Back/name/details header, its own message scroll surface and a bottom composer; account controls, map, people picker and workspace navigation stay outside the excursion. Scripture sharing is behind the composer plus control, while member details live under the header menu. Successful saves use a small labeled check; pending states and errors remain explicit.

The existing Firebase listeners, member checks, message schema, UID-scoped page-memory drafts and shared Scripture reader are reused. The existing history/frame stack keeps a conversation mounted during nested Scripture excursions, saves its own message position, resumes it on return and disposes listeners when the conversation is closed. Sign-out/account changes clear conversation frames. Visual-viewport sizing supports the mobile keyboard; physical iPhone Safari behavior remains unverified for this presentation change.

Validation was limited to source syntax and viewing the updated local page: the existing signed-in browser displayed the compact home list, and selecting Admin opened the focused conversation with the existing saved message and bottom composer. No messages were sent, Firebase configuration changed, test suites run, application merged or application deployed during this iteration. The local screenshot is under ignored `.pilot-tmp/focused-conversation.jpg` and contains private pilot UI, so it must not be added to public source/assets. Earlier automated results above predate this layout change and are not claimed as rerun results.
