import os
import json
from pathlib import Path
from typing import Optional, List, Dict, Any

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CONFIG_DIR = BASE_DIR / "config"
MODELS_DIR = BASE_DIR / "models"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)


try:
    from pydantic_settings import BaseSettings
    from pydantic import Field

    class Settings(BaseSettings):
        # Server
        HOST: str = "0.0.0.0"
        PORT: int = 8765

        # Assistant Identity
        ASSISTANT_NAME: str = "Snowman"
        SYSTEM_PERSONA: str = (
            "You are Snowman, an intelligent, helpful, slightly witty multilingual AI voice assistant. "
            "You speak English, Hindi, and Telugu. Keep answers conversational, natural, and concise (1-3 sentences) "
            "for smooth voice synthesis. When asked to perform a web action, confirm it gracefully."
        )

        # LLM Settings
        LLM_PROVIDER: str = "ollama"  # "ollama", "groq", or "openai"
        OLLAMA_BASE_URL: str = "http://localhost:11434"
        OLLAMA_MODEL: str = "llama3"

        GROQ_API_KEY: Optional[str] = None
        GROQ_MODEL: str = "openai/gpt-oss-120b"

        OPENAI_API_KEY: Optional[str] = None
        OPENAI_MODEL: str = "gpt-4o-mini"

        # STT Settings (Multilingual faster-whisper)
        WHISPER_MODEL_SIZE: str = "base"
        WHISPER_DEVICE: str = "cpu"
        WHISPER_COMPUTE_TYPE: str = "int8"

        # Wake Word & VAD Settings
        WAKE_WORD_ENGINE: str = "openwakeword"  # "openwakeword" or "porcupine"
        WAKE_WORD: str = "Snowman"
        WAKE_WORD_SENSITIVITY: float = 0.5
        PORCUPINE_ACCESS_KEY: Optional[str] = None
        VAD_THRESHOLD: float = 0.5
        SILENCE_DURATION_MS: int = 1000

        # TTS Settings
        PIPER_MODEL_PATH: str = str(MODELS_DIR / "en_US-lessac-medium.onnx")
        PIPER_CONFIG_PATH: str = str(MODELS_DIR / "en_US-lessac-medium.onnx.json")
        USE_FALLBACK_TTS: bool = True
        GOOGLE_TTS_API_KEY: Optional[str] = None

        # Memory & Database
        SQLITE_DB_PATH: str = str(DATA_DIR / "conversations.db")
        REDIS_URL: str = "redis://localhost:6379/0"
        USE_REDIS: bool = False

        # Window & UI Defaults
        ALWAYS_ON_TOP: bool = False
        DEFAULT_WINDOW_MODE: str = "fullscreen"  # "fullscreen" or "overlay"

        class Config:
            env_file = [str(BASE_DIR / ".env"), str(BASE_DIR.parent / ".env")]
            env_file_encoding = "utf-8"
            extra = "ignore"

except ImportError:
    class Settings:
        HOST: str = os.getenv("HOST", "0.0.0.0")
        PORT: int = int(os.getenv("PORT", "8765"))
        ASSISTANT_NAME: str = os.getenv("ASSISTANT_NAME", "Snowman")
        SYSTEM_PERSONA: str = os.getenv(
            "SYSTEM_PERSONA",
            "You are Snowman, an intelligent, helpful, slightly witty multilingual AI voice assistant. "
            "You speak English, Hindi, and Telugu. Keep answers conversational, natural, and concise (1-3 sentences) "
            "for smooth voice synthesis. When asked to perform a web action, confirm it gracefully."
        )
        LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama")
        OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3")
        GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
        GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
        OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")
        WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
        WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
        WAKE_WORD_ENGINE: str = os.getenv("WAKE_WORD_ENGINE", "openwakeword")
        WAKE_WORD: str = os.getenv("WAKE_WORD", "Snowman")
        WAKE_WORD_SENSITIVITY: float = float(os.getenv("WAKE_WORD_SENSITIVITY", "0.5"))
        PORCUPINE_ACCESS_KEY: Optional[str] = os.getenv("PORCUPINE_ACCESS_KEY")
        VAD_THRESHOLD: float = float(os.getenv("VAD_THRESHOLD", "0.5"))
        SILENCE_DURATION_MS: int = int(os.getenv("SILENCE_DURATION_MS", "1000"))
        PIPER_MODEL_PATH: str = os.getenv("PIPER_MODEL_PATH", str(MODELS_DIR / "en_US-lessac-medium.onnx"))
        PIPER_CONFIG_PATH: str = os.getenv("PIPER_CONFIG_PATH", str(MODELS_DIR / "en_US-lessac-medium.onnx.json"))
        USE_FALLBACK_TTS: bool = os.getenv("USE_FALLBACK_TTS", "true").lower() == "true"
        GOOGLE_TTS_API_KEY: Optional[str] = os.getenv("GOOGLE_TTS_API_KEY")
        SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", str(DATA_DIR / "conversations.db"))
        REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        USE_REDIS: bool = os.getenv("USE_REDIS", "false").lower() == "true"
        ALWAYS_ON_TOP: bool = os.getenv("ALWAYS_ON_TOP", "false").lower() == "true"
        DEFAULT_WINDOW_MODE: str = os.getenv("DEFAULT_WINDOW_MODE", "fullscreen")



settings = Settings()


def get_allowlist_config() -> Dict[str, Any]:
    allowlist_file = CONFIG_DIR / "allowlist.json"
    if allowlist_file.exists():
        try:
            with open(allowlist_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Config] Error loading allowlist.json: {e}")
    return {"allowed_applications": [], "allowed_domains": [], "allow_all_search_queries": True}


def save_allowlist_config(data: Dict[str, Any]) -> bool:
    allowlist_file = CONFIG_DIR / "allowlist.json"
    try:
        with open(allowlist_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"[Config] Error saving allowlist.json: {e}")
        return False


def get_sites_mapping() -> Dict[str, str]:
    sites_file = CONFIG_DIR / "sites_mapping.json"
    if sites_file.exists():
        try:
            with open(sites_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Config] Error loading sites_mapping.json: {e}")
    return {}


def update_settings(new_values: Dict[str, Any]) -> Settings:
    global settings
    env_file = BASE_DIR / ".env"
    existing_lines = []
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            existing_lines = f.readlines()

    normalized_updates = {}
    for k, v in new_values.items():
        k_upper = k.strip().upper()
        normalized_updates[k_upper] = v
        # Ensure os.environ is updated immediately for runtime access
        if v is not None:
            os.environ[k_upper] = str(v)
        else:
            os.environ.pop(k_upper, None)

    keys_to_update = set(normalized_updates.keys())
    new_lines = []
    found_keys = set()

    for line in existing_lines:
        line_clean = line.strip()
        if "=" in line_clean and not line_clean.startswith("#"):
            k, _ = line_clean.split("=", 1)
            k_upper = k.strip().upper()
            if k_upper in keys_to_update:
                val = normalized_updates[k_upper]
                new_lines.append(f"{k_upper}={val}\n")
                found_keys.add(k_upper)
                continue
        new_lines.append(line)

    for k in keys_to_update - found_keys:
        val = normalized_updates[k]
        new_lines.append(f"{k}={val}\n")

    with open(env_file, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    # Reinitialize settings and ensure in-memory attributes are immediately current
    settings = Settings()
    for k, v in normalized_updates.items():
        setattr(settings, k, v)
    return settings
