---
status: approved
---

# Design brief: Keep Pace

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

Keep Pace is a Hands-Only CPR training coach for SPECS, used on a CPR manikin. It is for people who took a CPR course or watched a CPR video but don't dare to act for lack of practice. The goal is to make the motion automatic, so that in a real situation the person acts without help. Keep Pace is NOT an emergency tool, and it says so clearly.

## The one spatial moment
I'm kneeling at the manikin's shoulder, hands stacked and fingers interlaced on the center of the chest, arms straight, pushing with my upper body. Two thin brackets on either side of my hands breathe with the rhythm and a soft click keeps the beat. After about ten on-pace compressions they fade away and I hold the rhythm alone. When I slow down, the brackets come back at once, then fade again when I recover. All of this happens in one round, in one continuous take.

The user's three design rules:
1. Information lives on the chest, not at eye level.
2. When everything is fine, the Lens stays silent.
3. One word at most, never for more than one second, and no text near the hands.

## Why it belongs on glasses
- Uses: draws in the world (the rhythm cue sits on the chest, around the hands), leaves your body free (both hands are on the chest, eyes stay down on the hands, zero touch during compressions).
- Why it's better than the phone or laptop version: during practice your hands are busy and your eyes must stay on the chest. A phone or video sits somewhere else and has to be glanced at; a trainer can't watch ten trainees' rhythm at once. The glasses put the cue where you already look, and take it away once you no longer need it.

## Product or overlay
- Type: overlay. It responds to a real manikin (or a folded cushion), which the Lens never recognizes.
- What the real version would sense: where the chest center is (set by the user, not recognized), and each real compression (from hand motion tracking on device, in a later version).
- Stand-in for the preview:
  - Manikin: a simple real-scale placeholder torso lying on the floor in front of the user, about 60 cm long, 35 cm wide, 20 cm high (default). It is hidden when running on device.
  - Chest target: the user places it with one pinch aimed at the chest center. This is the real interaction too, not only a stand-in.
  - Compressions: each pinch on the placed target emits one compression event. This is an explicit stand-in; nobody pinches during real CPR. No keyboard input. The demo video says so.
  - Architecture: everything downstream (brackets, click, fading, spoken cues, summary) only consumes a target position and a stream of compression events, so real sources (a manikin, hand tracking) can replace the stand-ins later without changing that logic.

## Where things live
- Where the user is looking during the main task: down at their own hands on the chest, about 50 cm from the eyes. At that distance the usable view is about 23 cm tall by 38 cm wide; the chest depth maps to the vertical axis.
- Placeholder torso: on the floor in front of the preview camera; the preview camera starts at kneeling height beside the torso, at about 110 cm eye height upright (default), and leans in with Q/E to the chest view.
- Chest target: a small flat marker on the chest plane showing where the heel of the hand goes, about 6 cm across (default). The brackets center on it.
- Rhythm brackets: two vertical brackets on either side of the stacked hands, using the wider horizontal axis. Each about 12 cm long with a 1 cm stroke, thin and low opacity, light color (default: white). They breathe horizontally between about 7 cm from center (push) and 9 cm (release), always at least 2 cm from the edge of the hands (about 10 x 20 cm). Total footprint about 20 x 12 cm, which fits the view with margin for head movement. Nothing is drawn over the hands or forearms.
- Click and spoken cues: spatialized at the chest target.
- Opening reminder (Call, Push, Shock) and the training disclaimer: world-anchored about 1 to 1.2 m ahead, slightly below eye level, above where the manikin lies. Panel about 40 cm wide, cap height about 4 cm, one icon per line. Never follows the head.
- Round summary: world-anchored about 1 m beyond the manikin at kneeling eye height, facing the user, outside the view while looking at the hands. Three lines, cap height about 4 cm, panel about 45 cm wide (default).
- "Again" and "Move target" buttons: under the summary lines, rectangular, icon plus label, about 16 x 8 cm each (default).
- All starting values above are to be validated in the preview with the placeholder torso.

