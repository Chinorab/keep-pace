/**
 * KeepPaceSession: pure session state machine and cadence math for Keep Pace.
 *
 * Owns: phase, target lock flags, round timer, interval history, on-pace streak,
 * guidance level (brackets opacity + click volume), drift detection, spoken-cue
 * gating, end-of-round sequence timing, summary statistics, and the comparison with
 * the previous round (in memory, current launch only).
 *
 * Inputs: only a stream of compression events (`onCompression(timeMs)`), a clock
 * (`tick(timeMs)`), target placement notifications and the two summary actions.
 * It never touches scene objects, input or audio: the controller reads the public
 * state after each call and drains `drainCues()` to play sounds. Real compression
 * sources (manikin sensor, hand tracking) can replace the pinch stand-in by calling
 * the same entry points.
 *
 * Must not: import Lens Studio APIs, read the clock itself, or hold visual state.
 * Kept free of enums and Lens globals so it also runs under plain Node for checks.
 */

export type Phase = "Reminder" | "AwaitingTarget" | "Ready" | "Running" | "Ending" | "Summary"
export type GuidanceLevel = "Full" | "Fading" | "Off"
export type CueName = "Click" | "Faster" | "Slower" | "EndTone" | "RoundComplete"
export type EndReason = "None" | "Timer" | "Idle"

export interface SessionConfig {
  /** Shortest on-pace interval in ms (120 per minute, AHA/ERC 2025). */
  minIntervalMs: number
  /** Longest on-pace interval in ms (100 per minute, AHA/ERC 2025). */
  maxIntervalMs: number
  /** Metronome tempo for brackets and click, per minute (middle of the range). */
  metronomeBpm: number
  /** Round length from the first compression, ms (AHA 2025 switch interval about 2 min). */
  roundLengthMs: number
  /** Consecutive on-pace compressions before the guidance fades (design choice). */
  fadeAfterOnPace: number
  /** Brackets fade duration once the streak is reached, ms (design choice). */
  bracketFadeMs: number
  /** Metronome beats over which the click lowers and stops after the brackets faded. */
  clickFadeBeats: number
  /** Number of recent intervals averaged for drift detection. */
  driftWindow: number
  /** No compression for longer than this counts as drift, ms (design choice). */
  driftGapMs: number
  /** No compression for this long ends the round early, ms (design choice). */
  earlyEndIdleMs: number
  /** Minimum time between two spoken corrections, ms (design choice). */
  cueMinGapMs: number
  /** Compressions needed inside the reliability window before a spoken correction. */
  cueReliableCount: number
  /** Reliability window for spoken corrections, ms. */
  cueReliableWindowMs: number
  /** How long the brackets stay thickened with a correction, ms. */
  thickenMs: number
  /** Duration of the end pulse (slow expansion and fade), ms. */
  endPulseMs: number
  /** Delay from round end to the "Round complete" cue (right after the end tone), ms. */
  roundCompleteDelayMs: number
  /** Delay from the end of the end pulse to the summary, ms. */
  summaryDelayMs: number
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  minIntervalMs: 500,
  maxIntervalMs: 600,
  metronomeBpm: 110,
  roundLengthMs: 120000,
  fadeAfterOnPace: 10,
  bracketFadeMs: 1200,
  clickFadeBeats: 3,
  driftWindow: 3,
  driftGapMs: 1000,
  earlyEndIdleMs: 3000,
  cueMinGapMs: 5000,
  cueReliableCount: 4,
  cueReliableWindowMs: 3000,
  thickenMs: 700,
  endPulseMs: 1000,
  roundCompleteDelayMs: 1000,
  summaryDelayMs: 1000,
}

export interface RoundSummary {
  roundIndex: number
  endReason: EndReason
  durationSec: number
  compressionCount: number
  intervalCount: number
  avgCadencePerMin: number
  regularityPct: number
  /** Regularity of the previous round in this launch, or -1 for the first round. */
  previousRegularityPct: number
  /** Comparison line text, empty for the first round. */
  comparisonText: string
  timeText: string
  rateText: string
  regularityText: string
}

export interface CueEvent {
  name: CueName
  /** Playback volume 0..1 (used by the click as it lowers). */
  volume: number
  timeMs: number
}

