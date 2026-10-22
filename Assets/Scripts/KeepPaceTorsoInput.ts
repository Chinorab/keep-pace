/**
 * KeepPaceTorsoInput: the pinch stand-in input on the torso and the chest target.
 *
 * Owns: the Torso hit zone (box collider + SIK Interactable, generous: the whole torso),
 * the ChestTarget hit zone (box collider + SIK Interactable), hover tracking, the chest
 * plane geometry (top surface, clamping), and hiding the placeholder torso on device.
 * Emits raw pinch/hover events with world positions; it decides nothing about sessions.
 * Works with the mouse in Interactive Preview (SIK MouseInteractor), with hands on
 * device, and with LEAF (trigger on the "Torso" or "ChestTarget" Interactable).
 * Expects (@input): the placeholder visual child and the ChestTarget SceneObject.
 * Must not: count compressions, place the target, or play sounds (the controller does).
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractorEvent} from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

@component
export class KeepPaceTorsoInput extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">KeepPaceTorsoInput: pinch stand-in on the torso and target</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("PlaceholderTorso (preview stand-in) visual, hidden on device")
  placeholderVisual: SceneObject
  @input
  @hint("ChestTarget root (gets its own collider and Interactable)")
  chestTarget: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec3", "{60,20,35}")
  @hint("Torso size in cm: length (X) x height (Y) x width (Z). Brief default 60 x 20 x 35")
  torsoSizeCm: vec3
  @input
  @hint("Size of the target hit zone in cm (square, flat). Big on purpose")
  @widget(new SliderWidget(4, 20, 0.5))
  targetHitSizeCm: number = 10
  @input
  @hint("Hide the placeholder torso when running on Specs (keeps the hit zone)")
  hideStandInOnDevice: boolean = true
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Draw collider wireframes")
  debugColliders: boolean = false
  @ui.group_end

  private _onTorsoPinch = new Event<vec3>()
  private _onTargetPinch = new Event<void>()
  private _onTorsoHover = new Event<vec3 | null>()
  private _onTargetHover = new Event<boolean>()

  /** Pinch on the torso (not on the target). Payload: hit point in world space. */
  get onTorsoPinch(): PublicApi<vec3> {
    return this._onTorsoPinch.publicApi()
  }
  /** Pinch on the chest target. */
  get onTargetPinch(): PublicApi<void> {
    return this._onTargetPinch.publicApi()
  }
  /** Pointer over the torso (world point) or null when it leaves. */
  get onTorsoHover(): PublicApi<vec3 | null> {
    return this._onTorsoHover.publicApi()
  }
  /** Pointer over the target or not. */
  get onTargetHover(): PublicApi<boolean> {
    return this._onTargetHover.publicApi()
  }

  private torsoCollider: ColliderComponent
  private targetCollider: ColliderComponent
  private torsoInteractable: Interactable
  private targetInteractable: Interactable

  onAwake(): void {
    const size = this.torsoSizeCm ?? new vec3(60, 20, 35)
    this.torsoCollider = this.addBoxCollider(this.sceneObject, size)
    this.torsoInteractable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable

    if (this.chestTarget) {
      const s = this.targetHitSizeCm
      this.targetCollider = this.addBoxCollider(this.chestTarget, new vec3(s, 2, s))
      this.targetInteractable = this.chestTarget.createComponent(Interactable.getTypeName()) as Interactable
    }
    this.fitPlaceholder(size)
    this.setTargetInteractive(false)

    if (this.hideStandInOnDevice && this.placeholderVisual && !global.deviceInfoSystem.isEditor()) {
      this.placeholderVisual.enabled = false
    }

    this.createEvent("OnStartEvent").bind(() => this.bindInteractions())
  }

  private addBoxCollider(so: SceneObject, size: vec3): ColliderComponent {
    const col = so.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = size
    col.shape = shape
    col.fitVisual = false
    col.debugDrawEnabled = this.debugColliders
    return col
  }

  /** Scales the placeholder visual (a leaf child) so its mesh matches the torso size. */
  private fitPlaceholder(size: vec3): void {
    if (!this.placeholderVisual) return
    const rmv = this.placeholderVisual.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    if (!rmv || !rmv.mesh) return
    const ext = rmv.mesh.aabbMax.sub(rmv.mesh.aabbMin)
    if (ext.x <= 0 || ext.y <= 0 || ext.z <= 0) return
    this.placeholderVisual.getTransform().setLocalScale(new vec3(size.x / ext.x, size.y / ext.y, size.z / ext.z))
  }

  private bindInteractions(): void {
    this.torsoInteractable.onTriggerStart.add((e: InteractorEvent) => {
      if (e.target !== this.torsoInteractable) return
      this._onTorsoPinch.invoke(this.hitPoint(e) ?? this.chestCenter())
    })
    this.torsoInteractable.onHoverUpdate.add((e: InteractorEvent) => {
      const p = this.hitPoint(e)
      if (p) this._onTorsoHover.invoke(p)
    })
    this.torsoInteractable.onHoverExit.add(() => this._onTorsoHover.invoke(null))

    if (this.targetInteractable) {
      this.targetInteractable.onTriggerStart.add((e: InteractorEvent) => {
        if (e.target !== this.targetInteractable) return
        this._onTargetPinch.invoke()
      })
      this.targetInteractable.onHoverEnter.add(() => this._onTargetHover.invoke(true))
      this.targetInteractable.onHoverExit.add(() => this._onTargetHover.invoke(false))
    }
  }

  private hitPoint(e: InteractorEvent): vec3 | null {
    const info = e && e.interactor ? e.interactor.targetHitInfo : null
    return info && info.hit ? info.hit.position : null
  }

  /** Enables the target hit zone (off before placement and while the target is unlocked). */
  setTargetInteractive(on: boolean): void {
    if (this.targetCollider) this.targetCollider.enabled = on
    if (this.targetInteractable) this.targetInteractable.enabled = on
  }

  // ── Chest plane geometry (torso local space: X length, Y up, Z width) ──

  private get size(): vec3 {
    return this.torsoSizeCm ?? new vec3(60, 20, 35)
  }

  /** True when a world point lies inside the torso box (plus a small margin). */
  containsWorldPoint(p: vec3, marginCm: number = 0.5): boolean {
    const local = this.getTransform().getInvertedWorldTransform().multiplyPoint(p)
    const s = this.size
    return (
      Math.abs(local.x) <= s.x / 2 + marginCm &&
      Math.abs(local.y) <= s.y / 2 + marginCm &&
      Math.abs(local.z) <= s.z / 2 + marginCm
    )
  }

  /** Projects a world point onto the chest surface, kept inside the top face. */
  toChestSurface(p: vec3, liftCm: number = 0.3, edgeMarginCm: number = 3): vec3 {
    const local = this.getTransform().getInvertedWorldTransform().multiplyPoint(p)
    const s = this.size
    const hx = Math.max(0, s.x / 2 - edgeMarginCm)
    const hz = Math.max(0, s.z / 2 - edgeMarginCm)
    const clamped = new vec3(
      Math.max(-hx, Math.min(hx, local.x)),
      s.y / 2 + liftCm,
      Math.max(-hz, Math.min(hz, local.z)),
    )
    return this.getTransform().getWorldTransform().multiplyPoint(clamped)
  }

  /** Center of the chest surface in world space. */
  chestCenter(): vec3 {
    return this.getTransform().getWorldTransform().multiplyPoint(new vec3(0, this.size.y / 2 + 0.3, 0))
  }
}
