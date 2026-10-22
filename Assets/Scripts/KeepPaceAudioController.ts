/**
 * KeepPaceAudioController: all sounds of Keep Pace, played at the chest target.
 *
 * Owns: one AudioComponent per channel (click, correction, end tone, round complete),
 * created on this SceneObject, which sits under ChestTarget so sounds come from the
 * chest. One public function per cue name, so the procedural tones can be replaced by
 * spoken clips ("Faster", "Slower", "Round complete") by swapping the track inputs only.
 * Expects (@input): five AudioTrackAssets (Assets/Audio/*.wav).
 * Must not: decide when a cue plays (the session does), or hold session state.
 */

@component
export class KeepPaceAudioController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">KeepPaceAudioController: cues at the chest target</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Metronome click (soft, about 1 kHz, 30 ms)")
  clickTrack: AudioTrackAsset
  @input
  @hint("Correction when the cadence is too slow. Replace with a spoken \"Faster\" clip when available")
  fasterTrack: AudioTrackAsset
  @input
  @hint("Correction when the cadence is too fast. Replace with a spoken \"Slower\" clip when available")
  slowerTrack: AudioTrackAsset
  @input
  @hint("Distinct end of round tone, about one second")
  endToneTrack: AudioTrackAsset
  @input
  @hint("Played right after the end tone. Replace with a spoken \"Round complete\" clip when available")
  roundCompleteTrack: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Click loudness at full guidance (it then lowers with the fading)")
  @widget(new SliderWidget(0, 1, 0.05))
  clickVolume: number = 0.6
  @input
  @hint("Loudness of corrections, end tone and round complete")
  @widget(new SliderWidget(0, 1, 0.05))
  cueVolume: number = 1
  @input
  @hint("Spatialize sounds at the chest target (adds an Audio Listener to the camera if missing)")
  spatialize: boolean = true
  @ui.group_end

  private clickAudio: AudioComponent
  private correctionAudio: AudioComponent
  private endAudio: AudioComponent
  private completeAudio: AudioComponent

  /** Name of the last cue actually started (for tests and logs). */
  lastPlayed = ""
  playCount = 0

  onAwake(): void {
    this.clickAudio = this.makeChannel(this.clickTrack, Audio.PlaybackMode.LowLatency)
    this.correctionAudio = this.makeChannel(this.fasterTrack, Audio.PlaybackMode.LowLatency)
    this.endAudio = this.makeChannel(this.endToneTrack, Audio.PlaybackMode.LowLatency)
    this.completeAudio = this.makeChannel(this.roundCompleteTrack, Audio.PlaybackMode.LowLatency)
  }

  private makeChannel(track: AudioTrackAsset, mode: Audio.PlaybackMode): AudioComponent {
    const ac = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    ac.playbackMode = mode
    if (track) ac.audioTrack = track
    if (this.spatialize) {
      try {
        ac.spatialAudio.enabled = true
      } catch (e) {
        print("[KeepPaceAudioController] spatial audio unavailable: " + e)
      }
    }
    return ac
  }

  /** Adds an Audio Listener to the given camera object when spatial audio is on. */
  ensureListener(cameraObject: SceneObject): void {
    if (!this.spatialize || !cameraObject) return
    if (cameraObject.getComponent("Component.AudioListenerComponent")) return
    cameraObject.createComponent("Component.AudioListenerComponent")
  }

  playClick(volume01: number): void {
    this.play(this.clickAudio, this.clickTrack, this.clickVolume * volume01, "Click")
  }

  playFaster(): void {
    this.play(this.correctionAudio, this.fasterTrack, this.cueVolume, "Faster")
  }

  playSlower(): void {
    this.play(this.correctionAudio, this.slowerTrack, this.cueVolume, "Slower")
  }

  playEndTone(): void {
    this.play(this.endAudio, this.endToneTrack, this.cueVolume, "EndTone")
  }

  playRoundComplete(): void {
    this.play(this.completeAudio, this.roundCompleteTrack, this.cueVolume, "RoundComplete")
  }

  /** Dispatch by cue name (names produced by KeepPaceSession). */
  playCue(name: string, volume01: number = 1): void {
    switch (name) {
      case "Click":
        this.playClick(volume01)
        break
      case "Faster":
        this.playFaster()
        break
      case "Slower":
        this.playSlower()
        break
      case "EndTone":
        this.playEndTone()
        break
      case "RoundComplete":
        this.playRoundComplete()
        break
    }
  }

  private play(ac: AudioComponent, track: AudioTrackAsset, volume: number, name: string): void {
    this.lastPlayed = name
    this.playCount++
    if (!ac || !track) return
    if (ac.audioTrack !== track) {
      if (ac.isPlaying()) ac.stop(false)
      ac.audioTrack = track
    } else if (ac.isPlaying()) {
      ac.stop(false)
    }
    ac.volume = Math.max(0, Math.min(1, volume))
    ac.play(1)
  }
}
