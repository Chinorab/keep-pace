/**
 * KeepPaceController: orchestrator of Keep Pace (Hands-Only CPR training coach).
 *
 * Owns: the KeepPaceSession instance (pure logic), the target world position, routing
 * of pinch events into session calls, and pushing session state into the views
 * (chest cues, audio, reminder panel, summary panel) every frame.
 * Exposes a readable state and a small test API for LEAF (see "Test API" below); all
 * test entry points go through the same code path as SIK pinches and button presses.
 * Expects (@input): torso input, chest cue view, audio controller, reminder panel UI,
 * summary panel UI, camera object.
 * Must not: create UI text (UI modules do), or compute cadence math (the session does).
 */
import {KeepPaceSession, Phase, SessionConfig} from "./KeepPaceSession"
import {KeepPaceTorsoInput} from "./KeepPaceTorsoInput"
import {KeepPaceChestCueView} from "./KeepPaceChestCueView"
import {KeepPaceAudioController} from "./KeepPaceAudioController"
import {KeepPaceReminderPanelUI} from "./KeepPaceReminderPanelUI"
import {KeepPaceSummaryPanelUI} from "./KeepPaceSummaryPanelUI"

export type PinchResult =
  | "PlacedTarget"
  | "MovedTarget"
  | "Compression"
  | "IgnoredOutsideTorso"
  | "IgnoredLocked"
  | "IgnoredPhase"

