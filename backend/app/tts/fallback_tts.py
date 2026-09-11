import os
import tempfile
import logging
from typing import Optional

logger = logging.getLogger("Snowman.FallbackTTS")


class FallbackTTSEngine:
    """Out-of-the-box local TTS fallback using Windows SAPI5 / pyttsx3."""

    def __init__(self):
        self._engine = None

    def synthesize_wav_bytes(self, text: str) -> Optional[bytes]:
        """Synthesizes text into standard WAV audio bytes."""
        text = text.strip()
        if not text:
            return None

        temp_wav = None
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty("rate", 175)  # slightly faster, natural speech pace
            engine.setProperty("volume", 1.0)

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                temp_wav = f.name

            engine.save_to_file(text, temp_wav)
            engine.runAndWait()

            if os.path.exists(temp_wav) and os.path.getsize(temp_wav) > 0:
                with open(temp_wav, "rb") as f:
                    wav_bytes = f.read()
                return wav_bytes
            return None
        except Exception as e:
            logger.warning(f"Fallback TTS generation error: {e}")
            return None
        finally:
            if temp_wav and os.path.exists(temp_wav):
                try:
                    os.remove(temp_wav)
                except Exception:
                    pass


fallback_tts = FallbackTTSEngine()
