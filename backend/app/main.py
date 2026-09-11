import os
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import settings, get_allowlist_config, save_allowlist_config, get_sites_mapping, update_settings
from .websocket_manager import ws_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("Snowman.App")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Snowman Backend starting up...")
    logger.info(f"Host: {settings.HOST}:{settings.PORT}")
    logger.info(f"LLM Provider: {settings.LLM_PROVIDER}")
    logger.info(f"Assistant Name: {settings.ASSISTANT_NAME}")
    
    try:
        from .voice.audio_capture import audio_capture_service
        audio_capture_service.start(asyncio.get_running_loop())
    except Exception as e:
        logger.warning(f"Audio capture background service note: {e}")

    yield

    try:
        from .voice.audio_capture import audio_capture_service
        audio_capture_service.stop()
    except Exception:
        pass

    logger.info("Snowman Backend shutting down...")


app = FastAPI(
    title="Snowman Desktop Voice Assistant Backend",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Vercel web frontend, local development, and custom domains
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
custom_origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=custom_origins or ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    text: str


class ConfigUpdateRequest(BaseModel):
    settings: Dict[str, Any]


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "Snowman Desktop AI Voice Assistant",
        "state": ws_manager.current_state,
        "emotion": ws_manager.current_emotion,
    }


@app.get("/api/config")
async def get_config():
    from .tts.neural_tts import neural_tts
    return {
        "assistant_name": settings.ASSISTANT_NAME,
        "llm_provider": settings.LLM_PROVIDER,
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL,
        "groq_model": settings.GROQ_MODEL,
        "has_groq_key": bool(settings.GROQ_API_KEY),
        "openai_model": settings.OPENAI_MODEL,
        "has_openai_key": bool(settings.OPENAI_API_KEY),
        "whisper_model_size": settings.WHISPER_MODEL_SIZE,
        "wake_word": settings.WAKE_WORD,
        "wake_word_engine": settings.WAKE_WORD_ENGINE,
        "always_on_top": settings.ALWAYS_ON_TOP,
        "default_window_mode": settings.DEFAULT_WINDOW_MODE,
        "tts_voice": neural_tts.default_voice,
        "allowlist": get_allowlist_config(),
        "sites_mapping": get_sites_mapping(),
    }


class VoiceChangeRequest(BaseModel):
    voice: str


@app.post("/api/voice")
async def set_voice(req: VoiceChangeRequest):
    from .tts.neural_tts import neural_tts, VOICE_PRESETS
    chosen = VOICE_PRESETS.get(req.voice.lower(), req.voice)
    neural_tts.default_voice = chosen
    logger.info(f"Updated default TTS voice to: {chosen}")
    return {"status": "success", "voice": chosen}


@app.post("/api/config")
async def save_config(req: ConfigUpdateRequest):
    updated = update_settings(req.settings)
    await ws_manager.broadcast_json({
        "type": "config_updated",
        "assistant_name": updated.ASSISTANT_NAME
    })
    return {"status": "success", "updated": True}


@app.get("/api/allowlist")
async def get_allowlist():
    return get_allowlist_config()


