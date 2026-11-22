# Operational Fellowship pilot — implementation and review

Status: local implementation on `feature/operational-fellowship-pilot`, based on `a91aaafd`. **Not approved for release or declared ready for real participation.** No deployment, live data writes, account enrollment, or rules publication was performed.

## Existing foundation preserved

- `fellowship-firebase.js`: Google sign-in, session persistence, explicit `homegroups-fellowship` project check, and auth observer teardown.
- `fellowship-firebase-discussion.js`: persisted, immutable replies in an explicitly provisioned weekly group thread; a bounded live query; backend-confirmed successful writes.
- `tests/fellowship-pilot/firestore.rules`: membership required for messages, UID-bound authorship, server timestamps, 1–1,600-character bodies, immutable messages, read-only archives, and recipient-bound atomic invitations.
- `app.js`: the existing Study/Fellowship faces, shared reader, nested resource panels, browser-history return, and saved workspace scroll state. Reader callbacks and the Fellowship surface are passed into the Firebase mount. Conversations/Communities now reuse the existing panels and return to the weekly conversation inside NextPhase.
- The regular map, its masking, invitations, Themes, other workspaces, and clearly labeled local demos remain separate and unchanged.

These are source-confirmed features. Previous successful real-device replies were reported by the user; they were not independently repeated with live accounts in this iteration.

## Completed locally

| Capability | Implementation | Evidence / boundary |
| --- | --- | --- |
| Distinct community names | First-use confirmation of a display name, prefilled from Auth when available; a group-scoped name-only profile; live roster and author names | Four synthetic identities exercised in `tests/fellowship-pilot/firebase-browser.cjs`; real four-account sign-in still requires hands-on verification |
| Access independent of sign-in | A server-confirmed read of the protected study thread gates messages and optional profiles; the published rules check membership internally; access failures clear the private feed | Browser checks inject denial/revocation; actual rule enforcement requires the emulator checks below |
| Weekly conversations | Removed client-only Week 7 restriction; opens only an already-provisioned year/week thread | Weeks 7 and 8 exercised; client cannot create threads or enroll members |
| Share Scripture | Compact Share Scripture disclosure, source-validated reference, button opening the existing reader | Shared passage, chapter exploration and nested passage tools exercised |
| Compatible stored messages | Reference encoded in the existing body as `[Scripture: John 1:1–5]`; original three-field message schema retained | Existing plain messages remain readable; no message-data conversion or author-name duplication |
| Context preservation | Account/community/year/week-scoped memory drafts; stable message elements and scroll anchoring; shared panel history | Exact scroll return checked within 3 CSS pixels, unfinished reply retained, weeks isolated |
| Sending and failure | Pending confirmation disables duplicate submission; confirmed save explicitly labeled; failed send keeps text | Delayed send survives away/back navigation without duplicate submission or erasing a newer draft; injected error/offline states exercised |
| Account isolation | Draft memory cleared on observed sign-out or account change; cached feeds never introduced before server-confirmed membership | Account switching and denied-account UI exercised |
| Local start | `Start-Fellowship-Pilot.cmd` uses the existing Firebase preview server and configuration, keeping disposable output under `.pilot-tmp` on F: | Does not deploy, create accounts or modify infrastructure |
| Internal conversation navigation | Replaced legacy-app conversation/community redirects with compact NextPhase panels for the existing weekly community | Local navigation preserves the draft; private messaging remains explicitly unconnected |
| Profile compatibility | Missing or denied profile reads no longer block an independently authorized conversation; unavailable names are labeled without guessing identities | Browser cases cover denied own-profile reads and denied roster queries; membership and message access remain mandatory |

## Data and permission contract

The existing fixed pilot community is `groups/pilot-group` (Wednesday HomeGroup).

| Path | Read | Write |
| --- | --- | --- |
| `groups/{groupId}/members/{uid}` | Published baseline denies client reads; the app does not read this path. Local extended test rules also model a self-only get. | Published baseline denies client writes. Extended invitation tests model recipient-bound redemption; these are not published grants. |
| `groups/{groupId}/profiles/{uid}` | Enrolled members of that group; collection queries limited to 50 | Enrolled owner only; exactly `displayName`, nonblank string of at most 80 characters; no delete permission |
| `groups/{groupId}/studyThreads/{year}-week-{NN}` | Enrolled members | Client cannot create, open or alter threads |
| `.../messages/{messageId}` | Enrolled members; query limited to 50 | Existing immutable UID-bound body and server timestamp, only when the thread is open |

