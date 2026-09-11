@echo off
title Snowman Desktop AI Voice Assistant
cd /d "%~dp0"
echo =========================================================
echo       Starting Snowman Desktop AI Voice Assistant
echo =========================================================

REM Check if Python venv exists
if not exist "backend\.venv\Scripts\python.exe" (
    echo [Setup] Creating Python virtual environment...
    python -m venv backend\.venv
    echo [Setup] Installing core backend dependencies...
    backend\.venv\Scripts\pip.exe install fastapi "uvicorn[standard]" websockets pydantic pydantic-settings python-dotenv psutil httpx aiosqlite pyttsx3 sounddevice numpy scipy edge-tts SpeechRecognition
)

REM 1. Start Backend Service in a new background window
echo [1/2] Launching Python Backend on http://127.0.0.1:8765...
start "Snowman Backend" cmd /k "cd /d \"%~dp0backend\" && .\.venv\Scripts\python.exe run_backend.py"

REM 2. Start Frontend Dev Server in a new window
echo [2/2] Launching Frontend Interface...
if not exist "frontend\node_modules" (
    echo [Setup] Installing frontend dependencies...
    cd frontend && call npm install && cd ..
)

start "Snowman Frontend" cmd /k "cd /d \"%~dp0frontend\" && npm run dev"

echo =========================================================
echo Snowman services are launching!
echo Backend:  http://127.0.0.1:8765
echo Frontend: http://localhost:5173
echo =========================================================
echo Opening Snowman in your browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173
pause
