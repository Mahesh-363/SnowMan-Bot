import logging
import numpy as np
from typing import Optional, Callable

logger = logging.getLogger("Snowman.VAD")


class VoiceActivityDetector:
    """Detects voice activity using Silero VAD with adaptive energy fallback."""

    def __init__(self, sample_rate: int = 16000, silence_timeout_ms: int = 1400, max_speech_ms: int = 6000):
        self.sample_rate = sample_rate
        self.silence_timeout_ms = silence_timeout_ms
        self.max_speech_ms = max_speech_ms
        self.silero_model = None
        self._init_silero()

        # State tracking
        self.is_speaking = False
        self.silence_samples = 0
        self.total_speech_samples = 0
        self.silence_sample_threshold = int((silence_timeout_ms / 1000.0) * sample_rate)
        self.max_speech_sample_threshold = int((max_speech_ms / 1000.0) * sample_rate)
        self.speech_buffer = []

    def _init_silero(self):
        try:
            import torch
            model, _ = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                onnx=True
            )
            self.silero_model = model
            logger.info("[VAD:INIT] Silero VAD initialized successfully.")
        except Exception as e:
            logger.warning(f"[VAD:INIT] Silero VAD not loaded ({e}). Using adaptive energy-based VAD.")
            self.silero_model = None

    def is_speech_frame(self, audio_chunk: np.ndarray) -> bool:
        """Determines if the given audio chunk (16kHz float32) contains speech."""
        if audio_chunk is None or len(audio_chunk) == 0:
            return False

        if self.silero_model is not None:
            try:
                import torch
                tensor = torch.from_numpy(audio_chunk).float()
                confidence = self.silero_model(tensor, self.sample_rate).item()
                return confidence > 0.45
            except Exception:
                pass

        # Robust Energy + RMS Fallback with balanced threshold
        rms = np.sqrt(np.mean(audio_chunk**2))
        return rms > 0.010

    def process_chunk(self, audio_chunk: np.ndarray) -> Optional[np.ndarray]:
        """
        Feeds an audio chunk into the VAD tracker.
        Returns complete accumulated audio array when speech has ended, otherwise None.
        """
        has_speech = self.is_speech_frame(audio_chunk)

        if has_speech:
            if not self.is_speaking:
                logger.info("[VAD:STATE] Speech started: voice activity detected.")
                self.is_speaking = True
            self.silence_samples = 0
            self.total_speech_samples += len(audio_chunk)
            self.speech_buffer.append(audio_chunk)

            # Maximum speech duration watchdog fallback
            if self.total_speech_samples >= self.max_speech_sample_threshold:
                logger.info(f"[VAD:STATE] Maximum speech duration reached ({self.max_speech_ms}ms). Auto-finalizing segment.")
                return self._finalize_audio()
            return None

        if self.is_speaking:
            # Currently speaking, but this frame was silence
            self.speech_buffer.append(audio_chunk)
            self.silence_samples += len(audio_chunk)
            self.total_speech_samples += len(audio_chunk)

            if self.silence_samples >= self.silence_sample_threshold:
                logger.info(f"[VAD:STATE] Speech ended: {self.silence_timeout_ms}ms of silence detected.")
                return self._finalize_audio()

            if self.total_speech_samples >= self.max_speech_sample_threshold:
                logger.info(f"[VAD:STATE] Maximum speech duration reached during trailing silence. Finalizing segment.")
                return self._finalize_audio()

        return None

    def _finalize_audio(self) -> Optional[np.ndarray]:
        """Consolidates speech buffer and returns audio if minimum length is met."""
        self.is_speaking = False
        self.silence_samples = 0
        self.total_speech_samples = 0

        if not self.speech_buffer:
            return None

        full_audio = np.concatenate(self.speech_buffer)
        self.speech_buffer = []
        duration_sec = len(full_audio) / self.sample_rate

        # Minimum speech duration: at least 0.35s
        if duration_sec >= 0.35:
            logger.info(f"[VAD:STATE] Transcript finalized: {duration_sec:.2f}s audio segment ready for STT.")
            return full_audio
        else:
            logger.debug(f"[VAD:STATE] Discarded short noise burst ({duration_sec:.2f}s < 0.35s).")
            return None

    def reset(self):
        logger.debug("[VAD:STATE] VAD reset.")
        self.is_speaking = False
        self.silence_samples = 0
        self.total_speech_samples = 0
        self.speech_buffer = []


vad_detector = VoiceActivityDetector()
