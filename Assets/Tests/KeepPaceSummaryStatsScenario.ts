/**
 * Done criterion 4 (Faithful summary), driven through the controller test API.
 *
 * Round A: 16 compressions at a steady 545 ms (110 per minute). The summary must report an
 * average cadence close to 110 (and equal to 60000 / mean of the measured intervals),
 * regularity close to 100%, and a duration matching the measured span.
 * Round B (after Again): a deliberately irregular series (3 of 15 intervals on pace, 20%).
 * Regularity must drop accordingly; the average must still match the measured intervals.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {KeepPaceController} from "../Scripts/KeepPaceController"
import {ctl, log, mean, Pacer, reachReady, waitForSummary} from "./KeepPaceTestUtils"

const STEADY_MS = 545
const IRREGULAR_MS = [420, 700, 450, 760, 545, 400, 720, 470, 690, 560, 430, 740, 450, 700, 550]

function onPaceShare(intervals: number[]): number {
  let n = 0
  for (const i of intervals) if (i >= 500 && i <= 600) n++
  return intervals.length > 0 ? (100 * n) / intervals.length : 0
}

async function playRound(c: KeepPaceController, intervals: number[]): Promise<Pacer> {
  const p = new Pacer(c)
  p.start()
  for (const ms of intervals) await p.after(ms)
  await waitForSummary(c)
  return p
}

@component
export class KeepPaceSummaryStatsScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(500)
    const c = ctl()

    // ── Round A: steady 545 ms ──
    await reachReady(c)
    const steady: number[] = []
    for (let i = 0; i < 15; i++) steady.push(STEADY_MS)
    const a = await playRound(c, steady)
    const aMean = mean(a.intervals)
    const aExpectedRate = Math.round(60000 / aMean)
    const aSpan = (a.lastTimeMs - a.firstTimeMs) / 1000
    log("A: measured intervals " + JSON.stringify(a.intervals) + ", mean " + aMean.toFixed(1) + " ms, rate " +
      c.avgCadencePerMin + ", regularity " + c.regularityPct + "%, duration " + c.durationSec.toFixed(2) +
      " s (span " + aSpan.toFixed(2) + " s), measured on-pace share " + onPaceShare(a.intervals).toFixed(0) + "%")
    expect(c.summaryVisible).toBe(true)
    expect(c.avgCadencePerMin, "average equals 60000 / mean measured interval").toBe(aExpectedRate)
    expect(Math.abs(c.avgCadencePerMin - 110), "average close to the paced 110 per min").toBeLessThan(4)
    expect(c.regularityPct, "steady series: regularity close to 100%").toBeGreaterThan(89)
    expect(Math.abs(c.durationSec - aSpan), "duration matches first to last compression (s)").toBeLessThan(0.1)
    const steadyRegularity = c.regularityPct

    // ── Round B: irregular series ──
    c.pressAgain()
    await sleep(100)
    expect(c.phase).toBe("Ready")
    const b = await playRound(c, IRREGULAR_MS)
    const bMean = mean(b.intervals)
    const bShare = onPaceShare(b.intervals)
    log("B: measured intervals " + JSON.stringify(b.intervals) + ", mean " + bMean.toFixed(1) + " ms, rate " +
      c.avgCadencePerMin + ", regularity " + c.regularityPct + "%, measured on-pace share " + bShare.toFixed(0) + "%")
    expect(c.avgCadencePerMin, "average equals 60000 / mean measured interval").toBe(Math.round(60000 / bMean))
    expect(c.regularityPct, "regularity equals the measured on-pace share").toBe(Math.round(bShare))
    expect(c.regularityPct, "irregular series: regularity clearly lower").toBeLessThan(41)
    expect(steadyRegularity - c.regularityPct, "drop versus the steady round (points)").toBeGreaterThan(49)
    log("PASS faithful summary")
  }
}
