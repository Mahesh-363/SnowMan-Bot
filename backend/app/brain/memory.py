import os
import datetime
import logging
from pathlib import Path
import aiosqlite
from typing import List, Dict, Any, Optional
from ..config import settings, BASE_DIR

logger = logging.getLogger("Snowman.Memory")


class ConversationMemory:
    """Manages short-term conversation context and persistent session history."""

    def __init__(self):
        raw_path = Path(settings.SQLITE_DB_PATH)
        if not raw_path.is_absolute():
            self.db_path = str(BASE_DIR / raw_path)
        else:
            self.db_path = str(raw_path)
        self.use_redis = settings.USE_REDIS
        self.redis_client = None
        self._initialized = False

    async def initialize(self):
        """Creates the SQLite database and tables if not already existing."""
        if self._initialized:
            return

        db_dir = os.path.dirname(self.db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    role TEXT NOT NULL,
                    text TEXT NOT NULL,
                    emotion TEXT DEFAULT 'neutral'
                )
            """)
            await db.commit()

        # Optional Redis init
        if self.use_redis:
            try:
                import redis.asyncio as aioredis
                self.redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
                logger.info("Connected to Redis for session memory.")
            except Exception as e:
                logger.warning(f"Could not connect to Redis ({e}). Continuing with SQLite only.")
                self.redis_client = None

        self._initialized = True
        logger.info(f"Conversation memory initialized using SQLite at {self.db_path}")

    async def add_message(self, role: str, text: str, emotion: str = "neutral"):
        """Appends a message to database and Redis cache."""
        if not self._initialized:
            await self.initialize()

        # Store in SQLite
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO messages (role, text, emotion) VALUES (?, ?, ?)",
                (role, text, emotion)
            )
            await db.commit()

        # Store in Redis list if active
        if self.redis_client is not None:
            try:
                await self.redis_client.rpush("snowman:session", f"{role}:{text}")
                await self.redis_client.ltrim("snowman:session", -20, -1)
            except Exception as e:
                logger.warning(f"Redis write error: {e}")

    async def get_recent_context(self, limit: int = 6) -> List[Dict[str, str]]:
        """Retrieves recent conversation exchanges to feed as context to the LLM."""
        if not self._initialized:
            await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT role, text FROM messages ORDER BY id DESC LIMIT ?",
                (limit,)
            ) as cursor:
                rows = await cursor.fetchall()

        # Re-order oldest first
        context = []
        for role, text in reversed(rows):
            context.append({"role": role, "content": text})
        return context

    async def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves message history for the frontend timeline view."""
        if not self._initialized:
            await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT id, timestamp, role, text, emotion FROM messages ORDER BY id ASC LIMIT ?",
                (limit,)
            ) as cursor:
                rows = await cursor.fetchall()

        return [
            {
                "id": r[0],
                "timestamp": r[1],
                "role": r[2],
                "text": r[3],
                "emotion": r[4]
            }
            for r in rows
        ]

    async def clear_memory(self):
        """Clears all conversation memory."""
        if not self._initialized:
            await self.initialize()

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM messages")
            await db.commit()

        if self.redis_client is not None:
            try:
                await self.redis_client.delete("snowman:session")
            except Exception:
                pass


conversation_memory = ConversationMemory()
