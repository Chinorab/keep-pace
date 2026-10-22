/**
 * Done criterion 3 (Early end), driven through the controller test API.
 *
 * Sequence: a short on-pace round, then no compression. The round must still be running
 * at 2.5 s; after 3 s idle the end pulse starts (phase Ending, end tone), "Round complete"
 * follows about 1 s later, then the summary becomes visible (about 1 s after the pulse).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {ctl, log, nowMs, Pacer, reachReady, waitUntilTime} from "./KeepPaceTestUtils"

@component
export class KeepPaceEarlyEndScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(500)
    const c = ctl()
    await reachReady(c)
    const p = new Pacer(c)
    p.start()
    for (let i = 0; i < 5; i++) await p.after(545)
    const lastMs = p.lastTimeMs
    const round = c.roundIndex

    // Still running before the 3 s threshold.
    await waitUntilTime(lastMs + 2500)
    expect(c.phase, "round must still run 2.5 s after the last compression").toBe("Running")
    expect(c.summaryVisible).toBe(false)

    // Observe the end sequence frame by frame.
    let endingAt = -1
    let endToneAt = -1
    let roundCompleteAt = -1
    let summaryAt = -1
    let midPulseSeen = false
    let bracketsVisibleInEnding = false
    let summaryVisibleBeforeRoundComplete = false
    const deadline = lastMs + 9000
    while (summaryAt < 0 && nowMs() < deadline) {
      await nextFrame()
      const t = nowMs()
      if (endingAt < 0 && (c.phase === "Ending" || c.phase === "Summary")) endingAt = t
      if (c.phase === "Ending") {
        if (c.endPulseProgress > 0.05 && c.endPulseProgress < 0.95) midPulseSeen = true
        if (c.bracketsVisible) bracketsVisibleInEnding = true
      }
      const fresh = c.lastCueTimeSec * 1000 > lastMs // lastCue carries over from earlier rounds
      if (endToneAt < 0 && fresh && c.lastCue === "EndTone") endToneAt = c.lastCueTimeSec * 1000
      if (roundCompleteAt < 0 && fresh && c.lastCue === "RoundComplete") roundCompleteAt = c.lastCueTimeSec * 1000
      if (summaryAt < 0 && c.summaryVisible) {
        summaryAt = t
        if (roundCompleteAt < 0) summaryVisibleBeforeRoundComplete = true
      }
    }
    const rel = (x: number) => (x < 0 ? "never" : ((x - lastMs) / 1000).toFixed(3) + " s")
    log("end sequence after last compression: ending " + rel(endingAt) + ", end tone " + rel(endToneAt) +
      ", round complete " + rel(roundCompleteAt) + ", summary " + rel(summaryAt) + ", state " + c.getStateJson())

    expect(endingAt, "end pulse never started").toBeGreaterThan(0)
    const idleSec = (endingAt - lastMs) / 1000
    expect(idleSec, "end must not start before 3 s idle").toBeGreaterThan(2.99)
    expect(idleSec, "end should start right after 3 s idle").toBeLessThan(3.3)
    expect(midPulseSeen, "end pulse animates (progress seen between 0 and 1)").toBe(true)
    expect(bracketsVisibleInEnding, "brackets visible during the end pulse").toBe(true)
    expect(endToneAt, "end tone cue").toBeGreaterThan(0)
    expect(roundCompleteAt, "Round complete cue").toBeGreaterThan(0)
    expect(roundCompleteAt - endToneAt, "Round complete comes after the end tone (ms)").toBeGreaterThan(900)
    expect(roundCompleteAt - endToneAt, "Round complete right after the 1 s end tone (ms)").toBeLessThan(1300)
    expect(summaryVisibleBeforeRoundComplete, "summary must not show before Round complete").toBe(false)
    expect(summaryAt, "summary never became visible").toBeGreaterThan(0)
    expect(summaryAt - roundCompleteAt, "summary after Round complete (ms)").toBeGreaterThan(0)
    expect((summaryAt - endingAt) / 1000, "summary about 1 s after the 1 s pulse (s)").toBeGreaterThan(1.9)
    expect((summaryAt - endingAt) / 1000, "summary about 1 s after the 1 s pulse (s)").toBeLessThan(2.4)
    expect(c.phase).toBe("Summary")
    expect(c.endReason).toBe("Idle")
    expect(c.roundIndex).toBe(round)
    expect(c.bracketsVisible, "nothing left on the chest but the target").toBe(false)
    log("PASS early end")
  }
}
