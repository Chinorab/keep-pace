/**
 * KeepPaceSummaryPanelUI: round summary and the two round actions.
 *
 * Owns: the world-anchored summary panel (UIKit BackPlate + FlexLayout column):
 * "Time", "Rate", "Regularity" lines, the optional "Last round" comparison line, and
 * two UIKit Buttons with icon plus label ("Again", "Move target"). Passive view:
 * values arrive through showSummary(); user intent leaves through onAgain / onMoveTarget.
 * Expects: Assets/Icons/{timer,monitor_heart,graphic_eq,history,replay,my_location}.png
 * and Assets/Materials/ImageMaterial.mat (requireAsset).
 * Must not: compute statistics, hold session state, or hide itself on a timer.
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

const IMAGE_MATERIAL = requireAsset("../Materials/ImageMaterial.mat") as Material
const ICON_TIME = requireAsset("../Icons/timer.png") as Texture
const ICON_RATE = requireAsset("../Icons/monitor_heart.png") as Texture
const ICON_REGULARITY = requireAsset("../Icons/graphic_eq.png") as Texture
const ICON_LAST_ROUND = requireAsset("../Icons/history.png") as Texture
const ICON_AGAIN = requireAsset("../Icons/replay.png") as Texture
const ICON_MOVE = requireAsset("../Icons/my_location.png") as Texture

const SIZE_PER_EM_CM = 43.886
const CAP_TO_EM = 0.7
const CONTENT_Z = 0.6
const LAYOUT_Z = 0.02
const BUTTON_FACE_Z = 0.08

function sizeForCapHeight(capCm: number): number {
  return (capCm / CAP_TO_EM) * SIZE_PER_EM_CM
}

@component
export class KeepPaceSummaryPanelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">KeepPaceSummaryPanelUI: round summary and actions</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Layout</span>')
  @ui.group_start("Layout")
  @input
  @hint("Panel width in cm (brief: about 45 cm; 50 fits the longest line without shrinking)")
  @widget(new SliderWidget(30, 70, 1))
  panelWidthCm: number = 50

  @input
  @hint("Cap height of the summary lines in cm (brief: about 4 cm; 2.6 keeps all lines the same size in the panel). Long lines shrink to fit")
  @widget(new SliderWidget(1.5, 6, 0.1))
  lineCapHeightCm: number = 2.6

  @input("vec2", "{16,8}")
  @hint("Button size in cm, width x height (brief: about 16 x 8 cm)")
  buttonSizeCm: vec2

  @input
  @hint("Cap height of the button labels in cm")
  @widget(new SliderWidget(0.8, 3, 0.1))
  buttonCapHeightCm: number = 1.4
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Wording</span>')
  @ui.group_start("Wording")
  @input
  @hint("Label of the round duration line")
  timeLabel: string = "Time"
  @input
  @hint("Label of the average cadence line")
  rateLabel: string = "Rate"
  @input
  @hint("Label of the regularity line")
  regularityLabel: string = "Regularity"
  @input
  @hint("Label of the comparison line shown from the second round")
  lastRoundLabel: string = "Last round"
  @input
  @hint("Label of the new round button")
  againLabel: string = "Again"
  @input
  @hint("Label of the move target button")
  moveTargetLabel: string = "Move target"
  @ui.group_end

  private _onAgain = new Event<void>()
  private _onMoveTarget = new Event<void>()

  /** Fires when the user pinches "Again". */
  get onAgain(): PublicApi<void> {
    return this._onAgain.publicApi()
  }

  /** Fires when the user pinches "Move target". */
  get onMoveTarget(): PublicApi<void> {
    return this._onMoveTarget.publicApi()
  }

  private timeValue!: Text
  private rateValue!: Text
  private regularityValue!: Text
  private lastRoundText!: Text
  private lastRoundValue!: Text
  private lastRoundIcon!: Image

  private wantVisible = false
  private pendingInit = 3 // root layout + two buttons
  private initDone = false

  /** True when the panel is meant to be visible. */
  get isShown(): boolean {
    return this.wantVisible
  }

  /** Shows the summary. Pass an empty lastRoundValue on the first round of a launch. */
  showSummary(timeText: string, rateText: string, regularityText: string, lastRoundValue: string): void {
    if (this.timeValue) {
      this.timeValue.text = timeText
      this.rateValue.text = rateText
      this.regularityValue.text = regularityText
      const hasComparison = lastRoundValue.length > 0
      this.lastRoundText.text = hasComparison ? this.lastRoundLabel : ""
      this.lastRoundValue.text = hasComparison ? lastRoundValue : ""
      this.lastRoundIcon.enabled = hasComparison
    }
    this.wantVisible = true
    this.applyVisibility()
  }

  hide(): void {
    this.wantVisible = false
    this.applyVisibility()
  }

  /** Same code path as pinching the "Again" button (used by tests). */
  pressAgain(): void {
    this._onAgain.invoke()
  }

  /** Same code path as pinching the "Move target" button (used by tests). */
  pressMoveTarget(): void {
    this._onMoveTarget.invoke()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const backPlate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = this.obj(this.sceneObject, "Content", new vec3(0, 0, CONTENT_Z))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    const pad = 2.5
    flex.width = this.panelWidthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Start
    flex.alignItems = FlexAlign.Stretch
    flex.rowGap = this.lineCapHeightCm * 0.35
    flex.paddingTop = pad
    flex.paddingBottom = pad
    flex.paddingLeft = pad
    flex.paddingRight = pad
    let firstLayout = true
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
      if (firstLayout) {
        firstLayout = false
        this.markInitStep()
      }
    })

    const innerW = this.panelWidthCm - pad * 2
    const lineH = this.lineCapHeightCm * 1.5
    const cap = this.lineCapHeightCm
    this.timeValue = this.addLine(content, "TimeLine", ICON_TIME, this.timeLabel, "0:00", innerW, lineH, cap).value
    this.rateValue = this.addLine(content, "RateLine", ICON_RATE, this.rateLabel, "0 per min", innerW, lineH, cap).value
    this.regularityValue = this.addLine(content, "RegularityLine", ICON_REGULARITY, this.regularityLabel, "0%",
      innerW, lineH, cap).value
    const last = this.addLine(content, "LastRoundLine", ICON_LAST_ROUND, "", "", innerW, lineH, cap)
    this.lastRoundText = last.label
    this.lastRoundValue = last.value
    this.lastRoundIcon = last.icon
    this.lastRoundIcon.enabled = false

    this.addButtonRow(content, innerW)
  }

  private markInitStep(): void {
    this.pendingInit--
    if (this.pendingInit <= 0 && !this.initDone) {
      this.initDone = true
      this.applyVisibility()
    }
  }

  private applyVisibility(): void {
    // Never disable before UIKit components finished initializing (see specs-build-ui G3).
    if (!this.initDone && !this.wantVisible) return
    this.sceneObject.enabled = this.wantVisible
  }

  /** One summary line: icon, label (left), value (right). */
  private addLine(parent: SceneObject, name: string, icon: Texture, label: string, value: string,
                  widthCm: number, heightCm: number, capCm: number): {label: Text; value: Text; icon: Image} {
    const row = this.obj(parent, name, new vec3(0, 0, LAYOUT_Z))
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.direction = FlexDirection.Row
    rowFlex.justifyContent = FlexJustify.Start
    rowFlex.alignItems = FlexAlign.Center
    const gap = capCm * 0.5
    rowFlex.columnGap = gap
    rowFlex.width = widthCm
    rowFlex.height = heightCm
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = widthCm
    rowItem.overrideHeight = heightCm

    const iconCm = capCm * 1.25
    const iconSo = this.addIcon(row, icon, iconCm)
    const rest = widthCm - iconCm - gap * 2
    const labelW = rest * 0.45
    const valueW = rest - labelW
    const size = sizeForCapHeight(capCm)
    const labelText = this.addText(row, "Label", label, labelW, heightCm, size, HorizontalAlignment.Left)
    const valueText = this.addText(row, "Value", value, valueW, heightCm, size, HorizontalAlignment.Right)
    return {label: labelText, value: valueText, icon: iconSo}
  }

  private addButtonRow(parent: SceneObject, widthCm: number): void {
    const h = this.buttonSizeCm.y
    const row = this.obj(parent, "Buttons", new vec3(0, 0, LAYOUT_Z))
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.direction = FlexDirection.Row
    rowFlex.justifyContent = FlexJustify.Center
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.columnGap = 3
    rowFlex.width = widthCm
    rowFlex.height = h
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = widthCm
    rowItem.overrideHeight = h
    rowItem.marginTop = 1.5

    this.addButton(row, "AgainButton", ICON_AGAIN, this.againLabel, () => this._onAgain.invoke())
    this.addButton(row, "MoveTargetButton", ICON_MOVE, this.moveTargetLabel, () => this._onMoveTarget.invoke())
  }

  /** Rectangular UIKit Button with an icon plus label face. */
  private addButton(parent: SceneObject, name: string, icon: Texture, label: string, onClick: () => void): void {
    const w = this.buttonSizeCm.x
    const h = this.buttonSizeCm.y
    const so = this.obj(parent, name, new vec3(0, 0, LAYOUT_Z))
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = new vec3(w, h, 1) // before init
    btn.onInitialized.add(() => {
      btn.size = new vec3(w, h, 1)
      this.markInitStep()
    })
    btn.onTriggerUp.add(() => onClick())
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h
    item.flexShrink = 0

    // Face: icon + label in a centered row, lifted in front of the button surface.
    const face = this.obj(so, "Face", new vec3(0, 0, BUTTON_FACE_Z))
    const faceFlex = face.createComponent(FlexLayout.getTypeName()) as FlexLayout
    faceFlex.direction = FlexDirection.Row
    faceFlex.justifyContent = FlexJustify.Center
    faceFlex.alignItems = FlexAlign.Center
    const gap = 0.8
    faceFlex.columnGap = gap
    faceFlex.width = w
    faceFlex.height = h
    const iconCm = this.buttonCapHeightCm * 1.9
    this.addIcon(face, icon, iconCm)
    const labelW = w - iconCm - gap - 1.2
    this.addText(face, "ButtonLabel", label, labelW, h * 0.8, sizeForCapHeight(this.buttonCapHeightCm),
      HorizontalAlignment.Left, false)
  }

  private addIcon(parent: SceneObject, texture: Texture, sizeCm: number): Image {
    const so = this.obj(parent, "Icon", new vec3(0, 0, LAYOUT_Z))
    const img = so.createComponent("Component.Image") as Image
    const mat = IMAGE_MATERIAL.clone()
    mat.mainPass.baseTex = texture
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(mat)
    so.getTransform().setLocalScale(new vec3(sizeCm, sizeCm, 1))
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = sizeCm
    item.overrideHeight = sizeCm
    item.flexShrink = 0
    return img
  }

  private addText(parent: SceneObject, name: string, value: string, widthCm: number, heightCm: number,
                  size: number, align: HorizontalAlignment, grow: boolean = true): Text {
    const so = this.obj(parent, name, new vec3(0, 0, LAYOUT_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = value
    t.depthTest = true
    t.size = size
    t.textFill.color = new vec4(1, 1, 1, 1)
    t.horizontalAlignment = align
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = widthCm
    item.overrideHeight = heightCm
    item.flexGrow = grow ? 1 : 0
    item.flexShrink = 0
    item.alignSelf = FlexAlignSelf.Center
    return t
  }

  private obj(parent: SceneObject, name: string, localPos?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (localPos) so.getTransform().setLocalPosition(localPos)
    return so
  }
}
