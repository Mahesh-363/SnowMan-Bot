import io
import os
import asyncio
import logging
import tempfile
from typing import Optional

logger = logging.getLogger("Snowman.NeuralTTS")

# Available High-Definition Neural Voices
VOICE_PRESETS = {
    "female": "en-US-AriaNeural",       # Warm, expressive, clear studio female voice (Default)
    "aria": "en-US-AriaNeural",
    "female_alt": "en-US-JennyNeural",  # Natural friendly female voice
    "jenny": "en-US-JennyNeural",
    "female_uk": "en-GB-SoniaNeural",   # Elegant British female voice
    "male": "en-US-GuyNeural",          # Calm, crisp natural male voice
    "guy": "en-US-GuyNeural",
}


def detect_script(text: str) -> str:
    if any('\u0c00' <= char <= '\u0c7f' for char in text):
        return 'te'
    if any('\u0900' <= char <= '\u097f' for char in text):
        return 'hi'
    return 'en'


class NeuralTTSEngine:
    """Microsoft Edge & Cloud Neural TTS engine supporting English, Hindi, and Telugu speech synthesis."""

    def __init__(self, default_voice: str = "en-US-AriaNeural"):
        self.default_voice = default_voice

    async def synthesize_bytes(self, text: str, voice: Optional[str] = None, language: Optional[str] = None) -> Optional[bytes]:
        """Synthesizes text into high quality audio bytes with automatic language voice routing."""
        text = text.strip()
        if not text:
            return None

        # Determine gender preference from active voice preset
        chosen_voice = voice or self.default_voice
        is_male = "guy" in chosen_voice.lower() or "male" in chosen_voice.lower() or "david" in chosen_voice.lower()
        gender = "male" if is_male else "female"

        # Determine target language: explicit parameter or script auto-detect
        lang = (language or "").lower().strip()
        if not lang or lang not in ["en", "hi", "te"]:
            lang = detect_script(text)

        # 1. Telugu Neural Synthesis (Google Cloud TTS or Edge-TTS)
        if lang == "te":
            from .telugu_tts import telugu_tts
            data = await telugu_tts.synthesize(text, gender=gender)
            if data:
                return data

        # 2. Hindi Neural Synthesis (Edge-TTS Swara / Madhur)
        elif lang == "hi":
            hindi_voice = "hi-IN-MadhurNeural" if gender == "male" else "hi-IN-SwaraNeural"
            try:
                import edge_tts
                communicate = edge_tts.Communicate(text, hindi_voice)
                audio_buffer = io.BytesIO()
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_buffer.write(chunk["data"])
                data = audio_buffer.getvalue()
                if len(data) > 0:
                    logger.info(f"Synthesized {len(data)} bytes with Hindi Neural Voice '{hindi_voice}'")
                    return data
            except Exception as e:
                logger.warning(f"Edge-TTS Hindi synthesis error ({e}).")

        # 3. English or Primary Edge-TTS
        try:
            import edge_tts
            communicate = edge_tts.Communicate(text, chosen_voice)
            audio_buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_buffer.write(chunk["data"])

            data = audio_buffer.getvalue()
            if len(data) > 0:
                logger.info(f"Synthesized {len(data)} bytes with Neural Voice '{chosen_voice}'")
                return data
        except Exception as e:
            logger.warning(f"Edge-TTS neural synthesis error ({e}). Falling back to SAPI5.")

        # 4. Local Windows SAPI5 Fallback with female voice preference
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._synthesize_sapi5, text, chosen_voice)

    def _synthesize_sapi5(self, text: str, voice_hint: str) -> Optional[bytes]:
        temp_wav = None
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty("rate", 170)
            engine.setProperty("volume", 1.0)

            # Try finding a female voice on Windows (e.g. Zira)
            voices = engine.getProperty("voices")
            is_female = "female" in voice_hint.lower() or "aria" in voice_hint.lower() or "jenny" in voice_hint.lower()

            for v in voices:
                v_name = (v.name or "").lower()
                if is_female and ("zira" in v_name or "female" in v_name or "hazel" in v_name):
                    engine.setProperty("voice", v.id)
                    break
                elif not is_female and ("david" in v_name or "male" in v_name):
                    engine.setProperty("voice", v.id)
                    break

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                temp_wav = f.name

            engine.save_to_file(text, temp_wav)
            engine.runAndWait()

            if os.path.exists(temp_wav) and os.path.getsize(temp_wav) > 0:
                with open(temp_wav, "rb") as f:
                    return f.read()
            return None
        except Exception as e:
            logger.error(f"SAPI5 synthesis error: {e}")
            return None
        finally:
            if temp_wav and os.path.exists(temp_wav):
                try:
                    os.remove(temp_wav)
                except Exception:
                    pass


neural_tts = NeuralTTSEngine()
