# Keep Pace: Devpost description

**Tagline:** A CPR practice coach for SPECS that puts the rhythm on the manikin's chest, then gets out of the way.

## Inspiration
Bystander CPR is linked to higher survival, yet many people who took a course or watched a video still would not act. In a study of trained bystanders who did not perform CPR, panic was the most common reason given. The missing piece is practice: enough repetitions on a manikin that the rhythm becomes automatic.

## What it does
Keep Pace is a Hands-Only CPR training coach used on a CPR manikin. It is a practice tool, not an emergency tool, and it says so on its first screen.

- A short reminder of the real order (Call, Push, Shock) and a disclaimer, placed ahead of you before you kneel.
- One pinch on the chest places a target. Two thin brackets beside your hands breathe at 110 per minute, with a soft click.
- After ten compressions in the recommended 100 to 120 per minute range, the brackets fade, then the click stops. You hold the pace alone.
- When you drift, the guidance comes back at once, with a short "Faster" or "Slower" cue and thicker brackets. When you recover, it fades again.
- After 2 minutes, or 3 seconds without a compression, the round ends with a pulse and a tone telling you to look up. A summary waits beyond the manikin: time, rate, regularity, and from round two a comparison with the last round. Then Again or Move target.

## Why glasses
During practice your hands are on the chest and your eyes are on your hands. A phone or video sits elsewhere. The glasses put the cue where you already look, then take it away.

## How we built it
I planned the Lens with the Devpost Learn skill pack: an interview that produced an approved design brief, including three rules (information lives on the chest; silent when all is well; one word at most, never near the hands) and five testable done criteria. CLAD built it in Lens Studio 5.24.1 through the Lens Studio MCP with Spectacles Interaction Kit and UI Kit. The cadence logic is a pure module that only consumes a target position and a stream of compression events, so a real compression source can replace the stand-in later. Six LEAF scenarios cover the five done criteria, and all six pass in the preview. Medical values come only from the 2025 AHA and ERC guidelines, with sources in the README.

## Challenges
- A ring around the hands plus a word beyond it did not fit the view at 50 cm from the eyes, so the cue became two brackets on the wider horizontal axis.
- There is no honest way to detect real compressions in the preview, so each pinch on the target stands in for one compression. The video says so.
- Snap's account service was down during the build, so the spoken cues are synthesized tones for now.

## Accomplishments
- Guidance that fades while you hold the rhythm and comes back the moment you drift, all in one continuous round.
- Every behavior in the brief is covered by a passing LEAF test, two of them driven by real SIK pinches.

## What we learned
On glasses, less is the feature: the best moment is when the Lens shows nothing because you no longer need it.

## What's next
Compression detection from hand motion on device, a reliable hands-on-target check, memory across practice sessions, a shared trainer mode, and recorded spoken cues.

**Built with:** Lens Studio, SPECS, Spectacles Interaction Kit, Spectacles UI Kit, LEAF, CLAD, Lens Studio MCP, TypeScript.
