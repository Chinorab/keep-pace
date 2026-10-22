/**
 * KeepPaceReminderPanelUI: opening reminder (Call, Push, Shock) and training disclaimer.
 *
 * Owns: the world-anchored reminder panel (UIKit BackPlate + FlexLayout column), one
 * icon per line, and its visibility. Passive view: it shows what it is told.
 * Expects: Assets/Icons/{call,cardiology,bolt,school}.png and
 * Assets/Materials/ImageMaterial.mat (loaded with requireAsset).
 * Must not: follow the head, hold session state, or decide when to hide itself.
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

const IMAGE_MATERIAL = requireAsset("../Materials/ImageMaterial.mat") as Material
const ICON_CALL = requireAsset("../Icons/call.png") as Texture
const ICON_PUSH = requireAsset("../Icons/cardiology.png") as Texture
const ICON_SHOCK = requireAsset("../Icons/bolt.png") as Texture
const ICON_PRACTICE = requireAsset("../Icons/school.png") as Texture

/** Text.size per cm of em square (SnapOS system font calibration). */
const SIZE_PER_EM_CM = 43.886
/** Cap height as a share of the em square for the system font. */
const CAP_TO_EM = 0.7
const CONTENT_Z = 0.6
const LAYOUT_Z = 0.02

function sizeForCapHeight(capCm: number): number {
  return (capCm / CAP_TO_EM) * SIZE_PER_EM_CM
}

@component
export class KeepPaceReminderPanelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">KeepPaceReminderPanelUI: opening reminder and disclaimer</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Panel width in cm (brief: about 40 cm)")
  @widget(new SliderWidget(25, 60, 1))
  panelWidthCm: number = 40

  @input
  @hint("Cap height of the reminder lines in cm (brief: about 4 cm)")
  @widget(new SliderWidget(1.5, 6, 0.1))
  lineCapHeightCm: number = 4

  @input
  @hint("Cap height of the disclaimer sentence in cm")
  @widget(new SliderWidget(0.6, 3, 0.1))
  disclaimerCapHeightCm: number = 1.3

  @input
  @hint("First reminder line (call emergency services)")
  callText: string = "Call"

  @input
  @hint("Second reminder line (start chest compressions)")
  pushText: string = "Push"

  @input
  @hint("Third reminder line (use a defibrillator)")
  shockText: string = "Shock"

  @input
  @hint("Training disclaimer shown under the reminder lines")
  @widget(new TextAreaWidget())
  disclaimerText: string =
    "Practice tool for manikin training. Not for real emergencies. Does not replace certified CPR training or dispatcher instructions."

  @input("vec4", "{1,1,1,1}")
  @hint("Text color. Keep it light: the display is additive and dark renders transparent")
  @widget(new ColorWidget())
  textColor: vec4
  @ui.group_end

  private wantVisible = true
  private initDone = false

  /** True when the panel is meant to be visible. */
  get isShown(): boolean {
    return this.wantVisible
  }

  show(): void {
    this.wantVisible = true
    this.applyVisibility()
  }

  hide(): void {
    this.wantVisible = false
    this.applyVisibility()
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
    flex.rowGap = this.lineCapHeightCm * 0.45
    flex.paddingTop = pad
    flex.paddingBottom = pad
    flex.paddingLeft = pad
    flex.paddingRight = pad
    let firstLayout = true
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
      if (firstLayout) {
        firstLayout = false
        this.initDone = true
        this.applyVisibility()
      }
    })

    const innerW = this.panelWidthCm - pad * 2
    const lineH = this.lineCapHeightCm * 1.6
    this.addLine(content, "CallLine", ICON_CALL, this.callText, innerW, lineH, this.lineCapHeightCm)
    this.addLine(content, "PushLine", ICON_PUSH, this.pushText, innerW, lineH, this.lineCapHeightCm)
    this.addLine(content, "ShockLine", ICON_SHOCK, this.shockText, innerW, lineH, this.lineCapHeightCm)

    // Four wrapped lines at about 1.2 em line spacing.
    const discH = (this.disclaimerCapHeightCm / CAP_TO_EM) * 1.25 * 4.2
    this.addDisclaimer(content, innerW, discH)
  }

  private applyVisibility(): void {
    if (!this.initDone && !this.wantVisible) return // hide once layout is done (see G3)
    this.sceneObject.enabled = this.wantVisible
  }

  /** One reminder line: icon + label, in a row. */
  private addLine(parent: SceneObject, name: string, icon: Texture, label: string,
                  widthCm: number, heightCm: number, capCm: number): void {
    const row = this.obj(parent, name, new vec3(0, 0, LAYOUT_Z))
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.direction = FlexDirection.Row
    rowFlex.justifyContent = FlexJustify.Start
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.columnGap = capCm * 0.6
    rowFlex.width = widthCm
    rowFlex.height = heightCm
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = widthCm
    rowItem.overrideHeight = heightCm

    const iconCm = capCm * 1.3
    this.addIcon(row, icon, iconCm)
    const textW = widthCm - iconCm - capCm * 0.6
    this.addText(row, "Label", label, textW, heightCm, sizeForCapHeight(capCm), HorizontalAlignment.Left, false)
  }

  private addDisclaimer(parent: SceneObject, widthCm: number, heightCm: number): void {
    const row = this.obj(parent, "Disclaimer", new vec3(0, 0, LAYOUT_Z))
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.direction = FlexDirection.Row
    rowFlex.justifyContent = FlexJustify.Start
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.columnGap = 1.2
    rowFlex.width = widthCm
    rowFlex.height = heightCm
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = widthCm
    rowItem.overrideHeight = heightCm
    rowItem.marginTop = 1.0

    const iconCm = this.disclaimerCapHeightCm * 2.4
    this.addIcon(row, ICON_PRACTICE, iconCm)
    const textW = widthCm - iconCm - 1.2
    this.addText(row, "DisclaimerText", this.disclaimerText, textW, heightCm,
      sizeForCapHeight(this.disclaimerCapHeightCm), HorizontalAlignment.Left, true)
  }

  private addIcon(parent: SceneObject, texture: Texture, sizeCm: number): void {
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
  }

  private addText(parent: SceneObject, name: string, value: string, widthCm: number, heightCm: number,
                  size: number, align: HorizontalAlignment, wrap: boolean): Text {
    const so = this.obj(parent, name, new vec3(0, 0, LAYOUT_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = value
    t.depthTest = true
    t.size = size
    t.textFill.color = this.textColor ?? new vec4(1, 1, 1, 1)
    t.horizontalAlignment = align
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Shrink
    t.verticalOverflow = wrap ? VerticalOverflow.Shrink : VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = widthCm
    item.overrideHeight = heightCm
    item.flexGrow = 1
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
