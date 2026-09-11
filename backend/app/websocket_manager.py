import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("Snowman.WebSocket")


class WebSocketManager:
    """Manages active WebSocket connections to Tauri / React frontend."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.current_state: str = "idle"  # "idle", "listening", "thinking", "speaking"
        self.current_emotion: str = "neutral"  # "neutral", "happy", "confused", etc.

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Frontend connected. Active clients: {len(self.active_connections)}")
        # Send initial status
        await websocket.send_json({
            "type": "state_change",
            "state": self.current_state,
            "emotion": self.current_emotion,
            "message": "Connected to Snowman Assistant Backend"
        })

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Frontend disconnected. Active clients: {len(self.active_connections)}")

    async def broadcast_json(self, message: Dict[str, Any]):
        """Broadcasts a JSON payload to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send JSON to client: {e}")
                disconnected.append(connection)
        for dead in disconnected:
            self.disconnect(dead)

    async def broadcast_bytes(self, data: bytes):
        """Broadcasts raw binary data (e.g. PCM/WAV chunks) to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_bytes(data)
            except Exception as e:
                logger.warning(f"Failed to send binary to client: {e}")
                disconnected.append(connection)
        for dead in disconnected:
            self.disconnect(dead)

    async def set_state(self, state: str, emotion: Optional[str] = None):
        """Updates and broadcasts the current assistant state and emotion."""
        self.current_state = state
        if emotion:
            self.current_emotion = emotion
        await self.broadcast_json({
            "type": "state_change",
            "state": self.current_state,
            "emotion": self.current_emotion
        })

    async def send_transcript(self, role: str, text: str, is_final: bool = True, language: Optional[str] = None):
        """Sends speech-to-text transcript or user utterance."""
        payload = {
            "type": "transcript",
            "role": role,
            "text": text,
            "is_final": is_final
        }
        if language:
            payload["language"] = language
        await self.broadcast_json(payload)

    async def send_llm_reply(self, text: str, emotion: str, tool_call: Optional[Dict[str, Any]] = None, language: Optional[str] = None):
        """Sends the assistant's structured reply."""
        self.current_emotion = emotion
        payload = {
            "type": "llm_reply",
            "text": text,
            "emotion": emotion,
            "tool_call": tool_call
        }
        if language:
            payload["language"] = language
        await self.broadcast_json(payload)

    async def send_system_action_result(self, tool_name: str, status: str, message: str, details: Optional[Dict[str, Any]] = None):
        """Sends feedback after executing a desktop or browser action."""
        await self.broadcast_json({
            "type": "action_result",
            "tool": tool_name,
            "status": status,
            "message": message,
            "details": details or {}
        })

    async def send_audio_chunk(self, base64_chunk: str, is_first: bool = False, is_last: bool = False, generation_id: int = 0):
        """Sends base64 audio chunk for playback and lip-sync with generation tracking."""
        await self.broadcast_json({
            "type": "audio_chunk",
            "data": base64_chunk,
            "is_first": is_first,
            "is_last": is_last,
            "gen_id": generation_id
        })


ws_manager = WebSocketManager()
