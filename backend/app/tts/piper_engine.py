import os
import io
import wave
import base64
import asyncio
import logging
import subprocess
from typing import Optional, AsyncGenerator

from ..config import settings
from ..websocket_manager import ws_manager
from .fallback_tts import fallback_tts

logger = logging.getLogger("Snowman.PiperTTS")


class PiperTTSEngine:
    """Piper neural TTS synthesizer with chunked audio streaming over WebSocket."""

    def __init__(self):
        self.model_path = settings.PIPER_MODEL_PATH
        self.config_path = settings.PIPER_CONFIG_PATH
        self.chunk_size = 8192  # 8KB chunks for low-latency streaming
        self.current_generation_id = 0

    def is_piper_ready(self) -> bool:
        return os.path.exists(self.model_path) and os.path.exists(self.config_path)

    def stop_current_speech(self):
        """Invalidates current generation so active streaming halts immediately."""
        self.current_generation_id += 1
        logger.info(f"Speech invalidated. New generation ID: {self.current_generation_id}")

    async def speak_and_stream(self, text: str, generation_id: Optional[int] = None, language: Optional[str] = None):
        """Synthesizes speech and streams audio chunks over WebSocket."""
        text = text.strip()
        if not text:
            logger.warning("[PIPELINE:TTS] Received empty text, speaking fallback acknowledgment.")
            text = "I am here."

        if generation_id is None:
            self.current_generation_id += 1
            gen_id = self.current_generation_id
        else:
            gen_id = generation_id

        # 1. Primary: High-fidelity Neural Voice (Studio Quality, Multilingual Support)
        try:
            from .neural_tts import neural_tts
            audio_bytes = await neural_tts.synthesize_bytes(text, language=language)
        except Exception as e:
            logger.warning(f"Neural TTS primary error: {e}")
            audio_bytes = None

        # Check if generation was superseded while synthesizing
        if self.current_generation_id != gen_id:
            logger.info(f"Synthesis for generation {gen_id} cancelled (current is {self.current_generation_id}).")
            return

        # 2. Try Piper TTS if neural TTS was unavailable and local piper onnx exists
        if not audio_bytes and self.is_piper_ready():
            try:
                loop = asyncio.get_running_loop()
                audio_bytes = await loop.run_in_executor(None, self._synthesize_piper, text)
            except Exception as e:
                logger.warning(f"Piper synthesis error ({e}). Using fallback TTS.")
                audio_bytes = None

        # 3. Fallback to Windows SAPI5 if both above failed
        if not audio_bytes and settings.USE_FALLBACK_TTS:
            loop = asyncio.get_running_loop()
            audio_bytes = await loop.run_in_executor(None, fallback_tts.synthesize_wav_bytes, text)

        if not audio_bytes:
            logger.error("All TTS engines failed to generate audio.")
            return

        # Check generation again before streaming
        if self.current_generation_id != gen_id:
            return

        # 4. Stream audio chunks over WebSocket to frontend for lip-sync playback
        total_len = len(audio_bytes)
        num_chunks = (total_len + self.chunk_size - 1) // self.chunk_size

        logger.info(f"Streaming {total_len} bytes of audio in {num_chunks} chunks (Gen {gen_id})...")
        
        for i in range(num_chunks):
            # If newer generation started, abort immediately!
            if self.current_generation_id != gen_id:
                logger.info(f"Audio stream {gen_id} aborted by newer generation {self.current_generation_id}.")
                return

            start = i * self.chunk_size
            end = min(start + self.chunk_size, total_len)
            chunk = audio_bytes[start:end]
            base64_str = base64.b64encode(chunk).decode("utf-8")

            is_first = (i == 0)
            is_last = (i == num_chunks - 1)

            await ws_manager.send_audio_chunk(
                base64_chunk=base64_str,
                is_first=is_first,
                is_last=is_last,
                generation_id=gen_id
            )
            # Brief yield to keep event loop responsive
            await asyncio.sleep(0.01)

    def _synthesize_piper(self, text: str) -> Optional[bytes]:
        """Runs piper subprocess to generate WAV audio bytes."""
        try:
            # Check if piper executable or python module is available
            cmd = [
                "piper",
                "--model", self.model_path,
                "--config", self.config_path,
                "--output_raw"
            ]
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            raw_pcm, stderr = process.communicate(input=text.encode("utf-8"), timeout=15)

            if process.returncode == 0 and len(raw_pcm) > 0:
                # Wrap raw 22050Hz 16-bit mono PCM into standard WAV
                wav_buffer = io.BytesIO()
                with wave.open(wav_buffer, "wb") as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)
                    wav_file.setframerate(22050)
                    wav_file.writeframes(raw_pcm)
                return wav_buffer.getvalue()
            else:
                logger.warning(f"Piper returned code {process.returncode}: {stderr.decode('utf-8', errors='ignore')}")
                return None
        except Exception as e:
            logger.warning(f"Piper execution exception: {e}")
            return None


tts_engine = PiperTTSEngine()
