# Online group invitations

25 November 2026. Family-first implementation using the existing Communicator, Google sign-in, group memberships, display-name profiles and shared study-thread messages. No live data, Authentication configuration, security rules, Hosting channel or main branch has been changed.

## Member journey

Open Conversations, return to its list, and expand **Invite to Family**. Where more than one authorized open group is available, select the group. Enter the recipient’s exact sign-in email and create the invitation. Only after Firestore acknowledges both invitation records does the app offer Copy/Share and Revoke. The iPhone share sheet is an intentional user action; this feature does not automatically send email through HomeGroups. Existing map-to-email invitation functionality remains separate and unchanged.

The recipient opens the private link, signs in with the invited verified account, reviews the group and name, and deliberately chooses Join or Decline. Acceptance atomically records the consumed invitation, ordinary membership, name-only group identity and private joined-group reference. It opens the existing shared conversation in the same Communicator. No developer provisioning is needed for a recipient of a valid invitation. No new Firebase account type or messaging system is introduced.

The same service works for other existing groups following the current membership/profile/studyThreads contract. Family and weekly study remain known entries; other joined groups are recovered from an owner-only directory and checked against the server before being shown. Closed rooms remain readable to existing members, while new invitations/joins require an open room. Joining grants the existing group conversation and its history; it does not grant or create private pair conversations.

The initial shared Family group retains its existing internal ID, household-pilot. It displays as Family. This iteration does not create new groups or add automatic per-account Family provisioning.

## Relevant source

- `group-invitations.js`: token parsing, acknowledged link creation, atomic acceptance, decline/revoke/share UI, authorized group discovery.
- `fellowship-firebase.js`: account-scoped invitation lifecycle, same-document invitation routing, group conversation mounting and cleanup on identity changes.
- `fellowship-firebase-discussion.js`: selects the existing Family profiles or separate shared names for other groups, preserving conversation state and message schema.
- `fellowship-chats.js`: additional authorized saved group entries in the existing list.
- `app.js`: invitation entrance through the same Communicator; Navigator menus close automatically.
- `family-invitations.js`: local compatibility entry for the earlier deferred Family-only prototype; original source is retained in the pre-change checkpoint.

Only an opaque 256-bit random token and group ID go in the URL fragment. Emails do not appear in the URL, shared packet, public profile or group directory. Recipient bindings are separate immutable documents, readable only by the named verified recipient. The inviter enters an email they already know, then the input is cleared after confirmed creation.

## Server prototype and published baseline

The owner supplied the currently published rules on 25 November. They match `tests/fellowship-pilot/household-pilot.rules`. The reviewed candidate is `tests/fellowship-pilot/group-invitations.rules`. The existing message validator, participant checks, private-chat rules and shared-message rules are preserved. New membership creation requires a valid unexpired one-use invitation, verified matching email, a still-authorized inviter, an open target room, an atomic accepted transition and a valid name-only profile. Existing memberships and roles are not rewritten.

New paths:

- `groups/{group}/groupInvites/{token}`: creator, target thread/title, server creation time, expiry and constrained status transition.
- `groups/{group}/groupInviteRecipients/{token}`: immutable private email binding; no list access.
- `groups/{group}/memberNames/{uid}`: a new name-only collection for groups other than the existing Family group. Their legacy `profiles` permissions and data remain untouched.
- `fellowshipMembers/{uid}/groups/{group}`: private navigation reference only. It never grants membership; messages independently check the real group member document. Stale references after removal cannot authorize reads or sends.

Any current member can invite into their own group, as requested. A signed-in nonmember cannot issue invitations or enroll themselves without the matched acceptance. No privileged roles, group creation, participant mutation or message editing/deletion are enabled. Directory queries are owner-only and capped at 50; existing message/profile/private-chat query limits stay enforced. Family reuses its current displayName-only profiles. Other groups use separate memberNames records, not their potentially private legacy profiles. No private legacy fields are migrated, read or overwritten. The permission tests seed a legacy profile containing an email and verify that another member still cannot read it.

Expiry denies use; it does not claim automatic deletion of recipient data. Retention cleanup and invitation rate controls need a later operational policy before a broad public rollout. No TTL, billing, backend email service or infrastructure setting was created.

## Verification and release

Real Firestore emulator checks use demo-homegroups-fellowship-pilot, synthetic identities and no credentials or production endpoints. An initial isolated rules run passed: https://github.com/emartinie/NextPhase/actions/runs/45569979856 . Final source verification and expanded transaction pre-read checks are recorded with the review commit. The first harness run failed because its rules path was resolved relative to the config directory; that configuration was corrected, and unauthorized-operation assertions prevent a missing-rules permissive emulator from passing.

Browser contract tests use the actual application with synthetic Auth/store adapters. They are separate from permission testing and cannot prove live Firebase or physical iPhone behavior. They cover acknowledged creation, copy/native share, no email in links, wrong account, deliberate joining, persisted shared messages and names, a second distinct group, own directory recovery in an independent browser context, group isolation, separate drafts, short-height form scrolling, member-issued/revoked invitations, and sign-out with a request in flight. Following a second invitation in an already open app is covered; the fix handles hash-only navigation without reloading the workspace.

Physical iPhone Safari/Home Screen sign-in, keyboard and native sharing still need hands-on review after activation. Current online Google sign-in, message persistence, permissions and Scripture reader are reused; this pass does not claim a new live-family exchange was performed.

The online review branch is based on main 7270f35f and excludes the separate offline experiment. Local offline source and its tested distribution remain intact. No merge or deployment has occurred. Activation requires owner approval of the rule addition and the client release; an iPhone Hosting preview alone cannot enable membership writes because it uses the same Firestore project.