## Hands and input
- Place the target: a single pinch aimed at the center of the chest (in the preview, a mouse pinch on the placeholder torso). Before the first compression, pinching elsewhere on the torso moves the target.
- Compress (preview stand-in): pinch on the placed target; each pinch is one compression event.
- Target lock: from the first compression until the end of the round, the target is locked. Any pinch on the torso counts as a compression (generous hit zone covering the whole torso); a pinch fully outside the torso is ignored. After a round, the target can only be moved with "Move target".
- Again: pinch the button to start a new round on the same target.
- Move target: pinch the button to unlock the target; the next pinch on the torso places it.
- Targets are big and highlight when aimed at.
- Voice (if any) and the button that does the same job: no voice input. Voice is output only (short spoken cues).

## When things show
- Opening reminder and disclaimer: shows at launch; hides as soon as the chest target is placed.
- Chest target marker: shows once placed; stays visible but quiet during the round (default).
- Brackets and click: show at full strength from the first compression. After about ten consecutive on-pace compressions (default: 10), the brackets fade out, then the click lowers and stops (default: over about three compressions). When the cadence drifts, they come back immediately; when the user recovers, they fade again after another ten on-pace compressions.
  - On-pace: a compression interval between 500 and 600 ms, i.e. 100 to 120 per minute (sourced below). Drift: the average of the last three intervals leaves that range, or no compression for over 1 s (default).
  - Metronome tempo of the brackets and click: 110 per minute, the middle of the recommended range (default).
- "Faster" / "Slower": short pre-recorded spoken cues (default), spatialized at the target, at most once every 5 s (default), only when the measured cadence is reliable (default: at least four compressions in the last 3 s). At the same moment the brackets briefly thicken (a shape change, not color alone), so the correction is still visible without sound. No text near the hands.
- End of a round: a round is a timed 2 minute round counted from the first compression (the recommended switch interval, sourced below), or it ends early after 3 s without a compression. The 3 s threshold is a design choice of this Lens, not a guideline value. At the end, the brackets do one slow expansion and fade out (shape change, no text), with a distinct end tone at the chest, about one second. Nothing remains on the chest except the target marker.
- "Round complete": a short spoken cue right after the end tone, telling the user to look up.
- Summary: appears about one second after the end pulse. Three lines: round duration, average cadence, regularity (share of compression intervals within 100 to 120 per minute). Measured values only; in the preview they come from the pinch stand-in. From the second round of a launch, one extra line compares regularity with the previous round (kept in memory for the current launch only). The summary stays until the user pinches "Again" or "Move target", no timer.
- If something needs attention out of view: the summary sits out of view while looking at the hands, so the spoken "Round complete" tells the user to look up.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Fading: about ten on-pace pinches on the target make the brackets and click fade; a slowdown brings them back immediately; recovery fades them again. (LEAF drives pinch sequences at a set cadence.)
2. Target lock: after the first compression, a pinch on the torso away from the target counts as a compression (the brackets react) and the target does not move; a pinch outside the torso does nothing.
3. Early end: stopping for 3 seconds triggers the chest pulse, the spoken "Round complete", then the summary. With the camera looking down at the torso the summary is out of view; looking up, it is readable in front of the user. (The sequence is LEAF-testable; the view check is done by walking the preview.)
4. Faithful summary: a pinch series at a known steady cadence produces an average cadence close to that value and regularity close to 100%; a deliberately irregular series lowers regularity. (LEAF controls pinch timing.)
5. Again and Move target: pinching "Again" starts a new round on the same target, and the second round's summary shows a comparison line with the first; pinching "Move target" unlocks the target and the next pinch places it elsewhere.

