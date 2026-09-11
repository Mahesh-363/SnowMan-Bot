# Snowman Web: Complete Zero-Cost Deployment Guide

Snowman is a pure, responsive web application and multilingual AI voice assistant (English, Hindi, Telugu) that runs across iOS, Android, Windows, macOS, and Linux in any modern browser.

This guide walks you through deploying Snowman completely for **$0 / month** using free-tier services:
- **Frontend**: [Vercel](https://vercel.com) (Hobby tier — Free forever, no credit card required)
- **Backend API & WebSocket**: [Render](https://render.com) (Free Web Service — 512MB RAM, no credit card required)
- **LLM Brain**: [Groq Cloud](https://console.groq.com) (Free API key — high-speed inference on LLaMA-3 / GPT-OSS models)
- **Speech Synthesis (TTS)**:
  - English & Hindi: Microsoft Edge Neural TTS (Free, built-in, no API key required)
  - Telugu: Built-in Edge-TTS (`te-IN-ShrutiNeural`) or Google Cloud Text-to-Speech (`te-IN-Standard-A`)

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│  Visitor Browser (iOS Safari, Android Chrome, Desktop)  │
│  • 3D Neuro Brain Synapse Network Canvas (Three.js)    │
│  • Web Speech Audio / Microphone Listener              │
│  • Closed Captions Subtitles with Language Badge        │
└──────────────▲──────────────────────────▲──────────────┘
               │ HTTPS                    │ WSS (WebSocket)
               │                          │
┌──────────────▼──────────┐    ┌──────────▼──────────────┐
│     Vercel (Frontend)   │    │  Render.com (Backend)   │
│  • React 18 + Vite SPA  │    │  • FastAPI + WebSockets │
│  • Tailwind CSS         │    │  • Multilingual Whisper │
│  • vercel.json rewrites │    │  • Edge & Cloud TTS     │
└─────────────────────────┘    └───────────▲─────────────┘
                                           │
                               ┌───────────▼─────────────┐
                               │       Groq Cloud        │
                               │  • GPT-OSS / LLaMA 3    │
                               │  • Multilingual prompt  │
                               └─────────────────────────┘
```

---

## Step 1: Push Code to GitHub

1. If you haven't already, push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Rebuild Snowman as pure web application"
   git remote add origin https://github.com/<your-username>/snowman.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Get Free API Keys

### 1. Groq Cloud (Free LLM Inference)
1. Go to [https://console.groq.com](https://console.groq.com) and sign in with Google or GitHub.
2. Click **API Keys** in the left sidebar.
3. Click **Create API Key**, name it `Snowman`, and copy the key (starts with `gsk_...`).
> **Cost**: $0 (Groq offers generous free rate limits with high speed).

### 2. Google Cloud Text-to-Speech for Telugu (Optional)
> **Note**: Snowman already includes a free, built-in Edge-TTS fallback for Telugu (`te-IN-ShrutiNeural`) that requires **no API key and no credit card**. If you want to use Google Cloud's Telugu voice (`te-IN-Standard-A`):
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Snowman-TTS`.
3. In the search bar, search for **Cloud Text-to-Speech API** and click **Enable**.
4. Navigate to **APIs & Services > Credentials**.
5. Click **Create Credentials > API Key** and copy the generated key.
6. (Recommended) Click **Restrict Key** and restrict API usage to **Cloud Text-to-Speech API**.
> **Credit Card Notice**: Standard Google Cloud account setup may prompt for billing verification for free-tier activation. If you do not wish to provide a card, **skip this step** — Snowman will automatically and cleanly use Edge-TTS for Telugu!

---

## Step 3: Deploy Backend to Render.com

1. Sign up or log in at [https://render.com](https://render.com) (sign in with GitHub).
2. On the Render Dashboard, click **New +** > **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your GitHub repository.
4. Configure the service settings:
   - **Name**: `snowman-backend` (or any unique name)
   - **Region**: Select the region closest to you (e.g., `Oregon (US West)` or `Frankfurt (EU Central)`)
   - **Branch**: `main`
   - **Root Directory**: Leave blank (uses repo root)
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Docker Context**: `backend`
   - **Instance Type**: **Free** (0.1 CPU, 512 MB RAM)

5. Under **Environment Variables**, add the following:
   | Key | Value | Notes |
   |---|---|---|
   | `HOST` | `0.0.0.0` | Binds to all interfaces |
   | `PORT` | `8765` | Default server port |
   | `LLM_PROVIDER` | `groq` | Fast cloud LLM |
   | `GROQ_API_KEY` | `gsk_...` | Your Groq API key from Step 2 |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq high-availability model |
   | `WHISPER_MODEL_SIZE` | `tiny` | **Critical**: Keeps memory under 280MB to prevent Render 512MB RAM OOM |
   | `GOOGLE_TTS_API_KEY` | *(Optional)* | Google Cloud API key if configured |
   | `USE_FALLBACK_TTS` | `true` | Allows Edge-TTS and resilient fallbacks |

6. Click **Deploy Web Service**.
7. Wait for Render to build the Docker container and start the service (usually 3–5 minutes).
8. Once deployed, copy your service URL:
   - Example: `https://snowman-backend.onrender.com`
   - WebSocket URL will be: `wss://snowman-backend.onrender.com/ws`

---

## Step 4: Deploy Frontend to Vercel

1. Log in to [https://vercel.com](https://vercel.com) with GitHub.
2. Click **Add New...** > **Project**.
3. Import your `snowman` GitHub repository.
4. In the project configuration:
   - **Project Name**: `snowman-ai`
   - **Framework Preset**: **Vite** (auto-detected)
   - **Root Directory**: Click **Edit** and choose `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)

5. Expand **Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `VITE_WS_URL` | `wss://<your-render-service>.onrender.com/ws` |
   | `VITE_API_URL` | `https://<your-render-service>.onrender.com` |

   *(Replace `<your-render-service>` with your actual Render hostname from Step 3)*.

6. Click **Deploy**.
7. Vercel will build the frontend in ~20 seconds and assign you a production URL (e.g., `https://snowman-ai.vercel.app`).

---

## Step 5: Verification & Testing Checklist

Open your Vercel URL on desktop and mobile devices:

### 1. Cloud Cold Start Verification
- Render's free tier automatically spins down after 15 minutes of inactivity.
- When visiting the page after sleep, Snowman will display a sleek top banner:
  `Connecting to assistant (cloud server waking up from sleep, ~30s)...`
- Once connected, the banner clears and the top status indicator turns green (`Connected`).

### 2. Multilingual Voice Testing
1. **English**: Say or type *"What is the speed of light?"* or click the **Science Fact** shortcut.
   - Assistant answers in clear English with voice synthesis and opens captions with `EN` badge.
2. **Hindi (हिंदी)**: Say or type *"नमस्ते! आप कौन हैं?"*
   - Assistant answers in natural Hindi in Devanagari script (`नमस्ते! मैं स्नोमैन हूँ...`) with Hindi neural voice (`hi-IN-SwaraNeural`) and `HI • हिंदी` badge.
3. **Telugu (తెలుగు)**: Say or type *"నమస్కారం! మీరు నాకు ఎలా సహాయపడగలరు?"*
   - Assistant answers in natural Telugu script (`నమస్కారం! నేను మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను...`) with Telugu neural voice (`te-IN-ShrutiNeural`) and `TE • తెలుగు` badge.

### 3. Web Action Testing
1. Say or type *"open youtube"* or click the **YouTube** button.
   - Assistant acknowledges verbally and executes `window.open` to launch YouTube in a new tab.
2. Say or type *"search for latest AI news"*.
   - Assistant executes web search in a new tab.
3. Say or type *"open github"*.
   - Assistant launches GitHub.

### 4. Mobile Browser Testing (iOS Safari & Android Chrome)
- **Microphone Permission**: On tapping the microphone button, the browser requests standard microphone permission.
- **AudioContext Autoplay Policy**: On iOS Safari and Android Chrome, audio playback unlocks smoothly on first tap without being blocked.
- **Responsive Layout**:
  - The 3D Neuro Brain canvas auto-scales cleanly on narrow mobile screens (360px–430px).
  - The closed captions and microphone button remain centered at the bottom.
  - The Chat Drawer slides in as a full-height sheet with easy thumb targets.

---

## Summary of Free-Tier Limits

| Service | Free Tier Allocation | Snowman Usage |
|---|---|---|
| **Vercel** | 100 GB bandwidth / mo | < 1 GB / mo |
| **Render** | 750 free instance hours / mo, 512MB RAM | ~270 MB RAM with `tiny` model |
| **Groq** | 30 requests / min, 14,400 / day | Conversational requests |
| **Edge-TTS** | Unlimited free neural voices | Zero API keys, zero cost |
