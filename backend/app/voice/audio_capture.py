import asyncio
import logging
import threading
import numpy as np
from typing import Optional

from .wake_word import wake_word_detector
from .vad import vad_detector
from .stt import stt_engine
from ..websocket_manager import ws_manager

logger = logging.getLogger("Snowman.AudioCapture")


class AudioCaptureService:
    """Continuous microphone capture listener for wake-word and hands-free voice interaction."""

    def __init__(self, sample_rate: int = 16000, block_size: int = 1280):
        self.sample_rate = sample_rate
        self.block_size = block_size
        self.is_running = False
        self.thread: Optional[threading.Thread] = None
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.stream = None

    def start(self, event_loop: asyncio.AbstractEventLoop):
        """Starts the microphone capture thread."""
        if self.is_running:
            return
        self.loop = event_loop
        self.is_running = True
        self.thread = threading.Thread(target=self._run_capture_loop, daemon=True)
        self.thread.start()
        logger.info("Background microphone capture service started.")

    def stop(self):
        """Stops the audio capture service."""
        self.is_running = False
        if self.stream is not None:
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass
            self.stream = None
        logger.info("Audio capture service stopped.")

    def _run_capture_loop(self):
        try:
            import sounddevice as sd
        except ImportError:
            logger.warning("sounddevice not installed. Voice microphone capture disabled.")
            return
        except Exception as e:
            logger.warning(f"Failed to load audio devices: {e}")
            return

        def audio_callback(indata, frames, time_info, status):
            if status:
                logger.debug(f"Audio stream status: {status}")
            if not self.is_running:
                return

            # Convert to 1D float32 and int16
            audio_f32 = indata[:, 0].copy()
            audio_i16 = (audio_f32 * 32767).astype(np.int16)

            # Check assistant state
            current_state = ws_manager.current_state

            # If assistant is currently thinking or speaking, ignore all microphone audio
            # and reset VAD buffers so Snowman's own TTS output is never re-captured!
            if current_state in ["thinking", "speaking"]:
                vad_detector.reset()
                return

            # 1. When IDLE: Listen for wake word
            if current_state == "idle":
                if wake_word_detector.process_frame(audio_i16):
                    logger.info("Wake word detected! Switching to listening state.")
                    ws_manager.current_state = "listening"
                    if self.loop and not self.loop.is_closed():
                        asyncio.run_coroutine_threadsafe(
                            ws_manager.set_state("listening", "happy"),
                            self.loop
                        )
                    vad_detector.reset()

            # 2. When LISTENING: Track user speech via VAD
            elif current_state == "listening":
                speech_result = vad_detector.process_chunk(audio_f32)
                if speech_result is not None:
                    # Speech segment finished! Immediately switch state so subsequent frames are not processed
                    ws_manager.current_state = "thinking"
                    vad_detector.reset()
                    logger.info("Speech finished, beginning transcription...")
                    if self.loop and not self.loop.is_closed():
                        asyncio.run_coroutine_threadsafe(
                            self._handle_completed_speech(speech_result),
                            self.loop
                        )

        try:
            self.stream = sd.InputStream(
                samplerate=self.sample_rate,
                blocksize=self.block_size,
                channels=1,
                dtype="float32",
                callback=audio_callback
            )
            with self.stream:
                logger.info("Microphone stream active. Listening for wake word...")
                while self.is_running:
                    sd.sleep(100)
        except Exception as e:
            logger.warning(f"Could not open microphone stream: {e}. Text-only mode remains active.")

    async def _handle_completed_speech(self, audio_data: np.ndarray):
        """Transcribes speech and passes to LLM processing."""
        from ..main import process_user_input

        await ws_manager.set_state("thinking")
        # Transcribe in a thread pool to avoid blocking asyncio loop
        loop = asyncio.get_running_loop()
        transcript, detected_lang = await loop.run_in_executor(None, stt_engine.transcribe, audio_data)

        if transcript and len(transcript.strip()) > 0:
            logger.info(f"User utterance [{detected_lang}]: {transcript}")
            await process_user_input(transcript, source="microphone_vad", language=detected_lang)
        else:
            logger.info("No clear speech transcribed, returning to idle.")
            await ws_manager.set_state("idle", "neutral")


audio_capture_service = AudioCaptureService()
