# HomeGroups production cutover — readiness record

Assessment and preparation: 23 November 2026. Target: replace the original homegroups.org experience with NextPhase, as confirmed by Eddie. This record does not claim a deployment or completed feature parity.

## Completed release checkpoint

PR #10 merged as `79f656b24530a3b15b18fd0a6ab6f6ccd6af63ba`, preserving reviewed checkpoint `cbd175c7d1327f59eeab69bde01509ac06f25453`. Eddie confirmed that keyboard and attachment behavior passed on both ordinary Safari and the installed Home Screen app. This supersedes that PR's earlier pending physical-keyboard blocker; device acceptance is owner-reported. Existing focused synthetic messaging, viewport, draft, reader-return, permission and audio checks passed before that acceptance.

The unrelated draft PR #2 (`prototype/nextphase-v2`) is an older independent experiment, not an unmerged release component. It must not be merged simply to consolidate branches.

## Prepared changes — separate review branch

- `site-runtime.js` and `app.js`: real Firebase communication is selected automatically on HTTPS homegroups.org/www and the existing HomeGroups Fellowship Firebase Hosting domains, as well as the existing iphone-pilot preview. The reviewed host list is exact; arbitrary and lookalike hosts cannot opt in by adding a query parameter. Hosted builds use Firebase Hosting's `/__/firebase/init.json`; localhost retains its existing config endpoint and review modes. This prepares deployment on **Firebase Hosting**, not GitHub Pages, which lacks that reserved endpoint. No service configuration, account or membership is changed by this code.
- `fellowship-home.js`: removed the redundant Original member map escape. The existing world/nearby/member discovery remains in NextPhase.
- `study-tools.js`: covenant source references now open the existing Ancient Library directly, carrying book, work, volume, chapter and verse rather than opening HGBibleApp in another tab.
- `preparedness-library.js` and `preparedness-resources.js`: catalog/document navigation now stays in the NextPhase Be Ready catalog. Original Drive sources and pinned provenance remain intentional source links.

These preparations do not by themselves make the full replacement ready.

## Verified cutover blockers

| Area | Evidence | Required before domain replacement |
| --- | --- | --- |
| Current domain host | DNS A responses: 185.199.108.153, .109.153, .110.153, .111.153; www CNAME emartinie.github.io. HGBibleApp/CNAME contains homegroups.org. Current source checkpoint: `e34bba17f78cb093cb15b63260b00f553d50b37e`. | Verify custom-domain ownership/routing in the account consoles. Prepare Firebase Hosting/HTTPS before switching DNS or removing the old Pages mapping. Preserve the original source and a rollback route. No DNS or repository-admin settings have been changed. |
| Deployment access | No Firebase CLI or authenticated local CLI session was found. No DNS/account-management connector is available. | Owner completes local Firebase sign-in or uses the existing authenticated Cloud Shell; domain-console access is also required. Never pass credentials in chat. |
| Production communication activation | Before preparation, app.js limited real communication to local review and iphone-pilot hosts. A normal production host therefore used the demo path. | Test the prepared runtime on the actual production Hosting origin, verify the reserved config response belongs to homegroups-fellowship and confirm Google authorized domains for homegroups.org/www. Do not weaken membership checks or rules. A hostname unit test does not verify live Google sign-in. |
| Public participation | Household/private messaging uses provisioned membership and participant records. Authentication alone does not grant access. app.js learning discussions and preparedness discussions still include browser-local/demo behavior; README documents those limits. | Decide and implement the public launch participation scope. Preserve real household access and privacy; do not auto-enroll legacy map members or present simulated participation as delivered community discussion. Existing rules remain intact. |
| Embedded legacy content links | Parsed actual anchors in supplied commentary/articles, rather than counting every historical URL string. There are 30 old-domain anchor occurrences across 13 distinct URLs, including an image link. Paths include /the-book-of-revelation/, /equipping/the-story/, /impacting/sustainable-living, /vision/, /where-did-the-sabbath-go/, /the-remnant/, /torah-commandments/, /the-big-picture, /equipping/bible-studies/, /the-law-is-dead/ and an old church image. Some occur with different slash/case forms. | Map exact existing local equivalents and preserve their reading context. Locate missing pages/media before changing the domain. Removing a link or pointing it at a vaguely related card is not capability migration. Preserve original source files. |
| Legacy PWA clients | HGBibleApp/service-worker.js uses hg-bible-shell-v8-fellowship-live: network-first navigation plus cached shell scripts, manifest and offline page. NextPhase's current entry does not replace that worker/manifest. | Plan same-origin worker/manifest/cache transition and installed-app start URLs; test an existing installed HomeGroups app through the cutover, not only a newly installed iphone-pilot icon. Do not erase personal notes, learning progress or private drafts as a cache-cleanup shortcut. |
| Old bookmarks and paths | Preview packaging redirects root to /NextPhase/?pilot=firebase. Legacy cards, WordPress-style article paths, original assets and service-worker URLs have different addresses. | Provide reviewed root/deep-link/asset compatibility and validate reader/share links plus auth redirects at homegroups.org. Do not use a blanket redirect to conceal missing content. |
| Publication scope | REFERENCE-LIBRARY.md already records unverified full-edition redistribution permissions, especially NKJV, Modern King James, BBE and Teacher's Commentary. Runtime packaging currently includes derived reference files. | Confirm the actual permission status or create a release allowlist that excludes unapproved files and their catalog/search entries. Merely hiding a menu item does not exclude downloadable content. This is an unresolved source-specific record, not a new legal determination. |
| Email invitations | README and fellowship-email.cjs describe server-only delivery, durable storage/rate limits and post-acceptance messaging as incomplete; static Hosting has no configured email backend. | Do not advertise successful email delivery. Complete the approved backend or define the first production release without that capability. No credentials/billing/infrastructure changes have been made. |

