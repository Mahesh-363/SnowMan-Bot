export type MicState = 'off' | 'listening' | 'processing';

type TranscriptCallback = (text: string, isFinal: boolean) => void;
type MicStateCallback = (state: MicState) => void;
type ErrorCallback = (error: string) => void;

class VoiceInputService {
  private recognition: any = null;
  private isContinuous: boolean = false;
  private isListening: boolean = false;
  private isStarting: boolean = false;
  private isStopping: boolean = false;
  private isProcessing: boolean = false;
  private currentLanguage: string = 'en-US';

  private hasStartedRef: boolean = false;
  private restartTimer: any = null;

  // VAD Tracking & Silence Watchdog Timers
  private latestInterimTranscript: string = '';
  private isSpeechActive: boolean = false;
  private speechStartTime: number = 0;
  private silenceTimer: any = null;
  private hardWatchdogTimer: any = null;

  private transcriptListeners: TranscriptCallback[] = [];
  private statusListeners: MicStateCallback[] = [];
  private errorListeners: ErrorCallback[] = [];

  private lastEmittedFinal: string = '';
  private lastEmittedTime: number = 0;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[VoiceInput] Web Speech API not supported in this browser environment.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguage;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.isStarting = false;
        this.isStopping = false;
        this.notifyStatus(this.isProcessing ? 'processing' : 'listening');
        console.log(`[VAD:STATE] Microphone active, listening started (lang: ${this.currentLanguage}).`);
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcript = item[0].transcript;
          if (item.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const trimmedFinal = finalTranscript.trim();
        const trimmedInterim = interimTranscript.trim();

        // 1. Native engine marked final transcript
        if (trimmedFinal) {
          console.log('[VAD:STATE] Speech ended: native engine marked final transcript.');
          this.finalizeTranscript(trimmedFinal, 'native_isFinal');
          return;
        }

        // 2. Interim speech in progress
        if (trimmedInterim) {
          this.latestInterimTranscript = trimmedInterim;

          // Track speech start transition
          if (!this.isSpeechActive) {
            this.isSpeechActive = true;
            this.speechStartTime = Date.now();
            console.log(`[VAD:STATE] Speech started: "${trimmedInterim}"`);

            // 5-second hard pipeline watchdog timer
            if (this.hardWatchdogTimer) clearTimeout(this.hardWatchdogTimer);
            this.hardWatchdogTimer = setTimeout(() => {
              this.handleHardWatchdogTimeout();
            }, 5000);
          } else {
            console.log(`[VAD:UPDATE] Interim speech: "${trimmedInterim}"`);
          }

          // Emit interim preview to UI
          if (!this.isProcessing) {
            this.notifyTranscript(trimmedInterim, false);
          }

          // Silence timeout fallback (1600ms quiet -> auto-finalize)
          if (this.silenceTimer) clearTimeout(this.silenceTimer);
          this.silenceTimer = setTimeout(() => {
            this.handleSilenceTimeout();
          }, 1600);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        console.warn('[VAD:ERROR] Speech recognition error:', event.error);
        this.notifyError(`Recognition error: ${event.error}`);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.isStarting = false;
        console.log('[VAD:STATE] Speech recognition onend fired.');

        // If recognition ended with unfinalized speech, finalize now
        if (this.isSpeechActive && this.latestInterimTranscript.trim()) {
          console.log(
            `[VAD:STATE] Finalizing pending speech on recognition end: "${this.latestInterimTranscript.trim()}"`
          );
          this.finalizeTranscript(this.latestInterimTranscript.trim(), 'recognition_onend');
        } else {
          this.resetSpeechTracking();
        }

        if (this.isContinuous && !this.isStopping) {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            if (this.isContinuous && !this.isListening && !this.isStarting) {
              console.log('[VAD:STATE] Restarting continuous microphone listener...');
              this.safeStart();
            }
          }, 200);
        } else {
          this.isStopping = false;
          this.notifyStatus('off');
          console.log('[VAD:STATE] Microphone stopped.');
        }
      };
    } catch (e) {
      console.error('[VoiceInput] Failed to initialize SpeechRecognition:', e);
    }
  }

  private handleSilenceTimeout() {
    console.log('[VAD:STATE] Silence timeout reached (1600ms quiet after speech). Auto-finalizing speech.');
    if (this.latestInterimTranscript.trim()) {
      this.finalizeTranscript(this.latestInterimTranscript.trim(), 'silence_fallback');
    } else {
      this.resetSpeechTracking();
    }
  }

  private handleHardWatchdogTimeout() {
    console.warn('[VAD:TIMEOUT] 5s watchdog timeout reached.');
    if (this.latestInterimTranscript.trim()) {
      console.log(
        `[VAD:STATE] Force-finalizing captured speech on 5s watchdog: "${this.latestInterimTranscript.trim()}"`
      );
      this.finalizeTranscript(this.latestInterimTranscript.trim(), 'watchdog_force');
    } else if (this.isSpeechActive) {
      console.error('[VAD:ERROR] Speech was active but no transcript produced within 5s.');
      this.notifyError("Sorry, I didn't catch that — try again.");
      this.resetSpeechTracking();
    }
  }

  private finalizeTranscript(text: string, source: string) {
    const trimmed = text.trim();
    this.clearVADTimers();

    if (!trimmed) {
      this.resetSpeechTracking();
      return;
    }

    const now = Date.now();
    const isDuplicate =
      trimmed.toLowerCase() === this.lastEmittedFinal.toLowerCase() &&
      now - this.lastEmittedTime < 2500;

    if (isDuplicate) {
      console.log(`[VAD:STATE] Suppressed duplicate final transcript (${source}): "${trimmed}"`);
      this.resetSpeechTracking();
      return;
    }

    this.lastEmittedFinal = trimmed;
    this.lastEmittedTime = now;
    this.isProcessing = true;
    this.notifyStatus('processing');
    console.log(`[VAD:STATE] Transcript finalized [source=${source}]: "${trimmed}"`);
    console.log('[VoiceInput] Final transcript:', trimmed);
    this.notifyTranscript(trimmed, true);
    this.resetSpeechTracking();
  }

  private clearVADTimers() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.hardWatchdogTimer) {
      clearTimeout(this.hardWatchdogTimer);
      this.hardWatchdogTimer = null;
    }
  }

  private resetSpeechTracking() {
    this.clearVADTimers();
    this.latestInterimTranscript = '';
    this.isSpeechActive = false;
    this.speechStartTime = 0;
  }

  private safeStart() {
    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) return;

    if (this.isListening || this.isStarting) {
      return;
    }

    this.isStarting = true;
    try {
      this.recognition.start();
    } catch (e: any) {
      this.isStarting = false;
      if (e.name === 'InvalidStateError') {
        this.isListening = true;
      } else {
        console.error('[VoiceInput] Start error:', e);
      }
    }
  }

  startContinuous() {
    this.isContinuous = true;
    this.isStopping = false;
    this.hasStartedRef = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.safeStart();
  }

  stopContinuous() {
    this.isContinuous = false;
    this.isStopping = true;
    this.hasStartedRef = false;
    this.isProcessing = false;
    this.resetSpeechTracking();
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
    this.isStarting = false;
    this.notifyStatus('off');
  }

  toggleContinuous() {
    if (this.isContinuous || this.isListening) {
      this.stopContinuous();
    } else {
      this.startContinuous();
    }
  }

  setProcessing(processing: boolean) {
    this.isProcessing = processing;
    if (this.isContinuous && this.isListening) {
      this.notifyStatus(processing ? 'processing' : 'listening');
    }
  }

  onTranscript(cb: TranscriptCallback) {
    this.transcriptListeners.push(cb);
    return () => {
      this.transcriptListeners = this.transcriptListeners.filter((l) => l !== cb);
    };
  }

  onStatusChange(cb: MicStateCallback) {
    this.statusListeners.push(cb);
    cb(this.currentMicState);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  onError(cb: ErrorCallback) {
    this.errorListeners.push(cb);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== cb);
    };
  }

  private notifyTranscript(text: string, isFinal: boolean) {
    this.transcriptListeners.forEach((cb) => cb(text, isFinal));
  }

  private notifyStatus(state: MicState) {
    this.statusListeners.forEach((cb) => cb(state));
  }

  private notifyError(error: string) {
    this.errorListeners.forEach((cb) => cb(error));
  }

  get listening(): boolean {
    return this.isListening;
  }

  get continuous(): boolean {
    return this.isContinuous;
  }

  setLanguage(lang: string) {
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
    console.log(`[VoiceInput] Speech recognition language set to: ${lang}`);
  }

  getLanguage(): string {
    return this.currentLanguage;
  }

  async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Release tracks immediately so recognition engine can take over seamlessly
        stream.getTracks().forEach((track) => track.stop());
        return true;
      }
      return true;
    } catch (err: any) {
      console.warn('[VoiceInput] Microphone permission request notice:', err);
      return false;
    }
  }

  get currentMicState(): MicState {
    if (!this.isContinuous && !this.isListening) return 'off';
    if (this.isProcessing) return 'processing';
    return 'listening';
  }
}

export const voiceInput = new VoiceInputService();
