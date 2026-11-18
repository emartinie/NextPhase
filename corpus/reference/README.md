# Bible reference uploads

These are the original uploaded Bible-study module files, organized by resource under `bibles/`, `commentaries/`, `dictionaries/`, `topics/`, `devotionals/`, `lexicons/`, and `cross-references/`. Existing `ancient-library/` content is unchanged.

Upload additional files into `incoming/`. Keep a resource's companion files together; matching indexes used by different resources are intentional.

`uploaded-modules.json` records all 117 files relocated from the repository root, their original names, exact Git blob hashes, sizes, and destinations across 29 resource groups. Fifteen exact root duplicates already had an identical file at their destination and were removed from the root only.

The original binary bytes and filename case are preserved. The originals remain unchanged; derived readers now make the viable supplied resources usable as described below. The initial file organization preserved application behavior; the later reader integration is documented separately.

## Functional Reference Library

The local Learning Hub now reads **29 of the 36 resource groups** through shared entry and passage readers. This includes Strong’s Hebrew and Greek, all four dictionaries, eight commentaries, nine Bible editions, three topical works, cross-references, Daily Light, and the integrated Strong’s Word Index.

See [functional integration and remaining blockers](../../REFERENCE-LIBRARY.md), the [integration ledger](../../REFERENCE-INTEGRATION-LEDGER.json), and the [reader catalog](derived/v2/catalog.json). The original [upload manifest](uploaded-modules.json) and [source directory](resource-directory.json) retain their inventory role. The seven unavailable resources have missing text or protected encoding; no replacement edition was substituted. This work remains local until reviewed for publication and permissions.

## Resource directory

The collection contains **36 legacy module groups (144 files)**, including the earlier uploads and the newly organized resources. Four groups have missing expected companion files. “Parts present” means the usual file set is present; it does **not** confirm that the binary content has been decoded, validated, or integrated into NextPhase. Strong's supplementary indexes are counted as one group, not a separate dictionary.

### Bible translations

