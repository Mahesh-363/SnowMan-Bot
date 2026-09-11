# Snowman: Desktop AI Voice Assistant

**Snowman** is an intelligent desktop AI voice assistant built with Tauri, React, Live2D Cubism animation, and a local Python FastAPI backend. It features local wake word detection, Voice Activity Detection (VAD), Speech-to-Text via faster-whisper, neural TTS via Piper with real-time lip-sync, and Windows system/browser control with security allowlists.

---

## Key Features

- **Animated Live2D Face**:
  - Live2D Cubism Web SDK integration rendering interactive 2D models (defaulting to the official Hiyori model).
  - Real-time lip-sync driven by audio amplitude analysis of TTS output.
  - Multi-state animations (`idle`, `listening`, `thinking`, `speaking`) and emotion expressions (`happy`, `neutral`, `confused`).
  - Fallback holographic avatar ensuring immediate usability out of the box.

- **Floating Overlay & Full Window Modes**:
  - **Floating Overlay**: Compact, always-on-top desktop companion with glassmorphism UI.
  - **Full Window**: Comprehensive workstation mode with message history timeline, system telemetry, and detailed controls.

- **Conversational AI Brain & Function Calling**:
  - Supports local **Ollama** (`llama3`, `mistral`, `qwen`), **Groq** (`llama-3.3-70b`), and **OpenAI**.
  - Strict JSON output protocol driving verbal speech, emotion expressions, and tool execution.

- **Windows System & Browser Control**:
  - `open_application(app_name)`: Launches desktop applications (Notepad, Calculator, Chrome, VS Code, Terminal, Spotify).
  - `close_application(app_name)`: Gracefully closes running processes.
  - `open_website(url)`: Opens validated URLs in the default browser.
  - `open_specific_site(site_name)`: Maps aliases (YouTube, GitHub, Gmail) to destinations.
  - `web_search(query)`: Launches default browser search.
  - `system_info()`: Verbal status report on battery level, CPU %, RAM %, and current time.

- **Security Allowlist**:
  - Strict allowlist configured in `backend/config/allowlist.json` guarding executable execution and domain navigation.
  - Rejects unpermitted actions with a friendly verbal explanation.

- **Session Context & Persistent Memory**:
  - SQLite persistent conversation storage (`backend/data/conversations.db`) across desktop restarts.
  - Optional Redis cache for real-time session sliding windows.

---

## Architecture

```
                               +------------------------------------------+
                               |        Snowman Tauri Shell               |
                               |  (Rust Core + Transparent Window)        |
                               +------------------------------------------+
                                                    |
                                                    v
                      +-------------------------------------------------------------+
                      |                 React + Vite Frontend                       |
                      |  - Live2D Canvas & WebGL Renderer                           |
                      |  - Web Audio Analyser (Real-time Lip-Sync)                  |
                      |  - Floating Overlay / Full Window Modes                     |
                      |  - Settings Drawer & Interactive Chat                       |
                      +-------------------------------------------------------------+
                                                    ^
                                                    |  WebSocket (Port 8765)
                                                    v
                      +-------------------------------------------------------------+
                      |                 FastAPI Python Backend                      |
                      |  - Audio Stream Manager & WebSocket Router                  |
                      |  - openWakeWord / Porcupine ("Snowman")                     |
                      |  - Silero VAD & faster-whisper (STT)                        |
                      |  - Piper Neural TTS & Windows SAPI5 Fallback                |
                      |  - LLM Brain (Ollama / Groq / OpenAI)                       |
                      |  - System & Browser Controller with Allowlist Guard         |
                      |  - SQLite & Redis Conversation Memory                       |
                      +-------------------------------------------------------------+
```

---

## System Control Configuration

### Configuring Allowed Applications

Application mappings are defined in `backend/config/allowlist.json` and can also be modified directly in the UI Settings panel:

```json
{
  "allowed_applications": [
    {
      "alias": "notepad",
      "executable": "notepad.exe",
      "description": "Windows Notepad"
    },
    {
      "alias": "code",
      "executable": "code.cmd",
      "description": "Visual Studio Code"
    },
    {
      "alias": "chrome",
      "executable": "chrome.exe",
      "description": "Google Chrome Browser"
    }
  ]
}
```

- **`alias`**: The natural language name you use when speaking (e.g., *"Open code"* or *"Launch Notepad"*).
- **`executable`**: The executable command or full absolute path on your Windows system.

### Configuring Site Shortcuts

Site aliases are stored in `backend/config/sites_mapping.json`:

```json
{
  "youtube": "https://www.youtube.com",
  "github": "https://github.com",
  "gmail": "https://mail.google.com"
}
```

Saying *"Open YouTube"* automatically maps to `https://www.youtube.com` and validates against the allowed domain list.

---

## Quick Start

### 1. Quick Launch (Windows)

Double-click the included batch script:

```bat
start_snowman.bat
```

### 2. Manual Start

**Step 1: Start Backend**
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python run_backend.py
```

**Step 2: Start Desktop Frontend**
```powershell
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser, or run `npm run tauri dev` to launch the native transparent Tauri desktop window.

For voice model installation and Live2D model downloads, refer to [SETUP.md](SETUP.md).
