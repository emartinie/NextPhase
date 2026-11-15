# Covenants & Commandments migration

This branch extends the reviewed MainStage build. Open **Tools → Covenants & Commandments** for the full-size workspace. New Testament Notes and Hebrew Library are also accessible from Tools. MainStage remains the home experience.

## Review paths

- Search **To believe in God**, choose **Positive**, and open the P 1 record. Open **Hebrews 11:6** for the chapter notes. Open **John 17:3** for the missing-notes case and use **Read cited Scripture**. Open **Exodus 20** for the Sefaria excursion. Back should restore the exact record or list position and focus when the layout stays the same.
- Open **Mosaic / Sinai** from the covenant list. Try the **Passage comparisons**, **Related commandments**, and **Hebrew Library · Sefaria** sections.
- Try **?card=commandments&covenant=mosaic**, **?card=commandments&id=1**, **?card=nt&ref=Hebrews+11%3A6**, and **?card=sefaria&ref=Exodus+20** relative to the app's root. A direct link has MainStage as its return destination.
- Serve the repository root with any static server over HTTP. The original README describes the local preview. Run **node check-study-tools.cjs** with Playwright installed, or use the README environment overrides.

## Sources and limits

The local source files were copied without editorial edits from [HomeGroups revision 1e31cc4](https://github.com/emartinie/HGBibleApp/tree/1e31cc4dd984adc638db2aa87571618fee1f3e31). The workspace uses seven covenant records, seven comparison records, 26 explicit association rows, and all 608 raw commandment rows. There are 596 distinct source IDs. A repeated ID receives a suffix for the second row while the original ID still opens the first occurrence. No additional relationships were inferred. Ancient-source links that still point to HomeGroups open externally.

NT Notes preserves the original availability policy and uses the populated **mathew.json** file for Matthew. Six books remain unavailable under that policy. The requested passage stays available in the existing reader when local KJV coverage permits. The linked-witness section uses the original NT-to-OT quote index. The original NT wheel and complete legacy panel presentation are outside this slice.

Hebrew Library accepts a cited text reference and requests the original and English versions from [Sefaria's text API](https://developers.sefaria.org/reference/get-v3-texts). If the provider cannot return readable text, the panel offers the original link. The full Sefaria library search and related-text browser are outside this slice. No backend, authentication, or production Firebase integration was added.
