# Fellowship · Invite to Game

Open **Study discussion** and tap **Invite to Game** in the bottom bar. The private invitation link opens the form directly. Pick Miriam or Daniel and a game. **Send demo invitation** shows the recipient’s pending invitation. Use **Accept invite** or **Decline invite** to try the recipient’s response. Active and completed games appear under **Your invitations**.

- **Bible Trivia** uses five distinct questions from the pinned HomeGroups bank. You can read a hint, take a Scripture excursion when the hint is a recognized reference, type or think of an answer, reveal the source answer, and score your own response. The simulated participant gets a generated outcome for each question. The fifth question produces a winner or tie and a review of the answers.
- **Bible Bingo** uses the original B–I•–B–L–E ranges and a shuffled 75-number deck with no repeat calls. This build generates two five-by-five cards with a free center. Draw a call, mark matching numbers and call Bingo for a row, column or diagonal. The simulated participant marks called squares automatically. If that card gets a line on a draw, you can still mark the current call and claim a tie before finishing the turn.
- **Close** returns to the same weekly discussion, preserving its draft, scroll and opener focus. A Scripture hint uses the existing Back stack. Invitations and gameplay resume in the same browser after reload. The prototype scopes them to the selected study week and civil year. Archive discussions remain read-only.

## Source and limitations

The unedited [HomeGroups Trivia question bank](https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/bible_questions_with_hints.json) has 1,001 rows. The selection skips incomplete rows and uses distinct question text within a game. Source wording and citations were carried over without an editorial audit. The [original Trivia card logic](https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/js/trivia.js) supplies the question, hint and reveal pattern. The [original Bingo caller](https://github.com/emartinie/HGBibleApp/blob/1e31cc4dd984adc638db2aa87571618fee1f3e31/js/biblebingo.js) supplies the ranges and no-repeat draw pattern. Generated Bingo cards and win checks are new. The review build uses manual calls.

The recipient response and opponent turns are simulated. No messages, notifications, or games are sent to another device. Browser-local storage can be cleared by the browser. A real multi-user phase would need shared invitation and turn state and account permissions. This branch uses no backend or production Firebase.

To run locally, serve **dist** over HTTP and open **?face=fellowship**. Run **node check-fellowship-games.cjs** for the game rules and browser checks, with the Playwright environment options in the main README.