export class KeepPaceSession {
  readonly config: SessionConfig

  // ── Phase and target ──────────────────────────────
  phase: Phase = "Reminder"
  targetPlaced = false
  targetLocked = false

  // ── Round data ────────────────────────────────────
  roundIndex = 0
  compressionCount = 0
  roundStartMs = 0
  lastCompressionMs = 0
  compressionTimes: number[] = []
  intervals: number[] = []
  onPaceStreak = 0
  lastIntervalMs = 0
  /** Average of the last `driftWindow` intervals, 0 when not enough data. */
  recentAvgIntervalMs = 0
  isDrifting = false

  // ── Guidance ──────────────────────────────────────
  guidance: GuidanceLevel = "Full"
  bracketsOpacity = 0
  clickVolume = 0
  bracketsThickened = false
  metronomePhase = 0
  beatCount = 0
  private fadeStartMs = 0
  private thickenUntilMs = 0
  private nextBeatMs = 0
  private clickFadeStarted = false

  // ── Cues ──────────────────────────────────────────
  lastCue: CueName | "" = ""
  lastCueTimeMs = -1
  lastCorrectionTimeMs = -1
  correctionCount = 0
  private pendingCues: CueEvent[] = []

  // ── End sequence and summary ──────────────────────
  endReason: EndReason = "None"
  endStartMs = 0
  endPulseProgress = 0
  private roundCompleteSent = false
  summary: RoundSummary | null = null
  private previousRegularityPct = -1

  constructor(config?: Partial<SessionConfig>) {
    this.config = {...DEFAULT_SESSION_CONFIG, ...(config ?? {})}
  }

  get beatMs(): number {
    return 60000 / this.config.metronomeBpm
  }

  get bracketsVisible(): boolean {
    return (this.phase === "Running" && this.bracketsOpacity > 0.001) || this.phase === "Ending"
  }

  // ── Target placement ──────────────────────────────

  /** True when a pinch on the torso (away from the target) may place or move the target. */
  canPlaceTarget(): boolean {
    if (this.phase === "Reminder" || this.phase === "AwaitingTarget") return true
    return this.phase === "Ready" && !this.targetLocked
  }

  /** Records that the target was placed or moved. Returns false when placement is not allowed. */
  placeTarget(): boolean {
    if (!this.canPlaceTarget()) return false
    this.targetPlaced = true
    this.targetLocked = false
    this.phase = "Ready"
    return true
  }

  /** True when a pinch anywhere on the torso counts as a compression (target locked). */
  torsoCountsAsCompression(): boolean {
    return this.targetPlaced && this.targetLocked && (this.phase === "Running" || this.phase === "Ready")
  }

  /** True when a pinch on the target counts as a compression. */
  acceptsCompressions(): boolean {
    return this.targetPlaced && (this.phase === "Ready" || this.phase === "Running")
  }

  // ── Compression stream ────────────────────────────

  /** Single entry point for one compression event. Returns true when it was counted. */
  onCompression(timeMs: number): boolean {
    if (!this.acceptsCompressions()) return false
    if (this.phase === "Ready") {
      this.startRound(timeMs)
    } else {
      const interval = timeMs - this.lastCompressionMs
      this.intervals.push(interval)
      this.lastIntervalMs = interval
      if (this.isOnPace(interval)) this.onPaceStreak++
      else this.onPaceStreak = 0
    }
    this.compressionCount++
    this.lastCompressionMs = timeMs
    this.compressionTimes.push(timeMs)
    this.evaluateCadence(timeMs)
    return true
  }

  isOnPace(intervalMs: number): boolean {
    return intervalMs >= this.config.minIntervalMs && intervalMs <= this.config.maxIntervalMs
  }

  private startRound(timeMs: number): void {
    this.roundIndex++
    this.targetLocked = true
    this.phase = "Running"
    this.compressionCount = 0
    this.compressionTimes = []
    this.intervals = []
    this.onPaceStreak = 0
    this.lastIntervalMs = 0
    this.recentAvgIntervalMs = 0
    this.isDrifting = false
    this.roundStartMs = timeMs
    this.lastCompressionMs = timeMs
    this.setGuidanceFull()
    this.nextBeatMs = timeMs
    this.beatCount = 0
    this.metronomePhase = 0
    this.thickenUntilMs = 0
    this.bracketsThickened = false
    this.endReason = "None"
    this.endPulseProgress = 0
    this.summary = null
  }

