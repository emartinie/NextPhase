# Reference Library — functional integration

The shared Reference Library now reads the supplied content through the existing Sources Library, resource panels, Theme Manager, Scripture excursions, and Learning Fellowship.

## Working collection

**29 of the 36 resource groups are functional locally.** The original source inventory remains intact. The seven remaining groups have source-specific blockers listed below.

| Resource | Function | Entries |
|---|---|---:|
| American Standard Version (ASV) | bible | 31,101 |
| Bible in Basic English (BBE) | bible | 31,102 |
| Darby's Translation | bible | 31,099 |
| King James Version | bible | 31,102 |
| 1912 Luther German Bible | bible | 31,102 |
| Modern King James Version | bible | 31,102 |
| Montgomery's New Testament | bible | 7,949 |
| New King James Version | bible | 31,102 |
| Twentieth Century New Testament | bible | 7,954 |
| Adam Clarke's Commentary | commentary | 21,151 |
| Albert Barnes' New Testament Commentary | commentary | 7,947 |
| Family Bible Notes | commentary | 16,038 |
| 1599 Geneva Bible Notes | commentary | 14,856 |
| Jamieson-Fausset-Brown Commentary | commentary | 19,754 |
| John Wesley's Notes on the Old and New Testaments | commentary | 18,374 |
| Matthew Henry's Concise Commentary | commentary | 3,572 |
| Teacher's Commentary | commentary | 3,380 |
| BCD cross-reference module (bcdxrefs) | crossrefs | 21,991 |
| Bagster's Daily Light | devotional | 732 |
| American Tract Society Dictionary | dictionary | 2,277 |
| Easton's Bible Dictionary | dictionary | 3,965 |
| Hitchcock's Bible Names | dictionary | 2,623 |
| Smith's Bible Dictionary | dictionary | 4,640 |
| Strong's Greek Dictionary | lexicon | 5,624 |
| Strong's Hebrew Dictionary | lexicon | 8,674 |
| Strong's Word Index | support | 14,298 |
| Everyday Life References | topic | 193 |
| Nave's Topical Bible | topic | 5,322 |
| Thompson Chain Topics | topic | 3,734 |

## Reader behavior

- Strong's Hebrew and Greek support number lookup, supplied transliterations and pronunciations, cross-links, and definition search. Strong's Word Index searches both languages and opens the matching definition.
- Dictionaries, topical references, and Daily Light use one shared entry reader with entry search, full-text search, source cross-links, and Scripture excursions. “For this passage” follows actual citations; it does not infer topical relevance.
- Bible editions and commentaries share passage, book, and chapter navigation. Editions preserve their own wording and actual coverage. Missing text or notes are shown as unavailable, with no silent substitution.
- The KJV Word study control exposes the supplied phrase-to-Strong mappings. All 351,808 phrase markers match their accompanying codes; every code is within the supplied dictionary range. Empty source phrases retain their explicit Strong code. This is source KJV tagging, not an invented interlinear or an alignment assigned to other translations.
- Search text is loaded only when requested. Entry bodies, chapter text, and search shards are fetched separately. Merely opening MainStage does not download the library.
- Citation links use the existing KJV reader. Resource links retain the selected passage. Related resources remain available from the reader's compact Resources control.
- Browser Back restores panel nodes, input state, focus, and exact session scroll positions. Reference discussions also retain their complete parent-panel journey and original workspace, allowing a return through the resource to the earlier reading position.
- Reload retains supported resource, entry, passage, and query URLs. It does not reconstruct an entire transient browser session after the browser has been closed.
- The interface shows the books and their content. Inventory, conversion logs, and technical blockers remain in this document and the integration ledger.

## Remaining source blockers

| Resource | Specific blocker |
|---|---|
| 1910 Louis Segond Version | No source text file supplied; header/index files cannot supply its missing contents. |
| New American Standard Bible 95 Update | Protected/encoded Bible text; no documented decoding or full-edition redistribution permission supplied. |
| New American Standard Bible | Protected/encoded Bible text; no documented decoding or full-edition redistribution permission supplied. |
| New International Version | Protected/encoded Bible text; no documented decoding or full-edition redistribution permission supplied. |
| New Revised Standard Version | Protected/encoded Bible text; no documented decoding or full-edition redistribution permission supplied. |
| Matthew Henry's Commentary on the Whole Bible | No source text file supplied; header/index files cannot supply its missing contents. |
| Morning and Evening Readings | No source text file supplied; header/index files cannot supply its missing contents. |

No missing content was fetched from a replacement edition. No protected Bible text was decrypted.

## Source qualifications retained