## Out of scope
This version won't do the following. They are listed as "What's next" and are not part of the criteria or the demo:
- An emergency mode for real bystanders (dropped on purpose: a panicked first-time user needs no menu, and it can't be demonstrated honestly).
- Memory across sessions and fading across sessions.
- Hands-on-target verification (can't be shown or tested in the preview; a false alarm with interlaced fingers is worse than silence).
- On-device compression detection from hand motion tracking. The compression event interface is ready for that adapter, but it is not claimed or demonstrated.
- A shared trainer mode where an instructor sees a trainee's rhythm live (needs two people sharing one Lens).
- Measuring compression depth or chest recoil, and rescue breaths.

## Text and content rules
- Texts are very short and readable in motion. No emoji (icons instead), no dashes, no generic copywriting, no mention of AI in any Lens text.
- Lens texts (default wording, English): reminder lines "Call", "Push", "Shock"; disclaimer "Practice tool for manikin training. Not for real emergencies. Does not replace certified CPR training or dispatcher instructions."; spoken cues "Faster", "Slower", "Round complete"; summary labels "Time", "Rate", "Regularity", comparison "Last round"; buttons "Again", "Move target".
- High contrast, light content on the additive display; nothing covers the manikin's chest or the hands.

## Medical values used (sourced)
Every medical value in the Lens comes from this table. Nothing else is invented.

| Value | AHA 2025 | ERC 2025 |
|---|---|---|
| Rate 100 to 120 per minute | "reasonable ... at a rate of 100 to 120/min" (Class 2a) | "100–120 min-1 with as few interruptions as possible" |
| Depth (not measured by this Lens; training context only) | at least 5 cm, avoid more than 6 cm (Class 1) | at least 5 cm, not more than 6 cm |
| Full recoil (not measured) | allow complete chest wall recoil (Class 2a) | allow the chest to recoil completely, avoid leaning |
| Hand position | heel of one hand on the center of the chest (Class 1) | heel of one hand on the lower half of the sternum, other hand on top, fingers interlocked |
| Order: call, push, defibrillator | activate the emergency response system, then immediately begin CPR; CPR until a defibrillator or AED is applied (Class 1) | call emergency services with the phone on speaker, start compressions as soon as possible, attach an AED as soon as available |
| Switch compressors about every 2 minutes (round length) | "reasonable to switch chest compressors approximately every 2 min" (Class 2a) | not cited: the RCUK 2025 Adult BLS guideline (which cites ERC 2025) gives no switch interval, and the full ERC chapter could not be read (HTTP 403, checked 2026-10-23); the round length cites AHA only |
| Compression-only CPR for untrained rescuers | compression-only is appropriate if untrained or unwilling to give breaths | continuous compressions if not trained to give rescue breaths |
| Real-time feedback | "reasonable to use audiovisual feedback devices for real-time optimization of CPR performance" (Class 2a) | not checked |

Sources:
- Kleinman ME et al. Part 7: Adult Basic Life Support. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025;152(suppl 2):S448–S478. doi:10.1161/CIR.0000000000001369. https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-basic-life-support
- Smyth MA et al. European Resuscitation Council Guidelines 2025 Adult Basic Life Support. Resuscitation. 2025;215(Suppl 1):110771. doi:10.1016/j.resuscitation.2025.110771. Values read via the Resuscitation Council UK 2025 Adult BLS page, which cites it: https://www.resus.org.uk/professional-library/2025-resuscitation-guidelines/adult-basic-life-support-guidelines

## Risks and open questions
- Comfort at about 50 cm: the chest is closer than the most comfortable viewing range of the glasses. Mitigation: only the brackets and an occasional spoken cue live there; all reading happens at a comfortable distance before kneeling and after looking up. Comfort is not proven ("feel unproven").
- The pinch-per-compression input is a stand-in. Mouse clicking at about two per second is not CPR; the video and README must say so. Real compression detection on device is not demonstrated.
- Interlaced fingers may break SPECS hand tracking on device; the brackets and click are designed to work with no measurement at all.
- Spoken cues depend on pre-recorded clips being generated; if not, distinct tones plus the bracket thickening carry the correction.
- The 2 minute round cites AHA 2025 only: no ERC 2025 statement on a switch interval could be found (RCUK 2025 summary silent, full chapter unreadable, checked 2026-10-23).
- The 3 s early-end threshold and the "ten on-pace compressions" fade rule are design choices, not guideline values.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
