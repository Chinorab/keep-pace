/**
 * Done criterion 2 (Target lock).
 *
 * Real SIK input (DefaultLeafInteractor trigger on the SIK Interactables):
 *  - first compression = trigger on the "ChestTarget" Interactable,
 *  - torso pinch away from the target = trigger on the "Torso" Interactable (the LEAF
 *    interactor aims at the torso center, about 15 cm from the target placed at X -15 cm).
 * Controller API: target placement at a known spot (pinchOnChest), a second off-target
 * torso pinch (pinchOnChest), and pinches outside the torso (pinchAtWorld); SIK cannot
 * pinch outside every collider, since then no Interactable receives the trigger.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {chestPoint, ctl, distCm, fmt, log, reachUnlockedTargetAt} from "./KeepPaceTestUtils"

const TARGET_X = -15

@component
export class KeepPaceTargetLockScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(500)
    const c = ctl()
    const interactor = new DefaultLeafInteractor("KeepPaceTestInteractor")

    await reachUnlockedTargetAt(c, TARGET_X, 0)
    expect(c.phase, "known start state").toBe("Ready")
    expect(c.targetLocked, "target unlocked before the first compression").toBe(false)
    const target0 = c.targetWorldPosition
    log("target placed at " + fmt(target0))

    // â”€â”€ First compression: real SIK trigger on the ChestTarget â”€â”€
    const chestTarget = findInteractableByName("ChestTarget", undefined, true)
    expect(chestTarget !== undefined, "ChestTarget Interactable enabled once the target is placed").toBe(true)
    const pinch0 = c.pinchCount
    await withTimeout(interactor.trigger(chestTarget), 4000, "SIK trigger on ChestTarget timed out")
    log("SIK ChestTarget -> " + c.lastPinchResult + ", " + c.getStateJson())
    expect(c.pinchCount, "SIK pinch on ChestTarget reached the controller").toBe(pinch0 + 1)
    expect(c.lastPinchResult).toBe("Compression")
    expect(c.phase).toBe("Running")
    expect(c.targetLocked, "target locked after the first compression").toBe(true)
    expect(c.compressionCount).toBe(1)
    expect(c.bracketsVisible, "brackets show from the first compression").toBe(true)

    // â”€â”€ Pinch on the torso away from the target: real SIK trigger on the Torso â”€â”€
    await sleep(250)
    const torso = findInteractableByName("Torso", undefined, true)
    expect(torso !== undefined, "Torso Interactable").toBe(true)
    await withTimeout(interactor.trigger(torso), 4000, "SIK trigger on Torso timed out")
    log("SIK Torso -> " + c.lastPinchResult + ", count " + c.compressionCount + ", target " + fmt(c.targetWorldPosition))
    expect(c.pinchCount, "SIK pinch on Torso reached the controller").toBe(pinch0 + 2)
    expect(c.lastPinchResult, "torso pinch counts as a compression").toBe("Compression")
    expect(c.compressionCount).toBe(2)
    expect(distCm(c.targetWorldPosition, target0), "target must not move (cm)").toBeLessThan(0.01)
    expect(c.bracketsVisible).toBe(true)

    // â”€â”€ Another off-target torso pinch, at a known far spot (API) â”€â”€
    await sleep(300)
    const far = chestPoint(c, 20, 10)
    log("API pinch at " + fmt(far) + ", " + distCm(far, target0).toFixed(1) + " cm from target")
    expect(c.pinchOnChest(20, 10)).toBe("Compression")
    expect(c.compressionCount).toBe(3)
    expect(distCm(c.targetWorldPosition, target0), "target must not move (cm)").toBeLessThan(0.01)

    // â”€â”€ Pinches outside the torso do nothing (API) â”€â”€
    const count = c.compressionCount
    const center = c.getChestCenter()
    const above = center.add(new vec3(0, 40, 0))
    const beside = center.add(findSceneObjectTransformRight().uniformScale(60))
    expect(c.pinchAtWorld(above), "pinch 40 cm above the chest").toBe("IgnoredOutsideTorso")
    expect(c.pinchAtWorld(beside), "pinch 60 cm beside the chest").toBe("IgnoredOutsideTorso")
    await nextFrame()
    expect(c.compressionCount, "outside pinches are not compressions").toBe(count)
    expect(distCm(c.targetWorldPosition, target0), "target must not move (cm)").toBeLessThan(0.01)
    expect(c.targetLocked).toBe(true)
    expect(c.phase).toBe("Running")
    log("PASS target lock")
  }
}

function findSceneObjectTransformRight(): vec3 {
  return ctl().torsoInput.getTransform().right
}
