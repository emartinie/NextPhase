# NextPhase V2 · The Living Thread

An independent HomeGroups prototype. Open `index.html` in a browser. No package installation, build step, backend, or account is required.

## Try the reading journey

1. Start at John 1:1–5. Scroll partway through the thread, then open **Genesis 1:1–5** or tap a verse number for its tools.
2. Expand the excursion and flip between **Read** and **Study tools**. Open a cross-reference or the word study, then go back one panel or close the excursion to resume at the original scroll position.
3. Follow the question into an investigation. Flip between **Evidence** and **Interpretation**, open its sample discussion, and return to the reading.
4. Switch to **Noach** or **Lech Lecha** using the week selector. Each week has its own reading, research, discussion, and scroll position for the visit.
5. In **Fellowship**, follow or unfollow sample communities and see their posts together. Replies are a local simulation. Open **Companion** from any screen to try a scripted study prompt.
6. Save a passage or write a note from its tools. Open **Notebook** to find it by week.

## Design choices

- The thread starts with Scripture and introduces research or conversation through a question from the passage. The curriculum chooses the reading without acting as the main navigation.
- Three destinations keep global navigation short. Language, cross-references, investigations, and commandments are available from a passage or verse. That makes the default screen quieter and gives those tools a specific reading context.
- The underlying view stays mounted during excursions. A phone gets a bottom sheet. Desktop has a central reader, navigation and an outline, plus a right-side excursion. Closing returns focus and scroll position to the opener. The panel stack has its own back control.
- Notes, bookmarks, sample memberships, and simulated replies are local to the browser when storage is available. The Companion, draft inputs, and reading positions are scoped to the visit. Fellowship content and Companion replies are scripted. V2 has its own storage key.

## Content and assets

Study themes draw from HomeGroups’ [Living Thread experiment](https://github.com/emartinie/HGBibleApp/blob/main/living-thread.html) and the [Bereshit](https://github.com/emartinie/HGBibleApp/blob/main/data/week1.json), [Noach](https://github.com/emartinie/HGBibleApp/blob/main/data/week2.json), and [Lech Lecha](https://github.com/emartinie/HGBibleApp/blob/main/data/week3.json) weekly materials. Scripture excerpts use the King James Version. Study notes are prototype copy and the sample posts are fictional. See [icon licenses](ICON-LICENSE.txt) for Lucide attribution.