@component
export class KeepPaceController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">KeepPaceController: CPR rhythm coach (training only)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Torso pinch stand-in (Torso object)")
  torsoInput: KeepPaceTorsoInput
  @input
  @hint("Chest visuals: target marker and rhythm brackets")
  chestCue: KeepPaceChestCueView
  @input
  @hint("Sounds at the chest target")
  audioController: KeepPaceAudioController
  @input
  @hint("Opening reminder and disclaimer panel")
  reminderPanel: KeepPaceReminderPanelUI
  @input
  @hint("Round summary panel with Again and Move target")
  summaryPanel: KeepPaceSummaryPanelUI
  @input
  @hint("Main camera object (gets an Audio Listener for spatial cues)")
  cameraObject: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Cadence (sourced: AHA 2025, ERC 2025)</span>')
  @ui.group_start("Cadence")
  @input
  @hint("Shortest on-pace interval, ms (120 per minute)")
  minIntervalMs: number = 500
  @input
  @hint("Longest on-pace interval, ms (100 per minute)")
  maxIntervalMs: number = 600
  @input
  @hint("Metronome tempo of brackets and click, per minute (middle of 100 to 120)")
  @widget(new SliderWidget(100, 120, 1))
  metronomeBpm: number = 110
  @input
  @hint("Round length from the first compression, seconds (switch compressors about every 2 min)")
  @widget(new SliderWidget(10, 180, 5))
  roundLengthSec: number = 120
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Coaching (design choices of this Lens)</span>')
  @ui.group_start("Coaching")
  @input
  @hint("Consecutive on-pace compressions before brackets and click fade")
  @widget(new SliderWidget(3, 30, 1))
  fadeAfterOnPace: number = 10
  @input
  @hint("Beats over which the click lowers and stops once the brackets are gone")
  @widget(new SliderWidget(1, 8, 1))
  clickFadeBeats: number = 3
  @input
  @hint("No compression for longer than this counts as drift, seconds")
  @widget(new SliderWidget(0.6, 3, 0.1))
  driftGapSec: number = 1
  @input
  @hint("No compression for this long ends the round early, seconds")
  @widget(new SliderWidget(1, 10, 0.5))
  earlyEndIdleSec: number = 3
  @input
  @hint("Minimum time between two spoken corrections, seconds")
  @widget(new SliderWidget(1, 15, 0.5))
  correctionMinGapSec: number = 5
  @input
  @hint("Compressions needed in the last 3 s before a correction is spoken (reliable cadence)")
  @widget(new SliderWidget(2, 8, 1))
  correctionReliableCount: number = 4
  @input
  @hint("Pinches closer than this to the target center count as on the target, cm")
  @widget(new SliderWidget(2, 10, 0.5))
  targetHitRadiusCm: number = 5
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Print session events to the log")
  debugLogs: boolean = true
  @ui.group_end

  // ── Readable state (Test API) ─────────────────────
  static instance: KeepPaceController | null = null

  phase: Phase = "Reminder"
  targetPlaced = false
  targetLocked = false
  targetWorldPosition: vec3 = vec3.zero()
  roundIndex = 0
  compressionCount = 0
  onPaceStreak = 0
  lastIntervalMs = 0
  recentAvgIntervalMs = 0
  isDrifting = false
  guidanceLevel = "Full"
  bracketsVisible = false
  bracketsOpacity = 0
  clickVolume = 0
  bracketsThickened = false
  endPulseProgress = 0
  lastCue = ""
  lastCueTimeSec = -1
  cueHistory: string[] = []
  correctionCount = 0
  reminderVisible = true
  summaryVisible = false
  durationSec = 0
  avgCadencePerMin = 0
  regularityPct = 0
  previousRegularityPct = -1
  comparisonText = ""
  endReason = "None"
  lastPinchResult: PinchResult | "" = ""
  pinchCount = 0

  private session: KeepPaceSession
  private hoverPoint: vec3 | null = null
  private targetHovered = false
  private ready = false

  onAwake(): void {
    KeepPaceController.instance = this
    this.session = new KeepPaceSession(this.buildConfig())
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private buildConfig(): Partial<SessionConfig> {
    return {
      minIntervalMs: this.minIntervalMs,
      maxIntervalMs: this.maxIntervalMs,
      metronomeBpm: this.metronomeBpm,
      roundLengthMs: this.roundLengthSec * 1000,
      fadeAfterOnPace: this.fadeAfterOnPace,
      clickFadeBeats: this.clickFadeBeats,
      driftGapMs: this.driftGapSec * 1000,
      earlyEndIdleMs: this.earlyEndIdleSec * 1000,
      cueMinGapMs: this.correctionMinGapSec * 1000,
      cueReliableCount: this.correctionReliableCount,
    }
  }

  private onStart(): void {
    const missing: string[] = []
    if (!this.torsoInput) missing.push("torsoInput")
    if (!this.chestCue) missing.push("chestCue")
    if (!this.audioController) missing.push("audioController")
    if (!this.reminderPanel) missing.push("reminderPanel")
    if (!this.summaryPanel) missing.push("summaryPanel")
    if (missing.length > 0) {
      print("[KeepPace] ERROR: inputs not wired: " + missing.join(", "))
      return
    }
    this.torsoInput.onTorsoPinch.add((p: vec3) => this.routePinch(p, false))
    this.torsoInput.onTargetPinch.add(() => this.routePinch(this.targetWorldPosition, true))
    this.torsoInput.onTorsoHover.add((p: vec3 | null) => (this.hoverPoint = p))
    this.torsoInput.onTargetHover.add((h: boolean) => (this.targetHovered = h))
    this.summaryPanel.onAgain.add(() => this.onAgainPressed())
    this.summaryPanel.onMoveTarget.add(() => this.onMoveTargetPressed())
    this.audioController.ensureListener(this.cameraObject)
    this.ready = true
    this.reminderPanel.show()
    this.summaryPanel.hide()
    this.log("ready, phase " + this.session.phase)
  }

  private nowMs(): number {
    return getTime() * 1000
  }

  // ── Input routing (single path for SIK pinches and test calls) ──

  /**
   * Routes one pinch. `onTarget` is true when the pinch hit the target hit zone.
   * Pinches outside the torso are ignored. Before the first compression of a fresh
   * placement, a pinch away from the target moves it; once locked, any pinch on the
   * torso is a compression.
   */
  private routePinch(worldPos: vec3, onTarget: boolean): PinchResult {
    this.pinchCount++
    const s = this.session
    let result: PinchResult
    if (!onTarget && !this.torsoInput.containsWorldPoint(worldPos)) {
      result = "IgnoredOutsideTorso"
    } else {
      const nearTarget =
        s.targetPlaced && (onTarget || worldPos.distance(this.targetWorldPosition) <= this.targetHitRadiusCm)
      if (s.torsoCountsAsCompression() || (nearTarget && s.acceptsCompressions())) {
        result = s.onCompression(this.nowMs()) ? "Compression" : "IgnoredPhase"
      } else if (s.canPlaceTarget()) {
        const wasPlaced = s.targetPlaced && s.phase === "Ready"
        this.placeTargetAt(worldPos)
        result = wasPlaced ? "MovedTarget" : "PlacedTarget"
      } else if (s.targetLocked) {
        result = "IgnoredLocked"
      } else {
        result = "IgnoredPhase"
      }
    }
    this.lastPinchResult = result
    this.log("pinch -> " + result + " (count " + s.compressionCount + ", phase " + s.phase + ")")
    this.afterSessionChange()
    return result
  }

  private placeTargetAt(worldPos: vec3): void {
    const p = this.torsoInput.toChestSurface(worldPos)
    if (!this.session.placeTarget()) return
    this.targetWorldPosition = p
    this.chestCue.setTargetPosition(p)
    this.reminderPanel.hide()
  }

  private onAgainPressed(): void {
    if (this.session.again()) {
      this.summaryPanel.hide()
      this.log("Again: new round on the same target")
    }
    this.afterSessionChange()
  }

  private onMoveTargetPressed(): void {
    if (this.session.moveTarget()) {
      this.summaryPanel.hide()
      this.log("Move target: target unlocked")
    }
    this.afterSessionChange()
  }

  // ── Frame loop ────────────────────────────────────

  private onUpdate(): void {
    if (!this.ready) return
    const before = this.session.phase
    this.session.tick(this.nowMs())
    if (before !== this.session.phase) this.log("phase " + before + " -> " + this.session.phase)
    this.afterSessionChange()
  }

  /** Plays pending cues and pushes the session state into every view. */
  private afterSessionChange(): void {
    if (!this.ready) return
    const s = this.session
    for (const cue of s.drainCues()) {
      this.audioController.playCue(cue.name, cue.volume)
      if (cue.name !== "Click") {
        this.cueHistory.push(cue.name)
        if (this.cueHistory.length > 20) this.cueHistory.shift()
        this.log("cue " + cue.name)
      }
    }

    // Chest: target marker.
    const canPlace = s.canPlaceTarget()
    let style: "Hidden" | "Idle" | "Quiet" | "Unlocked" = "Hidden"
    if (s.targetPlaced) {
      if (s.phase === "AwaitingTarget") style = "Unlocked"
      else if (s.phase === "Ready") style = "Idle"
      else style = "Quiet"
    }
    this.chestCue.setTargetStyle(style)
    this.chestCue.setTargetHovered(this.targetHovered && s.acceptsCompressions())
    this.torsoInput.setTargetInteractive(s.targetPlaced && s.phase !== "AwaitingTarget")
    const showPreview = canPlace && this.hoverPoint !== null && !this.targetHovered
    this.chestCue.setPlacementPreview(showPreview ? this.torsoInput.toChestSurface(this.hoverPoint) : null)

    // Chest: brackets.
    if (s.phase === "Ending") {
      this.chestCue.setEndPulse(s.endPulseProgress)
    } else {
      this.chestCue.setBrackets(s.phase === "Running", s.bracketsOpacity, s.metronomePhase, s.bracketsThickened)
    }

    // Panels.
    if (s.phase === "Summary" && !this.summaryPanel.isShown && s.summary) {
      const sum = s.summary
      const last = sum.previousRegularityPct >= 0 ? Math.round(sum.previousRegularityPct) + "%" : ""
      this.summaryPanel.showSummary(sum.timeText, sum.rateText, sum.regularityText, last)
    }

    this.syncState()
  }

  private syncState(): void {
    const s = this.session
    this.phase = s.phase
    this.targetPlaced = s.targetPlaced
    this.targetLocked = s.targetLocked
    this.roundIndex = s.roundIndex
    this.compressionCount = s.compressionCount
    this.onPaceStreak = s.onPaceStreak
    this.lastIntervalMs = s.lastIntervalMs
    this.recentAvgIntervalMs = s.recentAvgIntervalMs
    this.isDrifting = s.isDrifting
    this.guidanceLevel = s.guidance
    this.bracketsVisible = s.bracketsVisible
    this.bracketsOpacity = s.phase === "Running" || s.phase === "Ending" ? s.bracketsOpacity : 0
    this.clickVolume = s.phase === "Running" ? s.clickVolume : 0
    this.bracketsThickened = s.bracketsThickened
    this.endPulseProgress = s.endPulseProgress
    this.lastCue = s.lastCue
    this.lastCueTimeSec = s.lastCueTimeMs >= 0 ? s.lastCueTimeMs / 1000 : -1
    this.correctionCount = s.correctionCount
    this.endReason = s.endReason
    this.reminderVisible = this.reminderPanel.isShown
    this.summaryVisible = this.summaryPanel.isShown
    const sum = s.summary
    this.durationSec = sum ? sum.durationSec : 0
    this.avgCadencePerMin = sum ? sum.avgCadencePerMin : 0
    this.regularityPct = sum ? sum.regularityPct : 0
    this.previousRegularityPct = sum ? sum.previousRegularityPct : -1
    this.comparisonText = sum ? sum.comparisonText : ""
  }

  // ── Test API (same code paths as SIK pinches and buttons) ──

  /** One compression: a pinch on the placed target. Returns the pinch result. */
  registerCompression(): PinchResult {
    if (!this.session.targetPlaced) {
      this.lastPinchResult = "IgnoredPhase"
      return "IgnoredPhase"
    }
    return this.routePinch(this.targetWorldPosition, true)
  }

  /** A pinch at a world position, routed like a SIK pinch on the torso. */
  pinchAtWorld(worldPos: vec3): PinchResult {
    return this.routePinch(worldPos, false)
  }

  /** A pinch at an offset (cm) from the chest center, in torso local axes (X length, Z width). */
  pinchOnChest(offsetXcm: number, offsetZcm: number): PinchResult {
    const c = this.torsoInput.chestCenter()
    const t = this.torsoInput.getTransform()
    const p = c.add(t.right.uniformScale(offsetXcm)).add(t.back.uniformScale(offsetZcm))
    return this.routePinch(p, false)
  }

  /** Same as pinching "Again" on the summary. */
  pressAgain(): void {
    this.summaryPanel.pressAgain()
  }

  /** Same as pinching "Move target" on the summary. */
  pressMoveTarget(): void {
    this.summaryPanel.pressMoveTarget()
  }

  /** World position of the torso chest center (useful for tests). */
  getChestCenter(): vec3 {
    return this.torsoInput.chestCenter()
  }

  /** Snapshot of the readable state as JSON. */
  getStateJson(): string {
    const p = this.targetWorldPosition
    return JSON.stringify({
      phase: this.phase,
      targetPlaced: this.targetPlaced,
      targetLocked: this.targetLocked,
      target: [p.x, p.y, p.z],
      roundIndex: this.roundIndex,
      compressionCount: this.compressionCount,
      onPaceStreak: this.onPaceStreak,
      lastIntervalMs: this.lastIntervalMs,
      isDrifting: this.isDrifting,
      guidanceLevel: this.guidanceLevel,
      bracketsVisible: this.bracketsVisible,
      bracketsOpacity: this.bracketsOpacity,
      clickVolume: this.clickVolume,
      bracketsThickened: this.bracketsThickened,
      lastCue: this.lastCue,
      cueHistory: this.cueHistory,
      reminderVisible: this.reminderVisible,
      summaryVisible: this.summaryVisible,
      durationSec: this.durationSec,
      avgCadencePerMin: this.avgCadencePerMin,
      regularityPct: this.regularityPct,
      comparisonText: this.comparisonText,
      endReason: this.endReason,
      lastPinchResult: this.lastPinchResult,
    })
  }

  private log(msg: string): void {
    if (this.debugLogs) print("[KeepPace] " + msg)
  }
}
