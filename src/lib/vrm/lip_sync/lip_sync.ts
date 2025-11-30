import { type LipSyncAnalyzeResult } from './lip_sync_analyze_result'

const TIME_DOMAIN_DATA_LENGTH = 2048

export class LipSync {
  public readonly audio: AudioContext
  public readonly analyser: AnalyserNode
  public readonly timeDomainData: Float32Array<ArrayBuffer>
  private currentSource: AudioBufferSourceNode | null = null
  private isPlaying: boolean = false

  constructor(audio: AudioContext) {
    this.audio = audio
    this.analyser = audio.createAnalyser()
    this.timeDomainData = new Float32Array(TIME_DOMAIN_DATA_LENGTH) as Float32Array<ArrayBuffer>
  }

  public update(): LipSyncAnalyzeResult {
    this.analyser.getFloatTimeDomainData(this.timeDomainData)

    let volume = 0.0
    for (let i = 0; i < TIME_DOMAIN_DATA_LENGTH; i++) {
      volume = Math.max(volume, Math.abs(this.timeDomainData[i]))
    }

    // cook
    volume = 1 / (1 + Math.exp(-45 * volume + 5))
    if (volume < 0.1) volume = 0

    return {
      volume
    }
  }

  public async playFromArrayBuffer(buffer: ArrayBuffer, onEnded?: () => void) {
    try {
      if (buffer === null) {
        return
      }

      // Stop previous audio if still playing
      if (this.currentSource) {
        console.log("🛑 Stopping previous VRM audio for lip sync");
        try {
          this.currentSource.stop();
        } catch (e) {
          // Ignore if already stopped
        }
        this.currentSource.disconnect();
        this.currentSource = null;
        this.isPlaying = false;
      }

      // Mark as playing to prevent race conditions
      this.isPlaying = true;

      const audioBuffer = await this.audio.decodeAudioData(buffer)

      // Check if another audio started playing during decoding
      if (!this.isPlaying) {
        console.log("⏭️ Audio playback cancelled during decoding (new audio arrived)");
        onEnded?.();
        return;
      }

      const bufferSource = this.audio.createBufferSource()
      bufferSource.buffer = audioBuffer

      bufferSource.connect(this.audio.destination)
      bufferSource.connect(this.analyser)

      // Set currentSource immediately to ensure it can be stopped
      this.currentSource = bufferSource;

      bufferSource.start()
      if (onEnded) {
        bufferSource.addEventListener('ended', () => {
          if (this.currentSource === bufferSource) {
            this.currentSource = null;
            this.isPlaying = false;
          }
          onEnded();
        })
      } else {
        bufferSource.addEventListener('ended', () => {
          if (this.currentSource === bufferSource) {
            this.currentSource = null;
            this.isPlaying = false;
          }
        })
      }
    } catch (error) {
      console.error(error)
      this.currentSource = null;
      this.isPlaying = false;
      onEnded?.()
    }
  }
}
