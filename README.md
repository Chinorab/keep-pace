# Keep Pace

A Hands-Only CPR training coach for SPECS, used on a CPR manikin.

Keep Pace is for people who took a CPR course or watched a CPR video but would not dare to act because they never practiced enough. It puts a quiet rhythm cue on the manikin's chest, right where your eyes already are, and takes it away as soon as you hold the pace on your own. The goal is that the motion becomes automatic.

**Keep Pace is a practice tool. It is not an emergency tool.** It does not replace certified CPR training or the instructions of an emergency dispatcher. The Lens says so on its first screen.

Built for the [Learn AR with SPECS](https://learn-specs.devpost.com) hackathon, planned with the Devpost Learn skill pack and built with CLAD, Lens Studio 5.24.1 and the Lens Studio MCP.

## The problem

- Help from people nearby is the gap. The American Heart Association says immediate CPR and AED use can double or even triple the chance of surviving cardiac arrest, yet less than half of people in cardiac arrest receive that help from someone nearby [6]. Campaigns such as World Restart a Heart Day, every October 16, exist to close it [7]. The ILCOR release for the first World Restart a Heart Day names the barrier: many people do not perform CPR because they do not know what to do or are afraid of hurting the person [8].
- Bystander CPR saves lives. A 2025 meta-analysis of 14 observational studies (253,247 patients) found higher survival to discharge or at 30 days when a bystander performed CPR (pooled OR 1.72, 95% CI 1.40 to 2.12) [1].
- Training alone does not make people act. In a study of 911 callers at cardiac arrests, trained bystanders were far more likely to perform CPR than untrained ones, yet among trained bystanders who did not act, panic was the most common reason given, ahead of worrying about doing it wrong [2]. Confidence, not knowledge of the steps, is the gap.
- The guidelines support real-time feedback. The 2025 AHA guidelines state it is reasonable to use audiovisual feedback devices for real-time optimization of CPR performance (Class 2a) [3], and the 2025 AHA education chapter covers CPR feedback devices in training [4].

So the job is practice: many repetitions on a manikin, at the right pace, until the rhythm no longer needs thinking.

## The one moment it is built for

You kneel at the manikin's shoulder, hands stacked on the center of the chest, arms straight. Two thin brackets on either side of your hands breathe with the rhythm and a soft click keeps the beat. After about ten on-pace compressions they fade away and you hold the rhythm alone. When you slow down, the brackets come back at once (and briefly thicken, with a short "Faster" cue), then fade again when you recover. When you stop, the brackets do one slow pulse, a tone tells you to look up, and a short summary waits in front of you: time, rate, regularity, and from the second round a comparison with the last one.

## Why it belongs on glasses

During practice both hands are on the chest and your eyes must stay down on your hands. A phone or a video sits somewhere else and has to be glanced at, and a trainer cannot watch the rhythm of ten trainees at once. The glasses put the cue where you already look, and remove it once you no longer need it.

## AR design choices

Three rules, set during planning, drive every choice:

1. Information lives on the chest, not at eye level.
2. When everything is fine, the Lens stays silent.
3. One word at most, never for more than one second, and no text near the hands.

What that gives:

- **Brackets, not a ring.** At about 50 cm from the eyes the usable view is roughly 23 cm tall by 38 cm wide. A ring around the hands plus a word beyond it would not fit, so the cue became two vertical brackets on the wider horizontal axis, 12 cm long, breathing between 7 and 9 cm from center. Nothing is drawn over the hands or forearms.
- **Fading guidance.** Full brackets and click at first; after 10 consecutive on-pace compressions the brackets fade, then the click lowers and stops over about three beats. Drift brings both back immediately.
- **Corrections without text.** "Faster" and "Slower" are short cues at the chest, at most once every 5 seconds and only when the measured cadence is reliable (at least 4 compressions in the last 3 seconds). The brackets thicken at the same moment, so the correction is visible without sound and does not rely on color.
- **Reading happens away from the hands.** The reminder (Call, Push, Shock, plus the disclaimer) is world-anchored about 1.1 m ahead before you kneel. The summary is world-anchored about 1 m beyond the manikin at kneeling eye height, out of view while you look at your hands; a tone tells you to look up.
- **Additive display.** All content is light on transparent; nothing relies on black.
- **Target lock.** A pinch on the chest places the target. From the first compression until the end of the round the target is locked, and any pinch on the torso counts as a compression, so a sloppy hand does not move the target mid-round. "Move target" unlocks it.

## Values and where they come from

Every medical value comes from current guidelines. The full table, with quotes, is in [devpost/design-brief.md](devpost/design-brief.md).

| Value in the Lens | Source |
|---|---|
| On-pace: 100 to 120 per minute (intervals of 500 to 600 ms) | AHA 2025 Part 7 (Class 2a) [3]; ERC 2025 [5] |
| Metronome at 110 per minute | Middle of that range (design choice) |
| Round of 2 minutes from the first compression | AHA 2025: reasonable to switch compressors about every 2 min (Class 2a) [3] |
| Order on the reminder: call, push, shock | AHA 2025 [3]; ERC 2025 [5] |
| Hands-Only (compressions only) | AHA 2025 [3]; ERC 2025 [5] |

Design choices of this Lens, not guideline values: fade after 10 on-pace compressions, drift when the average of the last 3 intervals leaves the range or after more than 1 s without a compression, early end after 3 s without a compression, at most one spoken correction every 5 s. Depth and recoil are not measured.

## How it is built

```
Assets/Scripts/
  KeepPaceSession.ts          Pure logic: state machine, cadence math, fading, drift, cue gating,
                              round timer, summary stats. No Lens APIs; runs under plain Node too.
  KeepPaceController.ts       Orchestrator and public test API.
  KeepPaceTorsoInput.ts       SIK pinch input on the torso and the chest target.
  KeepPaceChestCueView.ts     Target marker and brackets (breathing, thickening, end pulse).
  KeepPaceAudioController.ts  One play function per cue, spatialized at the chest target.
  KeepPaceReminderPanelUI.ts  Opening reminder and disclaimer (UI Kit).
  KeepPaceSummaryPanelUI.ts   Round summary and the Again / Move target buttons (UI Kit).
  KeepPaceMeshes.ts           Flat chest meshes built in code.
Assets/Tests/                 LEAF scenarios, one or two per done criterion.
Assets/Audio/                 Five short tones synthesized locally.
devpost/design-brief.md       The approved design brief the Lens was built from.
```

Everything downstream (brackets, click, fading, cues, summary) consumes only a target position and a stream of compression events (`onCompression(timeMs)`, `tick(timeMs)`). Today the events come from a pinch stand-in; a real source such as on-device hand motion can call the same entry points without changing that logic.

### What CLAD built, and what I decided

I planned the Lens in an interview with the Devpost Learn skill pack and approved the resulting brief. The decisions that shaped it are mine:

- Training only, on a manikin. An emergency mode was dropped on purpose: a panicked first-time user needs no menu, and it cannot be demonstrated honestly.
- The fading guidance inside one round is the core idea, instead of memory across sessions.
- The three design rules above, the switch from a ring to two brackets after the field-of-view check, spoken cues instead of words near the hands.
- The pinch stand-in for compressions, the removal of a hands-on-target check (false alarms with interlaced fingers would be worse than silence), the target lock, the 3 s early end, the summary content and the two buttons.

CLAD (the `ls-clad` plugin, through the Lens Studio MCP) built the scene, wrote the scripts and tests, and made these build-time adjustments:

- The preview floor sits about 150 cm below the starting camera, not 110 cm, so the placeholder torso lies on that floor and the user presses Q to kneel. A Lens cannot set the preview camera height. The whole stand-in hangs under one root, "Manikin (preview stand-in)".
- Summary text has a 2.6 cm cap height in a 50 cm panel instead of 4 cm in 45 cm, because "Regularity 100%" would not fit on one line at 4 cm. Both are Inspector inputs.
- An early-end round's duration runs from the first to the last compression, so the 3 idle seconds do not count.

## Tests

Six LEAF scenarios cover the five done criteria of the brief. All six pass in the Lens Studio preview.

| Done criterion | Scenario | Input used |
|---|---|---|
| 1. Fading: ten on-pace compressions fade the guidance, a slowdown brings it back, recovery fades it again | `c1-fading` | Controller API (frame-accurate timing) |
| 2. Target lock: an off-target torso pinch counts and the target stays put; a pinch outside the torso does nothing | `c2-target-lock` | Real SIK pinches plus API |
| 3. Early end: 3 s idle gives the end pulse, "Round complete", then the summary | `c3-early-end` | Controller API |
| 3. Summary out of view while looking at the hands | `c3-summary-view-geometry` | Geometry only, from an assumed kneeling viewpoint |
| 4. Faithful summary: a steady 545 ms series gives 110 per minute and 100%; an irregular series lowers regularity | `c4-faithful-summary` | Controller API |
| 5. Again keeps the target and adds a "Last round" line; Move target lets the next pinch place the target elsewhere | `c5-again-move-target` | Real SIK pinches on the buttons plus API |

Not covered by any test: that the sounds actually play and come from the chest; the look of the brackets (checked as state, not as pixels); the readability of the summary from the real preview camera; the 2 minute timed end; the "Slower" cue.

## Honest limits of the preview

- **The compression input is a stand-in.** In the preview, each pinch (a mouse click) on the target is one compression. Nobody pinches during real CPR, and clicking twice a second is not CPR. Real compression detection from hand motion on device is not built or claimed.
- **The manikin is a stand-in.** A 60 x 35 x 20 cm placeholder torso lies on the preview floor. The Lens never recognizes a manikin; on device the user places the target with a pinch, and the placeholder is hidden.
- **No spoken words yet.** Snap's account service was down during the build, so the cues are five locally synthesized tones (click, two rising notes for "Faster", two falling notes for "Slower", an end chime, a "Round complete" chime). Each cue has its own play function, so recorded speech can replace the tones without code changes.
- **Logic proven, feel unproven.** The tests and the preview prove the logic. Comfort at about 50 cm from the eyes over a full round, real hand tracking with interlaced fingers, and how it feels on real glasses can only be judged on SPECS hardware, which I did not have.

## Try it

1. Open `keep-pace.esproj` in Lens Studio 5.22 or later (built with 5.24.1).
2. In the Preview panel, switch to Interactive Preview. WASD moves, Q and E go down and up, right-drag looks around. A click is a pinch.
3. Read the reminder, then press Q to kneel and click the center of the placeholder chest to place the target.
4. Click the target about twice a second. Hold the pace and watch the brackets fade; slow down and they come back.
5. Stop for 3 seconds, look up at the summary, then choose Again or Move target.
6. To run the tests: open the LEAF panel, then run the scenarios listed above.

## What's next

- On-device compression detection from hand motion, through the existing compression event interface.
- A hands-on-target check that is reliable with interlaced fingers.
- Memory across sessions, so the guidance can fade across practice days.
- A shared trainer mode where an instructor sees each trainee's rhythm.
- Recorded spoken cues instead of tones.

## Built with

Lens Studio 5.24.1 (SPECS Base Template), Spectacles Interaction Kit, Spectacles UI Kit, LEAF, CLAD (`ls-clad`) and the Lens Studio MCP, driven from Claude Code. Icons from Material Symbols (Google, Apache License 2.0), added through Lens Studio's icon selector. No pre-existing code of my own was used.

## Sources

1. Chen X, Zou Z, Wen X, Li L, Liang Y. The Role of Bystander Cardiopulmonary Resuscitation: A Meta-Analysis. Emerg Med Int. 2025;2025:5591055. doi:10.1155/emmi/5591055. https://pmc.ncbi.nlm.nih.gov/articles/PMC12317805/
2. Swor R, Khan I, Domeier R, et al. CPR training and CPR performance: do CPR-trained bystanders perform CPR? Acad Emerg Med. 2006;13(6):596-601. Figures as summarized by JEMS: https://www.jems.com/patient-care/cardiac-resuscitation/fear-cpr-trained-bystanders/
3. Kleinman ME et al. Part 7: Adult Basic Life Support. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025;152(suppl 2):S448-S478. doi:10.1161/CIR.0000000000001369. https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/adult-basic-life-support
4. Part 12: Resuscitation Education Science. 2025 American Heart Association Guidelines for CPR and ECC. Circulation. 2025. https://professional.heart.org/en/guidelines-statements/part-12-resuscitation-education-science-2025-american-heart-associationcir0000000000001374
5. Smyth MA et al. European Resuscitation Council Guidelines 2025 Adult Basic Life Support. Resuscitation. 2025;215(Suppl 1):110771. doi:10.1016/j.resuscitation.2025.110771. Values read via the Resuscitation Council UK 2025 Adult BLS page: https://www.resus.org.uk/professional-library/2025-resuscitation-guidelines/adult-basic-life-support-guidelines

6. American Heart Association. Nation of Lifesavers. https://www.heart.org/nation-of-lifesavers
7. American Heart Association. World Restart a Heart Day. https://www.heart.org/en/volunteer/world-restart-a-heart-day
8. International Liaison Committee on Resuscitation (ILCOR) and SaveMiHeart. Importance of Bystander CPR for Survival Highlighted On World Restart A Heart Day (press release). https://www.ilcor.org/data/SaveMiHeart.pdf

No ERC 2025 statement on a compressor switch interval could be found (the Resuscitation Council UK 2025 guideline that cites it gives none, and the full ERC chapter could not be read), so the 2 minute round cites AHA only.

## License

MIT. See [LICENSE](LICENSE).
