import io
import logging
import numpy as np
from typing import Union, Optional
from ..config import settings

logger = logging.getLogger("Snowman.STT")


def detect_script_language(text: str) -> str:
    """Detects language based on script/unicode ranges: Telugu (te), Devanagari/Hindi (hi), or English (en)."""
    if any('\u0c00' <= char <= '\u0c7f' for char in text):
        return 'te'
    if any('\u0900' <= char <= '\u097f' for char in text):
        return 'hi'
    return 'en'


class SpeechToText:
    """Multilingual Speech-to-Text transcriber using faster-whisper with automatic language detection."""

    def __init__(self):
        self.model = None
        self.model_size = settings.WHISPER_MODEL_SIZE
        self.device = settings.WHISPER_DEVICE
        self.compute_type = settings.WHISPER_COMPUTE_TYPE
        self._is_loading = False

    def load_model(self):
        """Loads or reloads the faster-whisper model."""
        if self.model is not None or self._is_loading:
            return
        self._is_loading = True
        try:
            from faster_whisper import WhisperModel
            logger.info(f"Loading faster-whisper model '{self.model_size}' on {self.device} ({self.compute_type})...")
            self.model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
                download_root=str(settings.MODELS_DIR / "whisper")
            )
            logger.info("faster-whisper model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load faster-whisper model: {e}")
            self.model = None
        finally:
            self._is_loading = False

    def transcribe(self, audio: Union[np.ndarray, bytes], language: Optional[str] = None) -> tuple[str, str]:
        """
        Transcribes 16kHz audio into text with automatic language detection.
        Returns a tuple: (transcript_text, detected_language).
        """
        # 1. Primary: faster-whisper with auto language identification
        if self.model is None:
            self.load_model()

        if self.model is not None:
            try:
                # If audio is bytes, convert to numpy float32
                if isinstance(audio, bytes):
                    audio_array = np.frombuffer(audio, dtype=np.int16).astype(np.float32) / 32768.0
                else:
                    audio_array = audio.astype(np.float32)

                # Passing language=None tells faster-whisper to auto-detect language
                segments, info = self.model.transcribe(
                    audio_array,
                    beam_size=5,
                    language=language,  # None enables auto-detect
                    condition_on_previous_text=False
                )
                transcript = " ".join(seg.text.strip() for seg in segments).strip()
                detected_lang = getattr(info, "language", None)
                if not detected_lang or detected_lang not in ["en", "hi", "te"]:
                    detected_lang = detect_script_language(transcript)

                logger.info(f"Transcribed speech via Whisper [{detected_lang}]: '{transcript}'")
                return transcript, detected_lang
            except Exception as e:
                logger.error(f"Whisper transcription error: {e}")

        # 2. Resilient Fallback: SpeechRecognition engine
        try:
            import speech_recognition as sr
            if isinstance(audio, np.ndarray):
                audio_i16 = (audio * 32767).astype(np.int16)
                raw_bytes = audio_i16.tobytes()
            else:
                raw_bytes = audio

            r = sr.Recognizer()
            audio_data = sr.AudioData(raw_bytes, sample_rate=16000, sample_width=2)
            transcript = r.recognize_google(audio_data).strip()
            detected_lang = detect_script_language(transcript)
            logger.info(f"Transcribed speech via SpeechRecognition [{detected_lang}]: '{transcript}'")
            return transcript, detected_lang
        except Exception as e:
            logger.debug(f"SpeechRecognition note: {e}")
            return "", "en"


stt_engine = SpeechToText()