@app.post("/api/allowlist")
async def save_allowlist(data: Dict[str, Any]):
    success = save_allowlist_config(data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save allowlist")
    await ws_manager.broadcast_json({
        "type": "allowlist_updated",
        "allowlist": data
    })
    return {"status": "success"}


import time
import re

_last_processed_norm = ""
_last_processed_time = 0.0
_pipeline_lock = asyncio.Lock()


def normalize_command_text(text: str) -> str:
    """Strips punctuation, lowercases, and normalizes whitespace."""
    cleaned = re.sub(r'[^\w\s]', '', text)
    return re.sub(r'\s+', ' ', cleaned).strip().lower()


# Message handler with strict pipeline locking, deduplication, and stage logging
async def process_user_input(text: str, source: str = "voice", language: Optional[str] = None):
    """Entry point for processing user input with centralized pipeline locking and multilingual routing."""
    global _last_processed_norm, _last_processed_time
    from .brain.llm import llm_client
    from .actions.system_control import execute_tool
    from .tts.piper_engine import tts_engine
    from .brain.memory import conversation_memory
    from .voice.stt import detect_script_language

    raw_text = text.strip()
    if not raw_text:
        return

    user_lang = language or detect_script_language(raw_text)
    norm_text = normalize_command_text(raw_text)
    now = time.time()

    logger.info(f"[PIPELINE:STT] Raw utterance from {source} [{user_lang}]: '{raw_text}' (normalized: '{norm_text}')")

    # Fast-check 4-second time-window debounce for identical commands
    if norm_text == _last_processed_norm and (now - _last_processed_time) < 4.0:
        logger.info(f"[PIPELINE:DEBOUNCE] Dropped duplicate command '{raw_text}' (normalized: '{norm_text}') - previously processed {now - _last_processed_time:.2f}s ago")
        return

    # Acquire pipeline processing lock so actions and TTS never overlap or run twice
    async with _pipeline_lock:
        now = time.time()
        # Second debounce check after lock acquisition (to catch twin requests that were queued)
        if norm_text == _last_processed_norm and (now - _last_processed_time) < 4.0:
            logger.info(f"[PIPELINE:DEBOUNCE] Dropped queued duplicate '{raw_text}' (normalized: '{norm_text}')")
            return

        _last_processed_norm = norm_text
        _last_processed_time = now

        logger.info(f"[PIPELINE:LOCK] Processing lock acquired for: '{norm_text}'")

        # Stop any active TTS audio from prior utterance
        tts_engine.stop_current_speech()
        current_gen = tts_engine.current_generation_id

        # Broadcast user transcript with detected language
        await ws_manager.send_transcript(role="user", text=raw_text, is_final=True, language=user_lang)
        await ws_manager.set_state("thinking")

        # Record to conversation memory
        await conversation_memory.add_message("user", raw_text)

        try:
            # Retrieve recent context
            history = await conversation_memory.get_recent_context(limit=6)
            
            # Invoke LLM Brain (with instant fast-path for system commands & greetings)
            logger.info(f"[PIPELINE:LLM] Generating response for '{norm_text}' [{user_lang}]...")
            response = await llm_client.generate_response(user_input=raw_text, history=history)

            reply_text = response.get("reply_text")
            reply_lang = response.get("detected_language") or user_lang or "en"

            # Guarantee non-empty reply_text for conversational inputs
            if not reply_text or not str(reply_text).strip():
                logger.warning("[PIPELINE:FALLBACK] Empty reply_text from LLM brain, substituting default acknowledgment.")
                if reply_lang == "te":
                    reply_text = "నమస్కారం! నేను మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను."
                elif reply_lang == "hi":
                    reply_text = "नमस्ते! मैं आपकी सहायता के लिए तैयार हूँ।"
                else:
                    reply_text = "Hello! I am here and ready to help you."

            reply_text = str(reply_text).strip()
            emotion = response.get("emotion_tag", "neutral")
            tool_call = response.get("tool_call")

            logger.info(f"[PIPELINE:LLM_RESULT] Reply [{reply_lang}]: '{reply_text}' | Emotion: {emotion} | Tool: {tool_call}")

            # Execute web action if requested
            action_result = None
            if tool_call and isinstance(tool_call, dict) and "name" in tool_call:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("arguments", {})
                logger.info(f"[PIPELINE:ACTION] Executing tool '{tool_name}' with args {tool_args}")
                action_result = await execute_tool(tool_name, tool_args)
                
                logger.info(f"[PIPELINE:ACTION_RESULT] Tool '{tool_name}' status: {action_result.get('status')} - {action_result.get('message')}")
                # Send action result
                await ws_manager.send_system_action_result(
                    tool_name=tool_name,
                    status=action_result.get("status", "unknown"),
                    message=action_result.get("message", ""),
                    details=action_result
                )

            # Broadcast assistant response with detected language
            await ws_manager.send_llm_reply(
                text=reply_text,
                emotion=emotion,
                tool_call=tool_call,
                language=reply_lang
            )

            # Record assistant reply to memory
            await conversation_memory.add_message("assistant", reply_text, emotion=emotion)

            # Speak the response using Neural TTS with language routing
            logger.info(f"[PIPELINE:TTS_TRIGGER] Speaking [{reply_lang}]: '{reply_text}' (Gen ID: {current_gen})")
            await ws_manager.set_state("speaking", emotion=emotion)
            await tts_engine.speak_and_stream(reply_text, generation_id=current_gen, language=reply_lang)
            logger.info(f"[PIPELINE:TTS_DONE] Speech complete for Gen ID: {current_gen}")

        except Exception as e:
            logger.exception(f"[PIPELINE:ERROR] Error processing user input: {e}")
            err_msg = f"I encountered an issue: {str(e)}"
            await ws_manager.send_llm_reply(text=err_msg, emotion="confused", language="en")
            await tts_engine.speak_and_stream(err_msg, generation_id=current_gen, language="en")
        finally:
            if tts_engine.current_generation_id == current_gen:
                await ws_manager.set_state("idle", emotion="neutral")
            logger.info(f"[PIPELINE:LOCK] Processing lock released for: '{norm_text}'")


@app.post("/api/chat")
async def chat_http(req: ChatRequest):
    # Process asynchronously
    asyncio.create_task(process_user_input(req.text, source="http"))
    return {"status": "processing"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type", "")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                elif msg_type == "chat":
                    user_text = msg.get("text", "")
                    user_lang = msg.get("language")
                    asyncio.create_task(process_user_input(user_text, source="websocket", language=user_lang))

                elif msg_type == "set_state":
                    new_state = msg.get("state", "idle")
                    new_emotion = msg.get("emotion")
                    await ws_manager.set_state(new_state, new_emotion)

                elif msg_type == "get_status":
                    await websocket.send_json({
                        "type": "status",
                        "state": ws_manager.current_state,
                        "emotion": ws_manager.current_emotion,
                        "assistant_name": settings.ASSISTANT_NAME
                    })

                elif msg_type == "test_speak":
                    text = msg.get("text", "Hello! I am Snowman, your desktop AI assistant.")
                    from .tts.piper_engine import tts_engine
                    await ws_manager.set_state("speaking", "happy")
                    asyncio.create_task(tts_engine.speak_and_stream(text))

            except json.JSONDecodeError:
                logger.warning(f"Received non-JSON websocket message: {data}")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
