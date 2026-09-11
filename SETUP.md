# Snowman Setup & Installation Guide

This guide walks you step-by-step through setting up voice synthesis (Piper TTS), downloading the official Live2D Hiyori sample model, configuring wake word detection, and launching the application.

---

## Prerequisites

1. **Python 3.10 or 3.11** installed and added to PATH.
2. **Node.js (v18+) & npm** installed.
3. *(Optional for native Rust desktop build)*: **Rust & Cargo** (`rustup-init.exe`).
   > *Note:* Snowman can run immediately via the React/Vite desktop frontend in your browser or desktop container, and builds natively with Tauri once Rust is present.

---

## 1. Setting Up the Backend

In the project root or `backend/` directory:

```bash
cd backend
# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Windows Command Prompt:
.\.venv\Scripts\activate.bat

# Install backend dependencies
pip install -r requirements.txt
```

---

## 2. Setting Up Piper TTS (Local Neural Voice)

Piper is an ultra-fast, local neural text-to-speech engine running on ONNX.

1. Create a `backend/models` folder (automatically created by Snowman).
2. Download a Piper voice model and its JSON configuration:
   - Voice: **en_US-lessac-medium.onnx**  
     Download link: [https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx)
   - Config: **en_US-lessac-medium.onnx.json**  
     Download link: [https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json)
3. Place both files in `backend/models/`:
   ```
   backend/models/en_US-lessac-medium.onnx
   backend/models/en_US-lessac-medium.onnx.json
   ```
4. *(Immediate Fallback)*: If Piper models are not downloaded, Snowman automatically uses **Windows SAPI5 / pyttsx3** so you still have local voice synthesis out-of-the-box!

---

## 3. Downloading the Live2D Sample Model ("Hiyori")

Snowman includes a responsive, animated cyber-avatar fallback. To render the full Live2D Cubism model:

1. Download the official free **Hiyori** sample model from the Live2D Cubism Web SDK samples repository:
   - Direct GitHub Repo: [Live2D Cubism Web Samples (Hiyori)](https://github.com/Live2D/CubismWebSamples/tree/develop/Samples/TypeScript/Demo/assets/Hiyori)
2. Extract the model directory into `frontend/public/live2d/models/Hiyori/` so that the file tree looks like:
   ```
   frontend/public/live2d/models/Hiyori/
   ├── Hiyori.model3.json
   ├── Hiyori.moc3
   ├── Hiyori.physics3.json
   ├── Hiyori.cdi3.json
   ├── Hiyori.pose3.json
   ├── motions/
   │   └── ...
   └── textures/
       ├── texture_00.png
       └── texture_01.png
   ```
3. To swap in any custom Live2D model, place the model folder in `frontend/public/live2d/models/<YourModel>/` and update `modelUrl` in settings.

---

## 4. Configuring Wake Word Detection

Snowman supports two wake word engines:

### Option A: openWakeWord (Recommended, 100% Free & Open-Source)
- Set in `backend/.env`:
  ```ini
  WAKE_WORD_ENGINE=openwakeword
  WAKE_WORD=Snowman
  WAKE_WORD_SENSITIVITY=0.5
  ```
- openWakeWord runs completely offline and requires no API keys or developer accounts.

### Option B: Picovoice Porcupine
1. Create a free Picovoice account at [console.picovoice.ai](https://console.picovoice.ai/).
2. Obtain your Access Key.
3. Configure `backend/.env`:
  ```ini
  WAKE_WORD_ENGINE=porcupine
  PORCUPINE_ACCESS_KEY=your_access_key_here
  ```

---

## 5. Setting Up LLM Brain Providers

Open `backend/.env` or configure directly in the UI Settings panel:

### Local AI (Ollama - Free & Offline)
1. Install [Ollama](https://ollama.ai/).
2. Pull your model of choice:
   ```bash
   ollama pull llama3
   # or
   ollama pull qwen2.5:7b
   ```
3. In `backend/.env`:
   ```ini
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3
   ```

### Cloud AI (Groq - Free, Ultra-Fast Inference)
1. Get a free API key at [console.groq.com](https://console.groq.com/).
2. In `backend/.env`:
   ```ini
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_...
   GROQ_MODEL=llama-3.3-70b-versatile
   ```

---

## 6. First Run

You can launch Snowman with the one-click batch script:

```bash
start_snowman.bat
```

Or manually in two terminals:

**Terminal 1 (Backend):**
```bash
cd backend
.\.venv\Scripts\python.exe run_backend.py
```

**Terminal 2 (Frontend / Desktop):**
```bash
cd frontend
npm run dev
```

Open your browser to `http://localhost:5173` or run `npm run tauri dev` once Rust is installed.
