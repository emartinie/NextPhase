# Fellowship Preparedness · Storm outreach practice

This is the first local prototype from the [Preparedness workspace proposal](../NextPhase-Planning/09-Preparedness-Workspace-Proposal.md). Open **Study discussion → Preparedness** to start with the fictional Wednesday HomeGroup, or **Study Tools → Preparedness** to start with Plan & learn.

## Try the exercise

1. The scenario starts with **5 checked in**, **11 awaiting a check-in**, and **2 briefing acknowledgments**. Join or decline as Miriam. Acknowledging the briefing and checking in update separate counts.
2. Open **Listen**, choose the Dickson or Clark County example, and play the fictional net or read its transcript. Use **Practice a read-back** to enter the message ID, recipient, and pickup window. Submit an incorrect value first to see the correction.
3. Switch to **Ruth · Group coordinator** in Group and simulate an app outage. Open the fallback. **Save practice card** downloads a plain-text plan available from the loaded page without internet. **Open printable card** opens a separate print view.
4. Switch to **Daniel · Radio lead**. Enter one simulated report for a remaining participant. Previously checked-in members do not appear in that picker. Open the exercise log to compare app and operator-reported entries.
5. As Ruth, open **Finish and debrief**, leave one improvement, and end the exercise. Close the workspace and return to your original Fellowship screen. The debrief still opens after a reload.

## Boundaries

All participants, events, channel changes, reporting, and timings are fictional. The WAV recording was made locally from the checked-in exercise script using synthetic voices. Radio listings and preparedness references are public outbound links. There is no live feed, hardware, map provider, Firebase, account or shared delivery. Checked-in counts are scoped to this exercise and do not establish anyone's physical safety.

Progress is stored separately in the current browser. The first pass supplies a one-exercise demo and uses a fixed fictional roster. Cross-browser synchronization, authenticated roles, real reporting, multiple exercises, and retention policies are deferred. Save the practice card before needing it. The warm page can export a copy offline. Cold offline launch, the recording, print page and public links may need internet. Physical iPhone Safari remains unverified.

## Run or verify

Serve the repository root over HTTP and open **?face=fellowship**. Run **node check-preparedness.cjs** with Playwright. The main README describes the local environment overrides. The check verifies the fictional scenario and the existing panel return behavior and uses network-off emulation for the text export.