- Matthew Henry's Concise Commentary lacks its original .ct7 index. Its available text was recovered using the strictly increasing hexadecimal verse keys actually present in .ct4. All 3,572 supplied entries are retained. No neighbouring-verse note is assigned to a verse that lacks one.
- Nine source fragments lack indexed headwords. Their text remains available as additional source text, without invented attribution to neighbouring entries.
- Eighty-eight source reference tokens are invalid or have unavailable targets. The text reader uses a human-readable unavailable-reference label. Original tokens and locations remain in REFERENCE-INTEGRATION-LEDGER.json and derived/v2/source-issues.json; they have not been silently repaired.
- Some historical commentary font-coded Greek/Hebrew fragments remain in their supplied legacy notation. Native-script reconstruction is not inferred. Strong's entries use the supplied transliteration and pronunciation fields; this integration does not claim a newly verified original-script interlinear.
- Introductions embedded in verse notes, duplicate name entries, historical wording, and author viewpoints remain in their original source context.

## Integrity and reusable conversion

All 144 original files are retained and checked against the previously recorded Git blob hashes. Source-file sizes and SHA-256 hashes are recorded in the integration ledger. The three cross-reference files absent from the local copy were restored from the exact existing repository blobs, not from a replacement dataset.

reference-codecs.cjs reuses the established KJV verse table and extends the validated source-index approach for empty records, missing indexes, Bible offsets, lexical metadata, and KJV tags. prepare-reference-resources.cjs produces derived/v2 data and the ledger. The original files and earlier conversion utility are preserved.

Bible offsets are checked against every supplied book/chapter/verse triplet and the 31,102-position source table. Dictionary and commentary indexes must account for all source text bytes. Unknown control markers fail conversion rather than being silently discarded. Reader content is emitted as text nodes and explicit links, never executable source HTML.

## Publication and copyright review

This integration is local. No merge, deployment, Firebase configuration, security rules, or live-data changes were performed.

Readable local files do not establish redistribution rights. Full-edition release permissions remain unverified, particularly for NKJV, Modern King James, Bible in Basic English, and the unidentified Teacher's Commentary edition. Historical works also need edition/provenance review before public redistribution. Do not treat a resource's functional flag as a publication license.

Relevant primary references checked during this work:

- [Lockman permissions](https://www.lockman.org/permission-to-quote-copyright-trademark-information/) distinguish limited quotation from storage and reuse of a full NASB edition.
- [Biblica permissions](https://www.biblica.com/permissions/) require an appropriate license for full-edition NIV app use and address AI-enabled uses separately.
- [Thomas Nelson permissions](https://www.thomasnelson.com/about-us/permissions/) returned HTTP 403 during this review; full NKJV digital redistribution permission was not verified.
- NRSV publisher authorization was not verified. The supplied encoded file remains unavailable.

Any later public release must resolve the applicable permissions and approved payload. No release or licensing permission has been inferred from possession of the uploads.

## Verification and retained review evidence

Focused coverage includes all 29 functional groups, all original hashes, Strong number and metadata lookups, internal cross-links, full-text searches, every Bible/commentary reader, book and chapter selection, source KJV word tags, incomplete coverage, backward-compatible saved URLs, exact Study/Fellowship return journeys, and 320px layouts.

check-reference-regressions.cjs runs the reference checks and the broader existing MainStage, Study Tools, Learning, workspace, Calendar, Preparedness, Fellowship, games, map/privacy, email-boundary, and theme suites. Detailed results are retained on F: under Development/Iteration-Archives/reference-readers-start-2026-11-17/regression.

Browser checks use Chromium phone-sized and desktop layouts. Physical iPhone Safari review remains necessary. Retained screenshots are on F: under Development/Review-Screenshots/2026-11-17. Source data, reusable regression scripts, and review evidence are retained on F:. Disposable browser profiles are removed where unlocked; any profile still held by a crashed browser is left for a later safe cleanup.

### Final verification status (2026-11-17)

Sixteen of the nineteen recorded suites passed, including original-file integrity, the reference directory and saved-reader compatibility checks, MainStage, Study Tools, People, Learning, workspace navigation, Calendar, Common Ground, Fellowship home, games, invitation boundaries, and both theme suites. Earlier focused reader runs also exercised all 29 groups and the complete Scripture/Strong’s/Fellowship return journey.

The final reference-reader, Preparedness, and Preparedness migration runs could not complete because Windows/Node exhausted available memory. Some failed before the application could start. These results are retained as incomplete verification, not passes. The user explicitly requested stopping further tests at this point. Previous logs and the consolidated results remain in the F: regression archive. Physical iPhone Safari review is still pending.

Several existing regression scripts needed selector updates for the already-established three-workspace navigation and discussion disclosure. No unrelated application behavior was changed to satisfy those scripts. Large source-integrity checks were separated from browser checks to reduce peak memory.