Relative to the existing extended test rules, the only rule extension is the profile validator and group-scoped profile block. No existing test grant was relaxed. No email, phone, precise location or role is copied into profiles. Display names are member-chosen labels, not verified legal identities or guaranteed unique names. Authorization always uses the authenticated UID and the server's group-membership check.

The owner supplied the current published rules on 2026-11-19. Their access predicates are preserved in `tests/fellowship-pilot/published-baseline.rules`: `isMember(groupId)` runs inside the rules for thread/message access, while membership records and profiles are not directly readable by clients. The client now uses that protected thread listener to confirm access rather than adding a new membership-document read. A cached thread snapshot alone cannot unlock messages. Profile denial is an optional-feature limitation, never evidence of missing enrollment or a reason to weaken permissions.

**The current rules do not need to change for authorized replies or Scripture sharing.** Group-visible names remain unavailable under this baseline. The local extended rules also contain invitation/self-membership capabilities absent from the published baseline; do not publish that whole file to obtain names. Any future profile permission proposal must be an independently reviewed, minimal addition to the actual published rules.

**The checked-in extended test rules are not the published rules.** The published baseline was supplied by the owner, not fetched directly by this agent. Reconfirm it before any later publication; preserve existing protected collections and grants. The database edition has not been independently queried; no provisioning or edition change is proposed.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for enrolled community members by restricting profile writes to the owner, limiting profile fields, and preserving membership-gated messaging. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

## Validation

Run from the repository root, using existing Playwright/Chrome installations. Set `TEMP` and `TMP` to an F: scratch directory before browser checks. `.pilot-tmp/` is ignored and disposable.

```powershell
node tests/fellowship-pilot/session-check.cjs
node tests/fellowship-pilot/firebase-browser.cjs
node tests/fellowship-pilot/firebase-browser.cjs --published-baseline
node check-fellowship-home.cjs
```

- Session checks exercise scope isolation, navigation reuse, message compatibility, reference encoding and sign-out cleanup.
- The phone-sized/desktop browser suite runs the actual app and reader with **test-only synthetic Auth/Firestore adapters**. It never signs in real accounts, contacts Firebase, or proves Firestore rules enforcement. Its published-baseline mode specifically denies direct membership/profile reads while checking authorized communication, reader return and nonmember rejection.
- The existing Fellowship Home regression covers map privacy, map interaction, conversation rendering and invitation handoff. Its Firebase fixture was extended to describe the new membership/profile reads; its assertions were retained.
- JavaScript syntax and scoped whitespace checks are also run.

Recorded results for this iteration: session checks **passed**; phone-sized/desktop Firebase browser contract checks **passed**; existing Fellowship Home regression **passed** after updating its obsolete Firebase fixture; syntax and scoped whitespace checks **passed**. The browser contract was rerun after pending-send navigation, validation/error cases and recovery changes. The emulator preflight **failed because its JAR was unavailable**, before any security assertions executed. No broad regression campaign was run.

After receiving the owner's published rules, both browser modes passed again: the normal profile-capable contract and the private-membership/no-profile published-baseline contract. The existing Fellowship Home regression also passed after that access correction. The dedicated published-baseline emulator suite was attempted and stopped at the same missing-JAR preflight. A revocation assertion accepts either protected listener reporting denial first, while still requiring immediate feed clearance by the error handler; it does not assume listener callback order.

The existing local preview was started and checked at `http://localhost:8770/NextPhase/?pilot=firebase&face=fellowship&week=7`. Both its project-checked configuration endpoint and updated discussion module returned HTTP 200. Starting this server did not sign in an account or write Firebase data. Test browser profiles were cleaned up; only the running preview's small logs remain under ignored `.pilot-tmp/`.

Git recording is currently blocked by an existing `.git/index.lock` and active Git processes. The lock was left untouched after process inspection showed active Git work. Source changes remain uncommitted on the isolated branch at base `a91aaafd`; no push or PR was created. Finish the normal commit after the active Git operations have ended, without force-pushing or disturbing their index.

### Required emulator validation — blocked on this machine

```powershell
$env:JAVA_BIN = '<path to an installed compatible Java executable>'
$env:FIRESTORE_EMULATOR_JAR = '<path to the official Firestore emulator JAR>'
node tests/fellowship-pilot/check.cjs
node tests/fellowship-pilot/published-baseline-check.cjs
node tests/fellowship-pilot/browser.cjs
```

