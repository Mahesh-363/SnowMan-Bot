import uvicorn
import os
import sys

# Ensure backend directory is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.config import settings

if __name__ == "__main__":
    print("=" * 60)
    print(f" Starting Snowman Assistant Backend on http://{settings.HOST}:{settings.PORT}")
    print(f" LLM Provider: {settings.LLM_PROVIDER}")
    print("=" * 60)
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
        log_level="info"
    )
