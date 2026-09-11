import asyncio
import os
import sys
import unittest

# Ensure backend root is on path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.config import settings, get_allowlist_config, get_sites_mapping
from app.actions.allowlist import allowlist
from app.actions.system_control import SystemControl, execute_tool
from app.brain.prompts import build_system_prompt
from app.brain.llm import llm_client
from app.brain.memory import conversation_memory


from app.main import normalize_command_text


class TestSnowmanBackend(unittest.IsolatedAsyncioTestCase):

    def test_config_loaded(self):
        self.assertEqual(settings.ASSISTANT_NAME, "Snowman")
        allowlist_cfg = get_allowlist_config()
        self.assertIn("allowed_applications", allowlist_cfg)
        self.assertIn("allowed_domains", allowlist_cfg)

    def test_text_normalization(self):
        # Punctuation and casing should be normalized identically
        self.assertEqual(normalize_command_text("Open calculator."), "open calculator")
        self.assertEqual(normalize_command_text("  open   calculator! "), "open calculator")
        self.assertEqual(normalize_command_text("Hi Snowman???"), "hi snowman")

    async def test_greeting_responses(self):
        # Greetings must always yield a non-empty conversational reply
        for phrase in ["hi", "hello", "hey snowman", "good morning", "how are you"]:
            res = await llm_client.generate_response(phrase)
            self.assertTrue(len(res["reply_text"].strip()) > 0, f"Greeting '{phrase}' returned empty reply!")
            self.assertIn(res["emotion_tag"], ["happy", "neutral", "thinking", "confused"])

    def test_allowlist_application(self):
        # Notepad should be allowed
        allowed, exec_name = allowlist.check_application("notepad")
        self.assertTrue(allowed)
        self.assertEqual(exec_name, "notepad.exe")

        # Unknown or malicious app should be blocked
        allowed, exec_name = allowlist.check_application("ransomware.exe")
        self.assertFalse(allowed)
        self.assertIsNone(exec_name)

    def test_allowlist_urls(self):
        # YouTube should be allowed
        self.assertTrue(allowlist.check_url("https://www.youtube.com/watch?v=123"))
        self.assertTrue(allowlist.check_url("github.com/torvalds"))

        # Non-whitelisted site should be blocked
        self.assertFalse(allowlist.check_url("https://malicious-phishing-site.xyz/steal"))

    async def test_system_info_tool(self):
        result = SystemControl.system_info()
        self.assertEqual(result["status"], "success")
        self.assertIn("cpu_percent", result["data"])
        self.assertIn("memory_percent", result["data"])

    async def test_tool_dispatcher(self):
        res = await execute_tool("system_info", {})
        self.assertEqual(res["status"], "success")

        # Blocked action
        res = await execute_tool("open_application", {"app_name": "unauthorized_malware"})
        self.assertEqual(res["status"], "blocked")

    async def test_memory(self):
        await conversation_memory.initialize()
        await conversation_memory.add_message("user", "Hello Snowman!", "neutral")
        await conversation_memory.add_message("assistant", "Hello! How can I assist?", "happy")

        context = await conversation_memory.get_recent_context(limit=2)
        self.assertEqual(len(context), 2)
        self.assertEqual(context[0]["role"], "user")
        self.assertEqual(context[1]["role"], "assistant")

    def test_llm_json_parser(self):
        json_str = '{"reply_text": "Opening Calculator", "emotion_tag": "happy", "tool_call": {"name": "open_application", "arguments": {"app_name": "calc"}}}'
        parsed = llm_client._parse_structured_json(json_str)
        self.assertEqual(parsed["reply_text"], "Opening Calculator")
        self.assertEqual(parsed["emotion_tag"], "happy")
        self.assertIsNotNone(parsed["tool_call"])
        self.assertEqual(parsed["tool_call"]["name"], "open_application")

    def test_offline_intent_matcher(self):
        # Open App intent
        res = llm_client._match_offline_intent("open calculator")
        self.assertEqual(res["tool_call"]["name"], "open_application")
        self.assertEqual(res["tool_call"]["arguments"]["app_name"], "calculator")

        # Open Site intent
        res = llm_client._match_offline_intent("open youtube")
        self.assertEqual(res["tool_call"]["name"], "open_specific_site")
        self.assertEqual(res["tool_call"]["arguments"]["site_name"], "youtube")

        # Search intent
        res = llm_client._match_offline_intent("search for weather today")
        self.assertEqual(res["tool_call"]["name"], "web_search")
        self.assertEqual(res["tool_call"]["arguments"]["query"], "weather today")

        # System Info intent
        res = llm_client._match_offline_intent("how is my system doing?")
        self.assertEqual(res["tool_call"]["name"], "system_info")


if __name__ == "__main__":
    unittest.main()