The local rule suite now includes four synthetic profiles, cross-account writes, schema/type/length rejection on create/update, profile query limits, unauthenticated/nonmember reads, cross-community reads/writes and revocation, in addition to the existing message and invitation tests. It is designed exclusively for `demo-homegroups-fellowship-pilot` on loopback.

At implementation time no Java executable or Firestore emulator JAR was available. The attempted rules run stopped at the missing-JAR preflight; **none of its rule assertions ran**. Outbound Node downloads were denied (`EACCES`), so no replacement runtime was installed. No rules were sent to Firebase as a substitute for local validation. See [Firebase emulator setup](https://firebase.google.com/docs/emulator-suite/install_and_configure) and [Firestore emulator connection](https://firebase.google.com/docs/emulator-suite/connect_firestore).

## Remaining limitations and release blockers

1. **Security release blocker:** execute the actual emulator rules suite and resolve every failure; the browser contract doubles do not replace it. The existing invitation browser suite also needs its emulator restored.
2. **Live configuration review:** current rules were supplied by the owner and the client was made compatible with them. Reconfirm live configuration before release; approve any separate profile changes only when ready to enable shared names. No profile rules have been deployed.
3. **Four real accounts:** the four Auth accounts are user-reported, not independently enumerated. Each must sign in using the already enabled Google provider and must have explicit group membership. An account created with a different provider is not assumed to be linked to Google. Do not share passwords or auth tokens in chat.
4. **Enrollment and thread provisioning:** an owner must verify each intended UID under `groups/pilot-group/members` and the intended year's study thread. No membership, role or discussion was created in live Firestore by this iteration. An unopened week remains unopened; the client does not silently create it.
5. **Real delivery verification:** repeat the two-device exchange using the actual SDK and data after the preceding steps. “Saved to community” means server-committed; it is not a per-recipient read receipt or a guarantee of delivery to every device.
6. **Physical Safari:** mobile viewport checks use Chromium, not an actual iPhone or WebKit. Google popup handling, the on-screen keyboard, focus return, background/resume and network interruption need a physical Safari pass.
7. **iPhone URL:** the local preview binds to loopback. An iPhone cannot use the PC's localhost URL. A later approved update of the existing HTTPS review channel is needed; no public site or preview channel was deployed here.
8. **Draft lifetime:** drafts survive in-app excursions and week/workspace navigation in the same page, not reload, browser closure or sign-out. They are deliberately not stored on disk. Reloading while a write is unconfirmed requires checking the thread before retrying.
9. **Bounded history:** only the newest 50 messages are queried; full history/pagination is deferred. Very active threads can evict older messages from this window. This pilot does not claim indefinite exact-position preservation across such history eviction.
10. **Scope:** the real path is `?pilot=firebase&face=fellowship`. The ordinary nonpilot path and private-message/game demonstrations remain local demos. This iteration does not make all of Fellowship operational or introduce real direct messaging, autonomous invitations, read receipts, notifications or attachments other than Scripture references.

## Exact next step for the real four-person pilot

Restore the local emulator runtime and pass the focused checks against both rule fixtures. Verify the four intended group enrollments with the owner. Existing enrolled members can review replies and Scripture sharing locally under the current published rules without any rule change. Shared names require a separately approved minimal profile-rule addition. Membership/thread provisioning and an HTTPS review release also require approval where needed. Each person then signs in independently and performs the acceptance journey: recognize the community, exchange a reply, share Scripture, read/explore it on the other device, return with a draft intact, and distinguish saves, pending states and failures. Keep the two additional family accounts enrolled only where intended.

No merge, deployment, live enrollment or rules change is implied by this document.

## Subsequent household pilot verification — 2026-11-20

The historical implementation results above predate the household setup. The owner subsequently created the 16 household records using the missing-only provisioning utility (no Authentication or rule changes), verified real Eddie/Admin household message exchange and the Scripture/draft/position return journey on desktop, and supplied successful Cloud Shell output from the actual household emulator suite (exit 0). See `HOUSEHOLD-PILOT.md` for the scoped permissions candidate and detailed results. These results do not imply that the separate weekly/invitation rule suites ran, Dorothy/Lisa's Google provider linkage works, physical Safari has been checked, or private-chat rules have been published. Private access awaits explicit publication approval; no merge or application deployment occurred.
