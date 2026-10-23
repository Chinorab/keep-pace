# Keep Pace: Devpost submission form answers

Draft answers for the Learn AR with SPECS submission form (fields as listed by Devpost on 2026-10-23). Fields marked **YOUR CHOICE** are personal answers: pick them yourself. Facts that may help are noted under each one.

Deadline: November 9, 2026, 5:00 pm ET.

## Eligibility and identity

- **Submitter Type:** YOUR CHOICE (Individual / Team / Organization).
- **Organization name:** leave empty unless you submit for an organization.
- **Submitter Country of Residence:** YOUR CHOICE.
- **Age of majority / Eligible jurisdiction / Not a Sponsor or Devpost employee:** three checkboxes to tick yourself after reading the Official Rules.

## Public code repository

https://github.com/Chinorab/keep-pace

## Explain how your project meets the main technology requirement

Keep Pace was planned with the Devpost Learn skill pack and built with CLAD in Lens Studio, through the Lens Studio MCP.

- **Devpost Learn skill pack (plan-lens):** ran the planning interview. It challenged the concept against AR design habits and the limits of the Lens Studio preview, which led me to drop an emergency mode, replace a ring with two brackets after a field of view check, and define five done criteria that can be checked in the preview. It wrote the approved brief in `devpost/design-brief.md`.
- **CLAD (`ls-clad` plugin):** built the Lens from that brief. Its SPECS experience builder planned the scene, wrote the TypeScript scripts (a pure session logic module, a controller with a test API, input, chest cues, audio and the two UI panels) and set up the scene. Its live Lens tester wrote and ran the LEAF scenarios.
- **Lens Studio MCP:** the bridge CLAD used to read and change the open Lens Studio project: scene edits, script compilation, package installs, preview runs and logs.
- **Lens Studio 5.24.1 (SPECS Base Template):** the project, the Interactive Preview where the Lens runs and is demonstrated, and the editor the agent drove.
- **Spectacles Interaction Kit:** the pinch input on the placeholder torso, the chest target and the buttons, driven by the mouse in the preview.
- **Spectacles UI Kit:** the reminder panel and the round summary with its Again and Move target buttons.
- **LEAF:** six test scenarios that cover the five done criteria of the brief. All six pass in the preview, two of them with real SIK pinches.

## Link to a social post (optional)

Leave empty, or add a link if you post about the project. It does not affect judging.

## Had you used Lens Studio before this hackathon?

YOUR CHOICE. Fact: Lens Studio was not installed on this computer when the project started (2026-10-21).

## Did CLAD build what your design brief described?

YOUR CHOICE. Facts: the whole flow was built in one pass and all six LEAF scenarios passed. CLAD made two adjustments: the placeholder torso sits on the preview floor about 150 cm below the camera instead of 110 cm (the user presses Q to kneel), and the summary text is 2.6 cm tall instead of 4 cm so the longest line fits. Spoken cues are tones, because the Snap account service was down. This fits "Yes, on the first try" or "Mostly, after a few fixes", depending on how you count those adjustments.

## Which step took the most time for what you got out of it?

YOUR CHOICE. Facts: setup took the first evening (installing Lens Studio, creating the SPECS project, installing CLAD, getting the MCP to load); the build was paused overnight because of the Snap account outage.

## Did the cost of AI affect what you did?

YOUR CHOICE.

## Where did you get stuck, or nearly quit?

1. **Sign-in check blocked the build.** After the planning step, CLAD's router refused to start the build because Lens Studio reported me as not signed in. I was signed in: my avatar was visible and Asset Library search worked, yet `Editor.IAuthorization.isAuthorized` read `false` through `ExecuteEditorCode`. I had to tell the agent to go ahead anyway. Around the same time Snap's account service had an outage, so the build was paused for the night and cloud generation (spoken voice clips) was unavailable. The Lens ships with locally synthesized tones instead of spoken cues.
2. **The MCP only loads in the project folder.** My first agent session was opened in a parent folder, so the `lens-studio` MCP from the project's `.mcp.json` never loaded, and nothing said why. I had to start a new session inside the project folder.
3. **Losing the MCP connection.** When Lens Studio was closed and reopened, the agent's `lens-studio` MCP stayed disconnected, and only a manual reconnect from the agent's MCP menu could fix it. A visual check of the preview was blocked until then.
4. **Preview camera height.** The preview floor is about 150 cm below the start camera and a Lens cannot set that height, so a kneeling task (CPR on a manikin) needs the user to press Q to get down to the chest.

## If Snap could fix one thing in CLAD or Lens Studio, what would it be?

Make the sign-in state reliable and visible to the agent. When `isAuthorized` disagrees with what the editor shows, CLAD refuses to build and the user has no way to tell which side is wrong. A clear status (signed in to which account, SPECS or Snapchat, and whether the account service is reachable) and a way to continue with local only features when cloud services are down would have saved me a night.

## How likely are you to use Specs and Lens Studio again?

YOUR CHOICE.

## How much did this hackathon help you develop new skills or knowledge?

YOUR CHOICE.

## Did this change what you think makes a good AR app?

YOUR CHOICE. The description and the video already state what changed: put the information on the thing it is about, size it to the narrow view, and let it disappear when it is no longer needed.
