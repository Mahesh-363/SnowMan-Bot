import io
import base64
import logging
import httpx
from typing import Optional
from ..config import settings

logger = logging.getLogger("Snowman.TeluguTTS")

# Neural voices for Telugu
EDGE_TELUGU_VOICES = {
    "female": "te-IN-ShrutiNeural",
    "male": "te-IN-MohanNeural",
}

GOOGLE_TELUGU_VOICES = {
    "female": "te-IN-Standard-A",
    "male": "te-IN-Standard-B",
}


class TeluguTTSEngine:
    """
    Dedicated Telugu Text-to-Speech engine supporting:
    1. Google Cloud Text-to-Speech API (te-IN-Standard-A/B via free API key in settings)
    2. Free Edge-TTS fallback (te-IN-ShrutiNeural / te-IN-MohanNeural, zero cost, no key required)
    """

    async def synthesize(self, text: str, gender: str = "female") -> Optional[bytes]:
        """Synthesizes Telugu text into MP3/audio bytes."""
        text = text.strip()
        if not text:
            return None

        # 1. Primary: Google Cloud Text-to-Speech (if API key provided)
        if settings.GOOGLE_TTS_API_KEY:
            try:
                data = await self._synthesize_google_cloud(text, gender)
                if data:
                    logger.info(f"Synthesized {len(data)} bytes via Google Cloud TTS (te-IN).")
                    return data
            except Exception as e:
                logger.warning(f"Google Cloud TTS failed ({e}). Falling back to Edge-TTS.")

        # 2. Resilient Zero-Cost Fallback: Edge-TTS
        try:
            data = await self._synthesize_edge_tts(text, gender)
            if data:
                logger.info(f"Synthesized {len(data)} bytes via Edge-TTS (te-IN-ShrutiNeural).")
                return data
        except Exception as e:
            logger.warning(f"Edge-TTS Telugu synthesis error: {e}")

        return None

    async def _synthesize_google_cloud(self, text: str, gender: str = "female") -> Optional[bytes]:
        api_key = settings.GOOGLE_TTS_API_KEY
        if not api_key:
            return None

        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
        voice_name = GOOGLE_TELUGU_VOICES.get(gender.lower(), "te-IN-Standard-A")

        payload = {
            "input": {"text": text},
            "voice": {
                "languageCode": "te-IN",
                "name": voice_name,
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": 1.0,
                "pitch": 0.0,
            },
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                audio_b64 = res.json().get("audioContent")
                if audio_b64:
                    return base64.b64decode(audio_b64)
            else:
                logger.warning(f"Google TTS API returned status {res.status_code}: {res.text}")
        return None

    async def _synthesize_edge_tts(self, text: str, gender: str = "female") -> Optional[bytes]:
        import edge_tts

        voice = EDGE_TELUGU_VOICES.get(gender.lower(), "te-IN-ShrutiNeural")
        communicate = edge_tts.Communicate(text, voice)
        buffer = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buffer.write(chunk["data"])

        result = buffer.getvalue()
        return result if len(result) > 0 else None


telugu_tts = TeluguTTSEngine()
