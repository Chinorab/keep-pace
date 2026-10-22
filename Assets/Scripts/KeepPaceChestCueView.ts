/**
 * KeepPaceChestCueView: everything drawn on the chest: target marker, placement
 * preview, and the two rhythm brackets (breathing, thickening, end pulse).
 *
 * Owns: meshes (code-authored, KeepPaceMeshes) and per-visual material clones of
 * `cueMaterial`, plus their transforms and opacity. Passive view: the controller
 * pushes target position, styles and bracket state every frame.
 * Expects (@input): ChestTarget root, TargetRing, TargetDot, PlacementPreview,
 * RhythmBrackets group, BracketLeft, BracketRight (authored SceneObjects with
 * RenderMeshVisual), and the unlit cue material.
 * Must not: read input, keep session state, or draw text near the hands.
 */
import {buildBarMesh, buildDiscMesh, buildRingMesh} from "./KeepPaceMeshes"

export type TargetStyle = "Hidden" | "Idle" | "Quiet" | "Unlocked"

@component
export class KeepPaceChestCueView extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">KeepPaceChestCueView: target marker and rhythm brackets</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("ChestTarget root: moved to the placed target position (marker, brackets, audio follow it)")
  chestTarget: SceneObject
  @input
  @hint("Ring of the target marker (RenderMeshVisual)")
  targetRing: SceneObject
  @input
  @hint("Center dot of the target marker (RenderMeshVisual)")
  targetDot: SceneObject
  @input
  @hint("Ghost ring shown under the pointer where a pinch would place the target")
  placementPreview: SceneObject
  @input
  @hint("Group holding both brackets, centered on the target")
  rhythmBrackets: SceneObject
  @input
  @hint("Left rhythm bracket (RenderMeshVisual)")
  bracketLeft: SceneObject
  @input
  @hint("Right rhythm bracket (RenderMeshVisual)")
  bracketRight: SceneObject
  @input
  @hint("Unlit material cloned for every chest visual (light color, alpha blended)")
  cueMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Brackets</span>')
  @ui.group_start("Brackets")
  @input
  @hint("Bracket length along the chest depth, cm (brief: about 12)")
  @widget(new SliderWidget(4, 20, 0.5))
  bracketLengthCm: number = 12
  @input
  @hint("Bracket stroke, cm (brief: 1)")
  @widget(new SliderWidget(0.3, 3, 0.1))
  bracketStrokeCm: number = 1
  @input
  @hint("Distance from target center on push, cm (brief: about 7, keeps 2 cm from 10 cm wide hands)")
  @widget(new SliderWidget(5, 15, 0.5))
  pushOffsetCm: number = 7
  @input
  @hint("Distance from target center on release, cm (brief: about 9)")
  @widget(new SliderWidget(5, 15, 0.5))
  releaseOffsetCm: number = 9
  @input
  @hint("Stroke multiplier while a correction is given (shape change, not color only)")
  @widget(new SliderWidget(1, 4, 0.1))
  thickenFactor: number = 2.2
  @input
  @hint("Distance reached by the slow end pulse, cm")
  @widget(new SliderWidget(9, 25, 0.5))
  endPulseOffsetCm: number = 14
  @input
  @hint("Bracket opacity at full guidance (thin and low opacity)")
  @widget(new SliderWidget(0.1, 1, 0.05))
  bracketMaxOpacity: number = 0.6
  @input("vec3", "{1,1,1}")
  @hint("Bracket and marker color. Keep it light: the display is additive")
  @widget(new ColorWidget())
  cueColor: vec3
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Target marker</span>')
  @ui.group_start("Target marker")
  @input
  @hint("Marker diameter, cm (brief: about 6)")
  @widget(new SliderWidget(3, 12, 0.5))
  targetDiameterCm: number = 6
  @input
  @hint("Marker opacity before the first compression")
  @widget(new SliderWidget(0.1, 1, 0.05))
  idleOpacity: number = 0.85
  @input
  @hint("Marker opacity during a round and on the summary (quiet)")
  @widget(new SliderWidget(0.05, 1, 0.05))
  quietOpacity: number = 0.3
  @ui.group_end

  private ringMat: Material
  private dotMat: Material
  private previewMat: Material
  private leftMat: Material
  private rightMat: Material
  private style: TargetStyle = "Hidden"
  private hovered = false

  onAwake(): void {
    if (!this.chestTarget || !this.bracketLeft || !this.bracketRight || !this.cueMaterial) {
      print("[KeepPaceChestCueView] ERROR: references not wired")
      return
    }
    const r = this.targetDiameterCm / 2
    this.ringMat = this.setupVisual(this.targetRing, buildRingMesh(r * 0.78, r))
    this.dotMat = this.setupVisual(this.targetDot, buildDiscMesh(r * 0.22))
    this.previewMat = this.setupVisual(this.placementPreview, buildRingMesh(r * 0.78, r))
    const bar = buildBarMesh(this.bracketStrokeCm, this.bracketLengthCm)
    this.leftMat = this.setupVisual(this.bracketLeft, bar)
    this.rightMat = this.setupVisual(this.bracketRight, bar)
    this.setTargetStyle("Hidden")
    this.setPlacementPreview(null)
    this.setBrackets(false, 0, 0, false)
  }

  private setupVisual(so: SceneObject, mesh: RenderMesh): Material {
    let rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    if (!rmv) rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    const mat = this.cueMaterial.clone()
    mat.mainPass.twoSided = true
    mat.mainPass.depthWrite = false
    mat.mainPass.blendMode = BlendMode.Normal
    rmv.mainMaterial = mat
    return mat
  }

  private setColor(mat: Material, opacity: number): void {
    const c = this.cueColor ?? new vec3(1, 1, 1)
    mat.mainPass.baseColor = new vec4(c.x, c.y, c.z, Math.max(0, Math.min(1, opacity)))
  }

  // ── Target marker ─────────────────────────────────

  /** Moves the target (and everything parented under it) to a world position on the chest. */
  setTargetPosition(worldPos: vec3): void {
    this.chestTarget.getTransform().setWorldPosition(worldPos)
  }

  getTargetPosition(): vec3 {
    return this.chestTarget.getTransform().getWorldPosition()
  }

  setTargetStyle(style: TargetStyle): void {
    this.style = style
    this.refreshTarget()
  }

  setTargetHovered(hovered: boolean): void {
    this.hovered = hovered
    this.refreshTarget()
  }

  private refreshTarget(): void {
    const visible = this.style !== "Hidden"
    this.targetRing.enabled = visible
    this.targetDot.enabled = visible && this.style !== "Unlocked"
    if (!visible) return
    let opacity = this.style === "Idle" ? this.idleOpacity : this.quietOpacity
    if (this.style === "Unlocked") opacity = this.quietOpacity * 0.7
    if (this.hovered && this.style !== "Unlocked") opacity = Math.min(1, opacity + 0.35)
    this.setColor(this.ringMat, opacity)
    this.setColor(this.dotMat, opacity)
    const s = this.hovered && this.style !== "Unlocked" ? 1.2 : 1
    this.targetRing.getTransform().setLocalScale(new vec3(s, 1, s))
  }

  /** Ghost ring under the pointer where a pinch would place the target; null hides it. */
  setPlacementPreview(worldPos: vec3 | null): void {
    if (!this.placementPreview) return
    if (!worldPos) {
      this.placementPreview.enabled = false
      return
    }
    this.placementPreview.enabled = true
    this.placementPreview.getTransform().setWorldPosition(worldPos)
    this.setColor(this.previewMat, 0.45)
  }

  // ── Brackets ──────────────────────────────────────

  /**
   * Bracket state for one frame.
   * @param metronomePhase 0..1 within the beat: 0 = push (inner), 0.5 = release (outer)
   */
  setBrackets(visible: boolean, opacity01: number, metronomePhase: number, thickened: boolean): void {
    this.rhythmBrackets.enabled = visible && opacity01 > 0.001
    if (!this.rhythmBrackets.enabled) return
    const mid = (this.pushOffsetCm + this.releaseOffsetCm) / 2
    const amp = (this.releaseOffsetCm - this.pushOffsetCm) / 2
    const offset = mid - amp * Math.cos(metronomePhase * Math.PI * 2)
    this.layoutBrackets(offset, thickened ? this.thickenFactor : 1, opacity01 * this.bracketMaxOpacity)
  }

  /** End of round: one slow expansion and fade (progress 0..1). */
  setEndPulse(progress01: number): void {
    const p = Math.max(0, Math.min(1, progress01))
    const eased = 1 - (1 - p) * (1 - p)
    const offset = this.releaseOffsetCm + (this.endPulseOffsetCm - this.releaseOffsetCm) * eased
    const opacity = (1 - p) * this.bracketMaxOpacity
    this.rhythmBrackets.enabled = opacity > 0.001
    if (!this.rhythmBrackets.enabled) return
    this.layoutBrackets(offset, 1, opacity)
  }

  private layoutBrackets(offsetCm: number, strokeScale: number, opacity: number): void {
    this.bracketLeft.getTransform().setLocalPosition(new vec3(-offsetCm, 0, 0))
    this.bracketRight.getTransform().setLocalPosition(new vec3(offsetCm, 0, 0))
    const scale = new vec3(strokeScale, 1, 1)
    this.bracketLeft.getTransform().setLocalScale(scale)
    this.bracketRight.getTransform().setLocalScale(scale)
    this.setColor(this.leftMat, opacity)
    this.setColor(this.rightMat, opacity)
  }
}
