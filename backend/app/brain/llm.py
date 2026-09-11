import re
import json
import logging
import httpx
from typing import Dict, Any, List, Optional
from ..config import settings
from .prompts import build_system_prompt

logger = logging.getLogger("Snowman.LLM")


class LLMClient:
    """Multi-provider LLM Client supporting Ollama, Groq, and OpenAI with structured JSON outputs."""

    def __init__(self):
        self.timeout = 30.0

    async def generate_response(self, user_input: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """Calls the configured LLM provider and parses structured JSON output."""
        text_clean = re.sub(r'[^\w\s]', '', user_input).strip().lower()

        # Fast-track 1: Direct system commands (open apps, sites, searches, system info) execute in < 1ms
        fast_match = self._match_offline_intent(user_input)
        if fast_match.get("tool_call") is not None:
            logger.info(f"Fast-path matched tool action for '{user_input}': {fast_match['tool_call']['name']}")
            return fast_match

        # Fast-track 2: Instant Conversational Greetings & Identity queries
        greeting_patterns = [
            r"^(?:hi|hello|hey|greetings|howdy|sup|yo|hiya)(?:\s+there|\s+snowman)?$",
            r"^good\s+(?:morning|afternoon|evening|day)(?:\s+snowman)?$",
            r"^how\s+are\s+you(?:\s+doing)?$",
            r"^how(?:s|\s+is)\s+it\s+going$",
            r"^(?:who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do)$",
            r"(?:నమస్కారం|బాగున్నారా|ఎలా\s+ఉన్నారు|नमस्ते|नमस्कार|कैसे\s+हो)",
        ]
        if any(re.search(p, text_clean) for p in greeting_patterns) or any(re.search(p, user_input) for p in greeting_patterns):
            logger.info(f"Fast-path matched greeting for '{user_input}'")
            return self._get_greeting_response(text_clean, raw_input=user_input)

        provider = settings.LLM_PROVIDER.lower().strip()
        system_prompt = build_system_prompt()

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for item in history:
                messages.append({"role": item["role"], "content": item["content"]})
        messages.append({"role": "user", "content": user_input})

        raw_response = None
        try:
            if provider == "groq" and settings.GROQ_API_KEY:
                raw_response = await self._call_groq(messages)
            elif provider == "openai" and settings.OPENAI_API_KEY:
                raw_response = await self._call_openai(messages)
            else:
                # Default to Ollama (local) with fast connect timeout
                raw_response = await self._call_ollama(messages)

        except Exception as e:
            logger.error(f"Error invoking LLM provider '{provider}': {e}")
            # Try graceful fallback if Ollama or primary provider failed
            if provider != "groq" and settings.GROQ_API_KEY:
                logger.info("Falling back to Groq...")
                try:
                    raw_response = await self._call_groq(messages)
                except Exception as ex:
                    logger.error(f"Fallback to Groq also failed: {ex}")

        if not raw_response:
            # Intelligent offline fallback
            return fast_match

        parsed = self._parse_structured_json(raw_response)
        # Guarantee non-empty conversational reply_text
        if not parsed.get("reply_text") or not str(parsed["reply_text"]).strip():
            parsed["reply_text"] = "Hello! I am here and ready to help you."
        return parsed

    def _get_greeting_response(self, text_clean: str, raw_input: str = "") -> Dict[str, Any]:
        """Provides instant, friendly, and non-empty responses for greetings in EN, HI, TE."""
        is_telugu = any('\u0c00' <= c <= '\u0c7f' for c in raw_input) or "నమస్కారం" in raw_input or "ఎలా ఉన్నారు" in raw_input
        is_hindi = any('\u0900' <= c <= '\u097f' for c in raw_input) or "नमस्ते" in raw_input or "कैसे हो" in raw_input

        if is_telugu:
            return {
                "reply_text": "నమస్కారం! నేను స్నోమన్, మీ ఏఐ వాయిస్ అసిస్టెంట్. నేను మీకు ఎలా సహాయపడగలను?",
                "emotion_tag": "happy",
                "tool_call": None,
                "detected_language": "te"
            }
        elif is_hindi:
            return {
                "reply_text": "नमस्ते! मैं स्नोमैन हूँ, आपका एआई वॉयस असिस्टेंट। मैं आपकी क्या सहायता कर सकता हूँ?",
                "emotion_tag": "happy",
                "tool_call": None,
                "detected_language": "hi"
            }

        if "how are you" in text_clean or "hows it going" in text_clean:
            reply = "I'm doing great, thank you for asking! How can I help you today?"
            emotion = "happy"
        elif "good morning" in text_clean:
            reply = "Good morning! I hope you have a fantastic day ahead. How can I assist you?"
            emotion = "happy"
        elif "good evening" in text_clean or "good afternoon" in text_clean:
            reply = "Good evening! I'm here and ready to help. What's on your mind?"
            emotion = "happy"
        elif "who are you" in text_clean or "your name" in text_clean:
            reply = "I am Snowman, your intelligent AI voice assistant. I can open websites, search the web, or chat with you."
            emotion = "happy"
        elif "what can you do" in text_clean or "help" in text_clean:
            reply = "I can open websites, search the web, answer your questions in English, Hindi, and Telugu, and chat naturally."
            emotion = "neutral"
        else:
            reply = "Hello! I am here and ready to assist. What would you like to do?"
            emotion = "happy"

        return {
            "reply_text": reply,
            "emotion_tag": emotion,
            "tool_call": None,
            "detected_language": "en"
        }

    def _match_offline_intent(self, user_input: str) -> Dict[str, Any]:
        """Pattern matches common commands when LLM server is offline or not configured."""
        text = user_input.strip().lower()

        # 1. Web Search
        search_match = re.search(r"^(?:search\s+(?:for\s+)?|google\s+|find\s+)(.+)", text)
        if search_match:
            query = search_match.group(1).strip()
            return {
                "reply_text": f"Searching the web for {query}.",
                "emotion_tag": "neutral",
                "tool_call": {"name": "web_search", "arguments": {"query": query}},
                "detected_language": "en"
            }

        # 2. Open Specific Popular Sites
        popular_sites = ["youtube", "gmail", "github", "google", "reddit", "twitter", "linkedin", "chatgpt", "claude", "wikipedia"]
        for site in popular_sites:
            if f"open {site}" in text or f"launch {site}" in text or f"go to {site}" in text or text == site:
                return {
                    "reply_text": f"Opening {site.capitalize()} for you.",
                    "emotion_tag": "happy",
                    "tool_call": {"name": "open_specific_site", "arguments": {"site_name": site}},
                    "detected_language": "en"
                }

        # 3. Open Explicit URL
        if "http://" in text or "https://" in text or ".com" in text or ".org" in text:
            url_match = re.search(r"(https?://\S+|\b[a-zA-Z0-9.-]+\.(?:com|org|net|io|edu)\b\S*)", text)
            if url_match:
                target_url = url_match.group(1)
                return {
                    "reply_text": f"Opening {target_url}.",
                    "emotion_tag": "neutral",
                    "tool_call": {"name": "open_website", "arguments": {"url": target_url}},
                    "detected_language": "en"
                }

        # 4. Friendly note for desktop applications or local system commands
        if any(w in text for w in ["open app", "launch app", "close app", "system info", "cpu usage", "battery"]):
            return {
                "reply_text": "In this web version, I can open websites and search the web for you! Say 'open YouTube' or search for any topic.",
                "emotion_tag": "happy",
                "tool_call": None,
                "detected_language": "en"
            }

        # 5. Greetings & Identity
        if any(w in text for w in ["hello", "hi", "hey", "who are you", "what can you do", "what are you"]):
            return {
                "reply_text": "Hello! I am Snowman, your intelligent AI voice assistant. I can open websites, search the web, or chat with you.",
                "emotion_tag": "happy",
                "tool_call": None,
                "detected_language": "en"
            }

        # 6. General fallback explanation
        if settings.GROQ_API_KEY or settings.OPENAI_API_KEY:
            return {
                "reply_text": "I'm right here with you! There was a brief connectivity pause with the AI cloud, but I can still open websites and search the web.",
                "emotion_tag": "neutral",
                "tool_call": None,
                "detected_language": "en"
            }
        return {
            "reply_text": "I heard you! To unlock full AI conversations in English, Hindi, or Telugu, configure a free Groq API key in Settings or run Ollama locally.",
            "emotion_tag": "neutral",
            "tool_call": None,
            "detected_language": "en"
        }

    async def _call_ollama(self, messages: List[Dict[str, str]]) -> Optional[str]:
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.6}
        }
        ollama_timeout = httpx.Timeout(12.0, connect=1.0)
        async with httpx.AsyncClient(timeout=ollama_timeout) as client:
            res = await client.post(url, json=payload)
            res.raise_for_status()
            data = res.json()
            return data.get("message", {}).get("content", "")

    async def _call_groq(self, messages: List[Dict[str, str]]) -> Optional[str]:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        # Multi-model candidate list to guarantee high availability on Groq
        candidates = [settings.GROQ_MODEL]
        for m in ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "groq/compound-mini"]:
            if m not in candidates:
                candidates.append(m)

        last_err = None
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for model_name in candidates:
                payload = {
                    "model": model_name,
                    "messages": messages,
                    "response_format": {"type": "json_object"},
                    "max_tokens": 250,
                    "temperature": 0.6
                }
                try:
                    res = await client.post(url, headers=headers, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        return data["choices"][0]["message"]["content"]
                    else:
                        logger.warning(f"Groq model '{model_name}' status {res.status_code}: {res.text}")
                        last_err = Exception(f"HTTP {res.status_code}: {res.text}")
                except Exception as e:
                    logger.warning(f"Groq call failed with model '{model_name}': {e}")
                    last_err = e

        if last_err:
            raise last_err
        return None

    async def _call_openai(self, messages: List[Dict[str, str]]) -> Optional[str]:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": settings.OPENAI_MODEL,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.6
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"]

    def _parse_structured_json(self, text: str) -> Dict[str, Any]:
        """Safely extracts and validates JSON response from LLM."""
        cleaned = text.strip()
        
        # Remove potential markdown fences
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3].strip()

        try:
            data = json.loads(cleaned)
            reply = data.get("reply_text") or data.get("reply") or data.get("text") or "I understand."
            emotion = data.get("emotion_tag") or data.get("emotion") or "neutral"
            if emotion not in ["neutral", "happy", "confused"]:
                emotion = "neutral"
            tool_call = data.get("tool_call")

            detected_lang = data.get("detected_language")
            if not detected_lang or detected_lang not in ["en", "hi", "te"]:
                if any('\u0c00' <= c <= '\u0c7f' for c in str(reply)):
                    detected_lang = "te"
                elif any('\u0900' <= c <= '\u097f' for c in str(reply)):
                    detected_lang = "hi"
                else:
                    detected_lang = "en"

            return {
                "reply_text": str(reply),
                "emotion_tag": emotion,
                "tool_call": tool_call,
                "detected_language": detected_lang
            }
        except Exception as e:
            logger.warning(f"Could not parse LLM output as strict JSON ({e}). Raw: {text}")
            lang = "en"
            if any('\u0c00' <= c <= '\u0c7f' for c in cleaned):
                lang = "te"
            elif any('\u0900' <= c <= '\u097f' for c in cleaned):
                lang = "hi"
            return {
                "reply_text": cleaned,
                "emotion_tag": "neutral",
                "tool_call": None,
                "detected_language": lang
            }


llm_client = LLMClient()
