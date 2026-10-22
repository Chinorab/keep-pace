/**
 * Done criterion 1 (Fading), driven through the controller test API (registerCompression,
 * the same code path as a SIK pinch on the ChestTarget).
 *
 * About ten on-pace compressions (545 ms) make the brackets fade, then the click lowers
 * and stops; a slowdown (760 ms) brings both back on that very compression, with the
 * "Faster" cue and thickened brackets (cadence reliable); recovery fades them again.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {KeepPaceController} from "../Scripts/KeepPaceController"
import {ctl, log, Pacer, reachReady} from "./KeepPaceTestUtils"

const ON_PACE_MS = 545
const SLOW_MS = 760

/** Compresses on pace until guidance reaches `level` (or `max` compressions). Returns the count used. */
async function compressUntilGuidance(c: KeepPaceController, p: Pacer, level: string, max: number): Promise<number> {
  let n = 0
  while (c.guidanceLevel !== level && n < max) {
    await p.after(ON_PACE_MS)
    n++
  }
  return n
}

@component
export class KeepPaceFadingScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(500)
    const c = ctl()
    await reachReady(c)
    const corrections0 = c.correctionCount
    const p = new Pacer(c)

    // ── A: on-pace series until the brackets start fading ──
    expect(p.start(), "first compression").toBe("Compression")
    expect(c.phase).toBe("Running")
    expect(c.guidanceLevel, "guidance at round start").toBe("Full")
    expect(c.bracketsOpacity, "brackets opacity at round start").toBe(1)
    expect(c.clickVolume, "click volume at round start").toBe(1)

    let fadeAt = -1
    let streakAtFade = -1
    let fullBeforeFade = true
    for (let i = 0; i < 20 && fadeAt < 0; i++) {
      await p.after(ON_PACE_MS)
      if (c.guidanceLevel === "Fading") {
        fadeAt = c.compressionCount
        streakAtFade = c.onPaceStreak
      } else if (c.guidanceLevel !== "Full") {
        fullBeforeFade = false
      }
    }
    log("A: intervals " + JSON.stringify(p.intervals) + ", fade at compression " + fadeAt + ", streak " + streakAtFade)
    expect(fadeAt, "brackets never started fading within 21 compressions").toBeGreaterThan(0)
    expect(streakAtFade, "fade must start exactly at 10 consecutive on-pace intervals").toBe(10)
    expect(fullBeforeFade, "guidance stayed Full before the streak reached 10").toBe(true)

    // Keep the pace: brackets fade out, then the click lowers over about 3 beats and stops.
    const toOff = await compressUntilGuidance(c, p, "Off", 10)
    log("A: guidance Off after " + toOff + " more compressions, state " + c.getStateJson())
    expect(c.guidanceLevel, "guidance should reach Off while on pace").toBe("Off")
    expect(c.bracketsOpacity, "brackets opacity when Off").toBe(0)
    expect(c.bracketsVisible, "brackets visible when Off").toBe(false)
    expect(c.clickVolume, "click volume when Off").toBe(0)
    expect(c.isDrifting).toBe(false)

    // ── B: slowdown: guidance back on the very first slow compression ──
    expect(await p.after(SLOW_MS)).toBe("Compression")
    log("B: first slow interval " + c.lastIntervalMs + " ms, avg3 " + c.recentAvgIntervalMs.toFixed(0) + ", state " + c.getStateJson())
    expect(c.isDrifting, "drift detected on the first slow compression").toBe(true)
    expect(c.guidanceLevel, "guidance back to Full immediately").toBe("Full")
    expect(c.bracketsOpacity, "brackets back at full opacity immediately").toBe(1)
    expect(c.bracketsVisible, "brackets visible immediately").toBe(true)
    expect(c.clickVolume, "click back at full volume immediately").toBe(1)
    expect(c.lastCue, "spoken correction for a slowdown").toBe("Faster")
    expect(c.correctionCount, "one correction spoken").toBe(corrections0 + 1)
    expect(c.bracketsThickened, "brackets thicken with the correction").toBe(true)

    await p.after(SLOW_MS)
    await p.after(SLOW_MS)
    expect(c.guidanceLevel, "guidance stays Full while slow").toBe("Full")
    expect(c.bracketsOpacity).toBe(1)
    expect(c.correctionCount, "no second correction within 5 s").toBe(corrections0 + 1)

    // ── C: recovery: fades again after another ten on-pace compressions ──
    const recIntervalsStart = p.intervals.length
    const toFading = await compressUntilGuidance(c, p, "Fading", 20)
    log("C: Fading after " + toFading + " recovery compressions, streak " + c.onPaceStreak)
    expect(c.guidanceLevel, "guidance fades again after recovery").toBe("Fading")
    expect(c.onPaceStreak).toBe(10)
    const toOff2 = await compressUntilGuidance(c, p, "Off", 10)
    log("C: Off after " + toOff2 + " more, recovery intervals " + JSON.stringify(p.intervals.slice(recIntervalsStart)))
    expect(c.guidanceLevel, "guidance Off again after recovery").toBe("Off")
    expect(c.bracketsOpacity).toBe(0)
    expect(c.clickVolume).toBe(0)
    expect(c.phase, "round still running").toBe("Running")
    log("PASS fading, total compressions " + c.compressionCount)
  }
}
