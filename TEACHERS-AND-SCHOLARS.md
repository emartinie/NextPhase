# Teachers & Scholars

Open **Study → Tools → Teachers & Scholars**. Search by name, subject or work. Filter to teachers or scholars, open a profile, choose a teaching, or open the Acts 15 debate. Back restores the directory’s search and filter or the position in the teaching list.

The migration carries five scholar profiles and three enabled teaching archives from [the pinned HomeGroups revision](https://github.com/emartinie/HGBibleApp/tree/1e31cc4dd984adc638db2aa87571618fee1f3e31). The scholar JSON is copied from [the Scholars catalog](https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/data/scholars.json). The teaching and debate records are extracted from [the Missler card script](https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/js/missler.js). Some of the 72 archive listings point to the same YouTube video, including across contributors. The UI flags shared entries and retains the original listing order. Placeholder contributors stay hidden. Profile and archive content stays within what the pinned sources provide.

YouTube loads only after pressing **Load YouTube player**. **Watch on YouTube** provides the original destination if an embed is unavailable. Video playback and presenter attribution have not been audited. No HomeGroups production or Firebase services are accessed by the feature.

Serve the repository root over HTTP. Try **?card=people**, **?card=people&id=chuck-missler**, or **?card=people&debate=acts-15-law-of-moses**. The older **?card=scholars&id=craig-s-keener** and **?card=missler** routes also resolve. Run **node check-people.cjs** for the phone-sized and desktop interaction checks, using the Playwright overrides in the main README where needed.