  private setGuidanceFull(): void {
    this.guidance = "Full"
    this.bracketsOpacity = 1
    this.clickVolume = 1
    this.clickFadeStarted = false
  }

  /** Drift and fade decisions after each counted compression. */
  private evaluateCadence(timeMs: number): void {
    const n = this.intervals.length
    const w = this.config.driftWindow
    if (n >= w) {
      let sum = 0
      for (let i = n - w; i < n; i++) sum += this.intervals[i]
      this.recentAvgIntervalMs = sum / w
    } else {
      this.recentAvgIntervalMs = 0
    }
    const avgDrift = n >= w && !this.isOnPace(this.recentAvgIntervalMs)
    this.isDrifting = avgDrift

    if (avgDrift) {
      this.onPaceStreak = 0
      this.setGuidanceFull()
      this.maybeCorrect(timeMs)
      return
    }
    if (this.guidance === "Full" && this.onPaceStreak >= this.config.fadeAfterOnPace) {
      this.guidance = "Fading"
      this.fadeStartMs = timeMs
    }
  }

  /** Spoken correction, only when the measured cadence is reliable and not too often. */
  private maybeCorrect(timeMs: number): void {
    const windowStart = timeMs - this.config.cueReliableWindowMs
    let recent = 0
    for (let i = this.compressionTimes.length - 1; i >= 0; i--) {
      if (this.compressionTimes[i] < windowStart) break
      recent++
    }
    if (recent < this.config.cueReliableCount) return
    if (this.lastCorrectionTimeMs >= 0 && timeMs - this.lastCorrectionTimeMs < this.config.cueMinGapMs) return
    const cue: CueName = this.recentAvgIntervalMs > this.config.maxIntervalMs ? "Faster" : "Slower"
    this.lastCorrectionTimeMs = timeMs
    this.correctionCount++
    this.thickenUntilMs = timeMs + this.config.thickenMs
    this.bracketsThickened = true
    this.emit(cue, 1, timeMs)
  }

  // ── Clock ─────────────────────────────────────────

  tick(timeMs: number): void {
    if (this.phase === "Running") this.tickRunning(timeMs)
    else if (this.phase === "Ending") this.tickEnding(timeMs)
  }

  private tickRunning(timeMs: number): void {
    const idle = timeMs - this.lastCompressionMs
    if (idle > this.config.earlyEndIdleMs) {
      this.endRound(timeMs, "Idle")
      return
    }
    if (timeMs - this.roundStartMs >= this.config.roundLengthMs) {
      this.endRound(timeMs, "Timer")
      return
    }
    if (idle > this.config.driftGapMs) {
      // A pause counts as drift: guidance comes back at once (no spoken cue, cadence not reliable).
      this.isDrifting = true
      this.onPaceStreak = 0
      if (this.guidance !== "Full") this.setGuidanceFull()
    }

    // Brackets fade.
    if (this.guidance === "Full") {
      this.bracketsOpacity = 1
    } else {
      const t = (timeMs - this.fadeStartMs) / this.config.bracketFadeMs
      this.bracketsOpacity = Math.max(0, 1 - t)
    }

    // Metronome beats: click, and the click lowering once the brackets are gone.
    const beat = this.beatMs
    while (timeMs >= this.nextBeatMs) {
      const beatTime = this.nextBeatMs
      this.nextBeatMs += beat
      this.beatCount++
      if (this.guidance === "Fading" && this.bracketsOpacity <= 0) {
        if (this.clickFadeStarted) {
          this.clickVolume = Math.max(0, this.clickVolume - 1 / this.config.clickFadeBeats)
        } else {
          this.clickFadeStarted = true
          this.clickVolume = Math.max(0, 1 - 1 / this.config.clickFadeBeats)
        }
        if (this.clickVolume <= 0.0001) {
          this.clickVolume = 0
          this.guidance = "Off"
        }
      }
      if (this.clickVolume > 0) this.emit("Click", this.clickVolume, beatTime)
    }
    this.metronomePhase = ((timeMs - this.roundStartMs) % beat) / beat
    this.bracketsThickened = timeMs < this.thickenUntilMs
  }

