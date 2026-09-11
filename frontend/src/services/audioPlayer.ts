type MouthUpdateCallback = (mouthOpen: number) => void;
type PlaybackStateCallback = (isPlaying: boolean) => void;

class AudioPlayerService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGenId: number = 0;
  private chunkBuffer: Uint8Array[] = [];
  private isPlaying: boolean = false;
  private mouthListeners: MouthUpdateCallback[] = [];
  private playbackListeners: PlaybackStateCallback[] = [];
  private animationFrameId: number | null = null;

  stopCurrentPlayback() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {}
      this.currentSource = null;
    }
    const wasPlaying = this.isPlaying;
    this.isPlaying = false;
    this.chunkBuffer = [];
    this.stopLipSyncAnalysis();
    if (wasPlaying) {
      this.notifyPlaybackState(false);
    }
  }

  public unlockAudio() {
    this.initAudio();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch((e) => {
        console.warn('[AudioPlayer] AudioContext resume failed:', e);
      });
    }
  }

  private initAudio() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.6;
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  handleAudioChunk(base64Chunk: string, isFirst: boolean, isLast: boolean, genId?: number) {
    try {
      // Discard stale audio from older speech generations
      if (genId !== undefined && genId < this.currentGenId) {
        return;
      }

      // If a newer speech generation begins, immediately cut off previous audio
      if (genId !== undefined && genId > this.currentGenId) {
        this.currentGenId = genId;
        this.stopCurrentPlayback();
        this.chunkBuffer = [];
      } else if (isFirst) {
        this.stopCurrentPlayback();
        this.chunkBuffer = [];
      }

      const binaryString = atob(base64Chunk);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      this.chunkBuffer.push(bytes);

      if (isLast) {
        this.playAccumulatedChunks(this.currentGenId);
      }
    } catch (e) {
      console.error('[AudioPlayer] Error processing audio chunk:', e);
    }
  }

  private async playAccumulatedChunks(expectedGenId?: number) {
    if (this.chunkBuffer.length === 0) return;

    this.initAudio();
    if (!this.audioContext || !this.analyser) return;

    // Concatenate all chunks
    const totalLength = this.chunkBuffer.reduce((acc, curr) => acc + curr.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunkBuffer) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunkBuffer = [];

    try {
      this.stopCurrentPlayback();
      if (expectedGenId !== undefined && expectedGenId !== this.currentGenId) {
        return;
      }
      const audioBuffer = await this.audioContext.decodeAudioData(merged.buffer);
      if (expectedGenId !== undefined && expectedGenId !== this.currentGenId) {
        return;
      }
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.currentSource = source;
      this.isPlaying = true;
      this.notifyPlaybackState(true);
      this.startLipSyncAnalysis();

      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
        }
        this.isPlaying = false;
        this.stopLipSyncAnalysis();
        this.notifyPlaybackState(false);
      };

      source.start();
    } catch (e) {
      console.error('[AudioPlayer] Error decoding/playing audio:', e);
      this.isPlaying = false;
      this.stopLipSyncAnalysis();
      this.notifyPlaybackState(false);
    }
  }

  private startLipSyncAnalysis() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const dataArray = new Uint8Array(this.analyser?.frequencyBinCount || 128);

    const checkAmplitude = () => {
      if (!this.isPlaying || !this.analyser) {
        this.notifyMouth(0);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      // Average the vocal frequencies (bins 2 to 36)
      let sum = 0;
      const sampleCount = Math.min(dataArray.length, 36);
      for (let i = 2; i < sampleCount; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (sampleCount - 2);
      // Map speech volume: scale responsively so mouth visually opens and articulates
      const rawNormalized = Math.max(0.0, (avg - 8.0) / 48.0);
      const normalized = Math.min(1.0, Math.pow(rawNormalized, 0.85));
      this.notifyMouth(normalized);

      this.animationFrameId = requestAnimationFrame(checkAmplitude);
    };

    this.animationFrameId = requestAnimationFrame(checkAmplitude);
  }

  private stopLipSyncAnalysis() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.notifyMouth(0);
  }

  onMouthOpen(callback: MouthUpdateCallback) {
    this.mouthListeners.push(callback);
    return () => {
      this.mouthListeners = this.mouthListeners.filter(l => l !== callback);
    };
  }

  onPlaybackStateChange(callback: PlaybackStateCallback) {
    this.playbackListeners.push(callback);
    return () => {
      this.playbackListeners = this.playbackListeners.filter(l => l !== callback);
    };
  }

  private notifyMouth(val: number) {
    this.mouthListeners.forEach(cb => cb(val));
  }

  private notifyPlaybackState(isPlaying: boolean) {
    this.playbackListeners.forEach(cb => cb(isPlaying));
  }
}

export const audioPlayer = new AudioPlayerService();
