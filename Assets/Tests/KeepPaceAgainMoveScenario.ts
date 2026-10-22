/**
 * Done criterion 5 (Again and Move target).
 *
 * Real SIK input: "AgainButton" and "MoveTargetButton" (UIKit Buttons on the summary panel)
 * are triggered with a DefaultLeafInteractor; one compression of round 2 is a SIK trigger
 * on the "ChestTarget" Interactable.
 * Controller API: the other compressions (registerCompression) and the placement pinch
 * after Move target (pinchOnChest, to choose a spot clearly away from the old target).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObject, matchSceneObjectName, matchSceneObjectParentName, sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {KeepPaceController} from "../Scripts/KeepPaceController"
import {chestPoint, ctl, distCm, fmt, log, Pacer, reachReady, waitForSummary} from "./KeepPaceTestUtils"

function lineText(line: string, child: string): string {
  const so = findSceneObject(
    (o: SceneObject) => matchSceneObjectName(child)(o) && matchSceneObjectParentName(line)(o),
  )
  if (!so) throw new Error("Summary text " + line + "/" + child + " not found")
  return (so.getComponent("Component.Text") as Text).text
}

async function shortRound(c: KeepPaceController, n: number): Promise<void> {
  const p = new Pacer(c)
  p.start()
  for (let i = 1; i < n; i++) await p.after(545)
}

@component
export class KeepPaceAgainMoveScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(500)
    const c = ctl()
    const interactor = new DefaultLeafInteractor("KeepPaceTestInteractor")

    // ── Round 1 to a summary ──
    await reachReady(c)
    await shortRound(c, 6)
    await waitForSummary(c)
    expect(c.summaryVisible).toBe(true)
    const r1 = c.roundIndex
    const reg1 = c.regularityPct
    const target1 = c.targetWorldPosition
    log("round " + r1 + " summary: regularity " + reg1 + "%, target " + fmt(target1))

    // ── Again (real SIK trigger on the UIKit button) ──
    const again = findInteractableByName("AgainButton", undefined, true)
    expect(again !== undefined, "AgainButton Interactable enabled on the summary").toBe(true)
    await withTimeout(interactor.trigger(again), 4000, "SIK trigger on AgainButton timed out")
    await sleep(100)
    log("after Again: " + c.getStateJson())
    expect(c.phase, "Again starts a new round setup").toBe("Ready")
    expect(c.summaryVisible, "summary hidden after Again").toBe(false)
    expect(c.targetLocked, "same target, still locked").toBe(true)
    expect(distCm(c.targetWorldPosition, target1), "target unchanged (cm)").toBeLessThan(0.01)

    // ── Round 2: first compression through SIK on the ChestTarget, then API ──
    const chestTarget = findInteractableByName("ChestTarget", undefined, true)
    expect(chestTarget !== undefined, "ChestTarget Interactable").toBe(true)
    await withTimeout(interactor.trigger(chestTarget), 4000, "SIK trigger on ChestTarget timed out")
    expect(c.lastPinchResult).toBe("Compression")
    expect(c.roundIndex, "new round started").toBe(r1 + 1)
    expect(c.compressionCount).toBe(1)
    const p = new Pacer(c)
    p.start()
    for (let i = 0; i < 4; i++) await p.after(545)
    await waitForSummary(c)
    await sleep(100)
    const want = "Last round " + reg1 + "%"
    const label = lineText("LastRoundLine", "Label")
    const value = lineText("LastRoundLine", "Value")
    log("round " + c.roundIndex + " summary: comparison '" + c.comparisonText + "', panel line '" + label + "' '" + value +
      "', previousRegularityPct " + c.previousRegularityPct)
    expect(c.summaryVisible).toBe(true)
    expect(c.roundIndex).toBe(r1 + 1)
    expect(c.comparisonText, "comparison line on round 2").toBe(want)
    expect(c.previousRegularityPct).toBe(reg1)
    expect(label, "panel comparison label").toBe("Last round")
    expect(value, "panel comparison value").toBe(reg1 + "%")
    expect(distCm(c.targetWorldPosition, target1), "round 2 on the same target (cm)").toBeLessThan(0.01)

    // ── Move target (real SIK trigger on the UIKit button) ──
    const move = findInteractableByName("MoveTargetButton", undefined, true)
    expect(move !== undefined, "MoveTargetButton Interactable enabled on the summary").toBe(true)
    await withTimeout(interactor.trigger(move), 4000, "SIK trigger on MoveTargetButton timed out")
    await sleep(100)
    log("after Move target: " + c.getStateJson())
    expect(c.phase, "Move target waits for a placement pinch").toBe("AwaitingTarget")
    expect(c.targetLocked, "target unlocked").toBe(false)
    expect(c.summaryVisible, "summary hidden after Move target").toBe(false)

    // Next pinch on the torso places the target elsewhere (choose a spot 12 cm or more away).
    const old = c.targetWorldPosition
    let x = 15
    if (distCm(chestPoint(c, x, 6), old) < 12) x = -15
    const res = c.pinchOnChest(x, 6)
    log("placement pinch at offset (" + x + ", 6) -> " + res + ", new target " + fmt(c.targetWorldPosition))
    expect(res, "next pinch places the target").toBe("PlacedTarget")
    expect(c.phase).toBe("Ready")
    expect(c.targetPlaced).toBe(true)
    expect(c.targetLocked, "not locked until the first compression").toBe(false)
    expect(distCm(c.targetWorldPosition, old), "target moved (cm)").toBeGreaterThan(10)
    expect(distCm(c.targetWorldPosition, chestPoint(c, x, 6)), "target at the pinch point (cm)").toBeLessThan(0.5)

    // Before the first compression, another torso pinch still moves it.
    const placed = c.targetWorldPosition
    expect(c.pinchOnChest(-x, -6), "pinch away before the first compression moves the target").toBe("MovedTarget")
    expect(distCm(c.targetWorldPosition, placed), "target moved again (cm)").toBeGreaterThan(10)
    log("PASS again and move target")
  }
}