  private endRound(timeMs: number, reason: EndReason): void {
    this.endReason = reason
    this.phase = "Ending"
    this.endStartMs = timeMs
    this.endPulseProgress = 0
    this.roundCompleteSent = false
    this.bracketsThickened = false
    this.isDrifting = false
    this.clickVolume = 0
    this.summary = this.computeSummary(timeMs, reason)
    this.previousRegularityPct = this.summary.regularityPct
    this.emit("EndTone", 1, timeMs)
  }

  private tickEnding(timeMs: number): void {
    const elapsed = timeMs - this.endStartMs
    this.endPulseProgress = Math.min(1, elapsed / this.config.endPulseMs)
    this.bracketsOpacity = 1 - this.endPulseProgress
    if (!this.roundCompleteSent && elapsed >= this.config.roundCompleteDelayMs) {
      this.roundCompleteSent = true
      this.emit("RoundComplete", 1, timeMs)
    }
    if (elapsed >= this.config.endPulseMs + this.config.summaryDelayMs) {
      this.endPulseProgress = 1
      this.bracketsOpacity = 0
      this.guidance = "Off"
      this.phase = "Summary"
    }
  }

  computeSummary(timeMs: number, reason: EndReason): RoundSummary {
    const n = this.intervals.length
    let sum = 0
    let onPace = 0
    for (const i of this.intervals) {
      sum += i
      if (this.isOnPace(i)) onPace++
    }
    const avgCadence = n > 0 ? 60000 / (sum / n) : 0
    const regularity = n > 0 ? (100 * onPace) / n : 0
    const durationMs =
      reason === "Timer"
        ? Math.min(timeMs, this.roundStartMs + this.config.roundLengthMs) - this.roundStartMs
        : this.lastCompressionMs - this.roundStartMs
    const durationSec = Math.max(0, durationMs / 1000)
    const regularityPct = Math.round(regularity)
    const prev = this.previousRegularityPct
    return {
      roundIndex: this.roundIndex,
      endReason: reason,
      durationSec,
      compressionCount: this.compressionCount,
      intervalCount: n,
      avgCadencePerMin: Math.round(avgCadence),
      regularityPct,
      previousRegularityPct: prev,
      comparisonText: prev >= 0 ? formatComparison(prev) : "",
      timeText: formatDuration(durationSec),
      rateText: formatRate(avgCadence),
      regularityText: formatPercent(regularityPct),
    }
  }

  // ── Summary actions ───────────────────────────────

  /** "Again": new round on the same target. The target stays locked. */
  again(): boolean {
    if (this.phase !== "Summary") return false
    this.phase = "Ready"
    this.targetLocked = true
    this.resetGuidanceDisplay()
    return true
  }

  /** "Move target": unlocks the target; the next pinch on the torso places it. */
  moveTarget(): boolean {
    if (this.phase !== "Summary") return false
    this.phase = "AwaitingTarget"
    this.targetLocked = false
    this.resetGuidanceDisplay()
    return true
  }

  private resetGuidanceDisplay(): void {
    this.guidance = "Full"
    this.bracketsOpacity = 0
    this.clickVolume = 0
    this.bracketsThickened = false
    this.endPulseProgress = 0
    this.isDrifting = false
  }

  // ── Cue queue ─────────────────────────────────────

  private emit(name: CueName, volume: number, timeMs: number): void {
    this.pendingCues.push({name, volume, timeMs})
    if (name !== "Click") {
      this.lastCue = name
      this.lastCueTimeMs = timeMs
    }
  }

  /** Returns and clears the cues produced since the last call. */
  drainCues(): CueEvent[] {
    const out = this.pendingCues
    this.pendingCues = []
    return out
  }
}

// ── Formatting (Lens texts: no dashes, short) ───────

export function formatDuration(sec: number): string {
  const total = Math.round(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m + ":" + (s < 10 ? "0" : "") + s
}

export function formatRate(perMin: number): string {
  return Math.round(perMin) + " per min"
}

export function formatPercent(pct: number): string {
  return Math.round(pct) + "%"
}

export function formatComparison(previousPct: number): string {
  return "Last round " + formatPercent(previousPct)
}