GitHub source links are historical provenance, not navigation into the old application. Intentional Sefaria, source-edition, public-media and Drive links are separate from legacy UI dependencies. The original application and uploaded records remain preserved; no old repository files have been deleted or overwritten.

## Preparation validation

`tests/fellowship-pilot/site-runtime-check.cjs` passed the production/preview host policy, config URL and untrusted-host cases. `cutover-navigation-browser.cjs` passed the real phone-sized Ancient Library, Be Ready and member-discovery routes. The complete focused `communication-browser.cjs` regression passed after the runtime extraction, including synthetic authorized messaging, account isolation, draft/position continuity, Scripture return, attachments, keyboard geometry and continued audio. Changed application files passed syntax checks. Logs remain under ignored `.pilot-tmp/cutover-*.log` on F:. No new broad regression campaign, live account changes, DNS changes or production deployment was performed.

## Cutover sequence

1. Retain the merged Communicator checkpoint and review this preparation branch. Finish exact internal routing and identify remaining capability/content blockers; do not silently remove them.
2. Settle public participation and publication scope. Produce a static release package with an explicit file manifest, source hashes and no private raw map/config/account files. Keep review artifacts on F:.
3. Authenticate the deployment account. Verify project/site, Hosting root/deep links, Google authorized domains and domain ownership. Prepare the PWA transition and archive the prior release/configuration needed for rollback.
4. Exercise the resulting release candidate through the existing iphone-pilot channel, including authenticated communication, permissions, local resources, legacy bookmarks and an upgrade from the existing installed application. Use focused checks plus a release smoke pass; do not restart the entire migration inventory.
5. Publish the verified release to the existing HomeGroups Fellowship Hosting site, validate it before the custom-domain switch, then update homegroups.org/www routing using the provider's actual displayed DNS values. Preserve mail-related DNS records. Verify HTTPS, Google sign-in, membership denial, media, shared URLs and installed clients at the real domain. Retain the old source/release for rollback; remove public legacy navigation only as its replacement is verified.

Full replacement is **not yet ready**. The approved Communicator merge is complete; the domain/data/configuration cutover remains pending the blockers above.