| Resource | Files | Upload status |
|---|---:|---|
| [American Standard Version (ASV)](bibles/asv/) | 6 | Readable locally · bible |
| [Bible in Basic English (BBE)](bibles/bbe/) | 6 | Readable locally · bible |
| [Darby's Translation](bibles/darby/) | 6 | Readable locally · bible |
| [King James Version](bibles/kjv/) | 8 | Readable locally · bible |
| [1910 Louis Segond Version](bibles/louis-segond-1910/) | 2 | Unavailable · source text missing |
| [1912 Luther German Bible](bibles/luther-1912/) | 6 | Readable locally · bible |
| [Modern King James Version](bibles/modern-king-james/) | 6 | Readable locally · bible |
| [Montgomery's New Testament](bibles/montgomery-new-testament/) | 6 | Readable locally · bible |
| [New American Standard Bible 95 Update](bibles/nasb-1995/) | 6 | Unavailable · encoded text; see ledger |
| [New American Standard Bible](bibles/nasb/) | 6 | Unavailable · encoded text; see ledger |
| [New International Version](bibles/niv/) | 6 | Unavailable · encoded text; see ledger |
| [New King James Version](bibles/nkjv/) | 6 | Readable locally · bible |
| [New Revised Standard Version](bibles/nrsv/) | 6 | Unavailable · encoded text; see ledger |
| [Twentieth Century New Testament](bibles/twentieth-century-new-testament/) | 6 | Readable locally · bible |

### Commentaries and Bible notes

| Resource | Files | Upload status |
|---|---:|---|
| [Adam Clarke's Commentary](commentaries/adam-clarke/) | 3 | Readable locally · commentary |
| [Albert Barnes' New Testament Commentary](commentaries/albert-barnes/) | 3 | Readable locally · commentary |
| [Family Bible Notes](commentaries/family-bible-notes/) | 3 | Readable locally · commentary |
| [1599 Geneva Bible Notes](commentaries/geneva-1599/) | 3 | Readable locally · commentary |
| [Jamieson-Fausset-Brown Commentary](commentaries/jamieson-fausset-brown/) | 3 | Readable locally · commentary |
| [John Wesley's Notes on the Old and New Testaments](commentaries/john-wesley/) | 3 | Readable locally · commentary |
| [Matthew Henry's Concise Commentary](commentaries/matthew-henry-concise/) | 2 | Readable locally · commentary |
| [Matthew Henry's Commentary on the Whole Bible](commentaries/matthew-henry/) | 1 | Unavailable · source text missing |
| [Teacher's Commentary](commentaries/teachers-commentary/) | 3 | Readable locally · commentary |

### Bible dictionaries

| Resource | Files | Upload status |
|---|---:|---|
| [American Tract Society Dictionary](dictionaries/american-tract-society/) | 3 | Readable locally · dictionary |
| [Easton's Bible Dictionary](dictionaries/easton/) | 3 | Readable locally · dictionary |
| [Hitchcock's Bible Names](dictionaries/hitchcock-bible-names/) | 3 | Readable locally · dictionary |
| [Smith's Bible Dictionary](dictionaries/smith/) | 3 | Readable locally · dictionary |

### Original-language dictionaries and indexes

| Resource | Files | Upload status |
|---|---:|---|
| [Strong's Greek Dictionary](lexicons/strongs-greek/) | 3 | Readable locally · lexicon |
| [Strong's Hebrew Dictionary](lexicons/strongs-hebrew/) | 3 | Readable locally · lexicon |
| [Strong's supplementary index files](lexicons/strongs-index/) | 3 | Integrated with both Strong’s dictionaries |

### Topical references

| Resource | Files | Upload status |
|---|---:|---|
| [Everyday Life References](topics/everyday-life-references/) | 3 | Readable locally · topic |
| [Nave's Topical Bible](topics/naves-topical-bible/) | 3 | Readable locally · topic |
| [Thompson Chain Topics](topics/thompson-chain/) | 3 | Readable locally · topic |

### Cross-references

| Resource | Files | Upload status |
|---|---:|---|
| [BCD cross-reference module (bcdxrefs)](cross-references/bcdxrefs/) | 3 | Readable locally · crossrefs |

### Devotional readings

| Resource | Files | Upload status |
|---|---:|---|
| [Bagster's Daily Light](devotionals/bagsters-daily-light/) | 3 | Readable locally · devotional |
| [Morning and Evening Readings](devotionals/morning-and-evening/) | 2 | Unavailable · source text missing |

### Ancient Library

The [Ancient Library catalog](ancient-library/catalog.json) contains **18 entries**. Twelve have stored reader texts or collections; the remaining six are edition-review entries or planned reference guides. The status labels below are catalog/source-confirmed, not a fresh runtime test. Inclusion does not imply scriptural authority.

| Resource | Current availability |
|---|---|
| [1 Enoch](ancient-library/1-enoch/) | In-app reader available; JSON files stored here |
| [Jubilees](ancient-library/jubilees/) | In-app reader available; JSON files stored here |
| [Testaments of the Twelve Patriarchs](ancient-library/testaments-twelve-patriarchs/) | In-app reader available; JSON files stored here |
| [Life of Adam and Eve](ancient-library/catalog.json) | Edition review required |
| [Psalms of Solomon](ancient-library/psalms-solomon/) | In-app reader available; JSON files stored here |
| [4 Ezra](ancient-library/4-ezra/) | In-app reader available; JSON files stored here |
| [2 Baruch](ancient-library/catalog.json) | Edition review required |
| [Flavius Josephus](ancient-library/josephus/) | In-app collection available; JSON files stored here |
| [Philo of Alexandria](ancient-library/philo/) | In-app collection available; JSON files stored here |
| [Tacitus](ancient-library/tacitus/) | In-app collection available; JSON files stored here |
| [Suetonius](ancient-library/suetonius/) | In-app collection available; JSON files stored here |
| [Didache](ancient-library/didache/) | In-app reader available; JSON files stored here |
| [1 Clement](ancient-library/1-clement/) | In-app reader available; JSON files stored here |
| [Shepherd of Hermas](ancient-library/shepherd-hermas/) | In-app reader available; JSON files stored here |
| [The Biblical Book of Jashar](ancient-library/catalog.json) | Reference guide planned; no surviving text |
| [Later Books Called Jasher](ancient-library/catalog.json) | Comparison guide planned |
| [Book of the Wars of the LORD](ancient-library/catalog.json) | Reference guide planned; no surviving text |
| [Other Lost Works Mentioned in Scripture](ancient-library/catalog.json) | Reference catalog planned |

The Josephus collection includes Antiquities, Jewish War, Life, and Against Apion. Philo, Tacitus, and Suetonius have their own collection manifests and individual work files. Edition and original-source links are retained in the catalog and book manifests.

### Supporting study and research data

| Resource | What is available |
|---|---|
| [New Testament / Old Testament intertext comparisons](intertext.json) | 310 stored comparison records, including Septuagint and Masoretic renderings. |
| [Translation and listening samples](samples.json) | Three translation samples — Leviticus 21:1, Ezekiel 44:15, and Matthew 26:2 — plus listening sample metadata. These are not a general word-aligned interlinear. |
| [Investigation research backlog](backlog.json) | 1,940 topic records for future research; not 1,940 completed articles. |
| [Biblical references to non-canonical and lost sources](../research/biblical-references-to-non-canonical-and-lost-sources.json) | Related structured research stored alongside the reference collection. |
| [Upload manifest](uploaded-modules.json) | Original filenames, destinations, sizes, hashes, and incomplete-set notes for the 117 recently organized files. |

The existing [readable KJV corpus](../kjv/) is separate from the legacy KJV binary module above. Files stored in these folders do not automatically become new options in the application's readers or search tools.

## Incomplete uploaded sets

| Resource | Uploaded parts | Expected companion parts not found |
|---|---|---|
| 1910 Louis Segond Version | LSV.bt0, LSV.bt3 | .bt4, .bt5, .bt6, .bt7 |
| Morning and Evening Readings | MER.tt0, MER.tt7 | .tt4 |
| Matthew Henry's Commentary on the Whole Bible | MHC.ct0 | .ct4, .ct7 |
| Matthew Henry's Concise Commentary | MHCC.ct0, MHCC.ct4 | .ct7 |

The expected part patterns are inferred from other supplied modules of the same type. Preserve partial sets and add missing parts when available. Existing Strong's Greek and Hebrew dictionaries each have all three supplied parts (`.gx0/.gx4/.gx7` and `.hx0/.hx4/.hx7`), plus three supplementary `.sd` files in `lexicons/strongs-index/`.

## Storage and reuse

This folder is in the public NextPhase repository. Moving files here does not make them private or erase earlier copies from Git history. Verify each resource's provenance, permissions, format, encoding, and usability before incorporating its text into application features. The top-level corpus license must not be assumed to grant rights over independently uploaded resources.
