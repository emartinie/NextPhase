# Bible reference uploads

These are the original uploaded Bible-study module files, organized by resource under `bibles/`, `commentaries/`, `dictionaries/`, `topics/`, `devotionals/`, and `lexicons/`. Existing `ancient-library/` content is unchanged.

Upload additional files into `incoming/`. Keep a resource's companion files together; matching indexes used by different resources are intentional.

`uploaded-modules.json` records all 117 files relocated from the repository root, their original names, exact Git blob hashes, sizes, and destinations across 29 resource groups. Fifteen exact root duplicates already had an identical file at their destination and were removed from the root only.

The original binary bytes and filename case are preserved. These legacy files have not been converted into a NextPhase reader or independently verified as complete texts. No application behavior changes accompany this organization.

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
