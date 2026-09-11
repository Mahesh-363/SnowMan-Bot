import logging
import numpy as np
from typing import Optional
from ..config import settings

logger = logging.getLogger("Snowman.WakeWord")


class WakeWordDetector:
    """Detects the assistant wake word ('Snowman') using openWakeWord or Porcupine."""

    def __init__(self):
        self.engine_type = settings.WAKE_WORD_ENGINE.lower()
        self.target_word = settings.WAKE_WORD.lower()
        self.sensitivity = settings.WAKE_WORD_SENSITIVITY
        self.oww_model = None
        self.porcupine = None

        self._init_engine()

    def _init_engine(self):
        if self.engine_type == "porcupine" and settings.PORCUPINE_ACCESS_KEY:
            try:
                import pvporcupine
                # Try loading custom keyword or built-in keyword
                self.porcupine = pvporcupine.create(
                    access_key=settings.PORCUPINE_ACCESS_KEY,
                    keywords=["jarvis", "picovoice"]  # standard default keywords
                )
                logger.info("Porcupine wake word engine initialized.")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize Porcupine: {e}. Falling back to openWakeWord.")

        # Default / Open-source: openWakeWord
        try:
            import openwakeword
            from openwakeword.model import Model
            # Load default models (e.g. 'hey_jarvis', 'alexa') or custom 'snowman' model if present
            self.oww_model = Model(inference_framework="onnx")
            logger.info("openWakeWord engine initialized successfully.")
        except Exception as e:
            logger.warning(f"openWakeWord not loaded: {e}. Keyword detection will use STT transcription fallback.")
            self.oww_model = None

    def process_frame(self, audio_chunk_int16: np.ndarray) -> bool:
        """
        Processes a single audio frame (16kHz 16-bit PCM integer array, ~1280 samples).
        Returns True if the wake word is detected.
        """
        if self.porcupine is not None:
            try:
                # Porcupine requires exact frame length (usually 512 samples)
                frame_length = self.porcupine.frame_length
                if len(audio_chunk_int16) >= frame_length:
                    pcm = audio_chunk_int16[:frame_length].tolist()
                    keyword_index = self.porcupine.process(pcm)
                    if keyword_index >= 0:
                        logger.info("Wake word detected via Porcupine!")
                        return True
            except Exception as e:
                logger.error(f"Porcupine process error: {e}")

        if self.oww_model is not None:
            try:
                # openWakeWord expects int16 audio array (16kHz)
                prediction = self.oww_model.predict(audio_chunk_int16)
                for model_name, score in prediction.items():
                    if score >= self.sensitivity:
                        logger.info(f"Wake word detected via openWakeWord ({model_name}: {score:.2f})!")
                        self.oww_model.reset()
                        return True
            except Exception as e:
                logger.error(f"openWakeWord process error: {e}")

        return False


wake_word_detector = WakeWordDetector()
