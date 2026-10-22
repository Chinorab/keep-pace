/**
 * Done criterion 3, view part, as a geometry check (no input, reads world transforms).
 *
 * The real check is a walk in Interactive Preview. This scenario approximates it from a
 * kneeling viewpoint at the shoulder: eye 45 cm above and 20 cm toward the user from the
 * chest center (about 50 cm from the hands). It asserts that
 *  - looking at the chest, the summary panel is outside the preview camera's field of view
 *    (angular distance from the gaze minus the panel's angular radius > half diagonal FOV),
 *  - the summary is in front of the user, above the gaze, within a head tilt up of 45 deg,
 *  - the panel faces the user.
 * Readability (text size, contrast) is not asserted.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {ctl, fmt, log} from "./KeepPaceTestUtils"

const RAD = 180 / Math.PI
const PANEL_RADIUS_CM = 30 // half diagonal of a 50 x 30 cm panel, conservative

function angleDeg(a: vec3, b: vec3): number {
  const d = Math.max(-1, Math.min(1, a.normalize().dot(b.normalize())))
  return Math.acos(d) * RAD
}

@component
export class KeepPaceSummaryViewScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(300)
    const c = ctl()
    const chest = c.getChestCenter()
    const torsoT = findSceneObjectByName("Torso").getTransform()
    // "Toward the user": the side of the torso facing the preview camera start position.
    const camSo = findSceneObjectByName("Camera Object")
    const cam = camSo.getComponent("Component.Camera") as Camera
    const camPos = camSo.getTransform().getWorldPosition()
    const towardUser = new vec3(camPos.x - chest.x, 0, camPos.z - chest.z).normalize()
    const eye = chest.add(new vec3(0, 45, 0)).add(towardUser.uniformScale(20))

    const panelSo = findSceneObjectByName("SummaryPanel")
    const panelT = panelSo.getTransform()
    const panelPos = panelT.getWorldPosition()

    const toChest = chest.sub(eye)
    const toPanel = panelPos.sub(eye)
    const dist = toPanel.length
    const vHalf = cam.fov / 2
    const hHalf = Math.atan(Math.tan(vHalf) * cam.aspect)
    const diagHalfDeg = Math.atan(Math.sqrt(Math.tan(vHalf) ** 2 + Math.tan(hHalf) ** 2)) * RAD
    const centerAngle = angleDeg(toChest, toPanel)
    const panelRadiusDeg = Math.atan(PANEL_RADIUS_CM / dist) * RAD
    const edgeAngle = centerAngle - panelRadiusDeg

    const horizontal = new vec3(toPanel.x, 0, toPanel.z)
    const tiltUpDeg = Math.atan2(toPanel.y, horizontal.length) * RAD
    // UI content is readable from the panel's local +Z side.
    const panelFront = panelT.getWorldRotation().multiplyVec3(new vec3(0, 0, 1))
    const facing = panelFront.normalize().dot(eye.sub(panelPos).normalize())
    const inFront = horizontal.normalize().dot(new vec3(-towardUser.x, 0, -towardUser.z)) // away from the user side

    log("eye " + fmt(eye) + ", chest " + fmt(chest) + ", summary " + fmt(panelPos) + ", dist " + dist.toFixed(0) +
      " cm, cam vFOV " + (cam.fov * RAD).toFixed(1) + " deg, aspect " + cam.aspect.toFixed(2) +
      ", half diag FOV " + diagHalfDeg.toFixed(1) + ", gaze-to-panel " + centerAngle.toFixed(1) +
      ", panel edge " + edgeAngle.toFixed(1) + ", tilt up " + tiltUpDeg.toFixed(1) + ", facing " + facing.toFixed(2) +
      ", in front " + inFront.toFixed(2) + ", torso pos " + fmt(torsoT.getWorldPosition()))

    expect(edgeAngle, "summary must be out of view while looking at the hands (deg beyond half diag FOV)")
      .toBeGreaterThan(diagHalfDeg)
    expect(tiltUpDeg, "summary sits above the gaze line (look up)").toBeGreaterThan(0)
    expect(tiltUpDeg, "summary within a 45 deg head tilt up").toBeLessThan(45)
    expect(inFront, "summary in front of the user, beyond the manikin").toBeGreaterThan(0.7)
    expect(facing, "summary faces the user").toBeGreaterThan(0.7)
    log("PASS summary view geometry")
  }
}
