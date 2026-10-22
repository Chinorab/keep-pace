/**
 * KeepPaceTestUtils: shared helpers for the Keep Pace LEAF scenarios.
 *
 * Owns: access to the KeepPaceController test API, frame-accurate pacing of
 * compressions on the real Lens clock, polling helpers, and "reach a known state"
 * helpers (Lens state carries over between scenarios; there is no reset API).
 * Must not: change Lens behavior. Only calls the public test API or SIK interactables.
 */
import {KeepPaceController} from "../Scripts/KeepPaceController"
import {findSceneObjectByName, nextFrame} from "Leaf.lspkg/Utils/common/Utils"

export function log(msg: string): void {
  print("[KeepPaceTest] " + msg)
}

export function nowMs(): number {
  return getTime() * 1000
}

/** The controller under test (static instance, else looked up on the "KeepPace" object). */
export function ctl(): KeepPaceController {
  if (KeepPaceController.instance) return KeepPaceController.instance
  const so = findSceneObjectByName("KeepPace")
  const c = so ? (so.getComponent(KeepPaceController.getTypeName()) as KeepPaceController) : null
  if (!c) throw new Error("KeepPaceController not found")
  return c
}

/** Waits frame by frame until the Lens clock reaches `tMs`. */
export async function waitUntilTime(tMs: number): Promise<void> {
  while (nowMs() < tMs) await nextFrame()
}

/** Polls `pred` every frame; returns true when it holds, false on timeout. */
export async function waitFor(pred: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = nowMs() + timeoutMs
  while (!pred()) {
    if (nowMs() > end) return false
    await nextFrame()
  }
  return true
}

export function distCm(a: vec3, b: vec3): number {
  return a.distance(b)
}

export function fmt(v: vec3): string {
  return "(" + v.x.toFixed(1) + ", " + v.y.toFixed(1) + ", " + v.z.toFixed(1) + ")"
}

/**
 * Paces compressions on an absolute schedule (no drift accumulation): each pinch fires
 * on the first frame at or after its scheduled time. Interval jitter is at most one frame.
 */
export class Pacer {
  private next = 0
  readonly intervals: number[] = []
  readonly results: string[] = []
  firstTimeMs = 0
  lastTimeMs = 0

  constructor(private c: KeepPaceController) {}

  /** First compression, now. */
  start(): string {
    this.next = nowMs()
    this.firstTimeMs = this.next
    this.lastTimeMs = this.next
    const r = this.c.registerCompression()
    this.results.push(r)
    return r
  }

  /** One compression `intervalMs` after the previous scheduled one. */
  async after(intervalMs: number): Promise<string> {
    this.next += intervalMs
    await waitUntilTime(this.next)
    const r = this.c.registerCompression()
    this.lastTimeMs = nowMs()
    this.results.push(r)
    this.intervals.push(this.c.lastIntervalMs)
    return r
  }
}

/** Waits for the Summary phase (round ends after 3 s idle + about 2 s end sequence). */
export async function waitForSummary(c: KeepPaceController, timeoutMs: number = 9000): Promise<void> {
  const ok = await waitFor(() => c.phase === "Summary", timeoutMs)
  if (!ok) throw new Error("Timed out waiting for Summary, phase is " + c.phase)
}

/**
 * Brings the Lens to phase Ready with a placed target (locked or not), from any phase.
 * The next compression then starts a fresh round.
 */
export async function reachReady(c: KeepPaceController): Promise<void> {
  for (let i = 0; i < 6; i++) {
    switch (c.phase) {
      case "Ready":
        return
      case "Reminder":
      case "AwaitingTarget":
        c.pinchOnChest(0, 0)
        break
      case "Running":
      case "Ending":
        await waitForSummary(c)
        break
      case "Summary":
        c.pressAgain()
        break
    }
    await nextFrame()
  }
  throw new Error("Could not reach Ready, phase is " + c.phase)
}

/**
 * Brings the Lens to phase Ready with an UNLOCKED target placed at the given chest offset
 * (cm, torso local X/Z). Used when a scenario needs a known target position.
 */
export async function reachUnlockedTargetAt(c: KeepPaceController, xCm: number, zCm: number): Promise<void> {
  for (let i = 0; i < 8; i++) {
    switch (c.phase) {
      case "Reminder":
      case "AwaitingTarget":
        c.pinchOnChest(xCm, zCm)
        break
      case "Running":
      case "Ending":
        await waitForSummary(c)
        break
      case "Summary":
        c.pressMoveTarget()
        break
      case "Ready":
        if (c.targetLocked) {
          // Locked target (after Again): play a one-compression round to reach Summary.
          c.registerCompression()
          await waitForSummary(c)
        } else {
          const want = chestPoint(c, xCm, zCm)
          if (distCm(c.targetWorldPosition, want) < 1) return
          c.pinchOnChest(xCm, zCm)
        }
        break
    }
    await nextFrame()
  }
  throw new Error("Could not reach an unlocked target, phase " + c.phase + ", locked " + c.targetLocked)
}

/** World point on the chest surface at an offset from the chest center (torso local X/Z). */
export function chestPoint(c: KeepPaceController, xCm: number, zCm: number): vec3 {
  const t = findSceneObjectByName("Torso").getTransform()
  return c.getChestCenter().add(t.right.uniformScale(xCm)).add(t.back.uniformScale(zCm))
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}
