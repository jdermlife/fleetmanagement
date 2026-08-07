# FILSCORE Ollama fallback

The production fallback is intentionally isolated from the main API:

- OpenAI remains the primary provider on the hosted backend.
- The frontend retries through Ollama only after the backend returns the explicit
  `openai_quota_exhausted` code.
- Ollama listens on `127.0.0.1:11434`.
- The fallback FastAPI process listens on `127.0.0.1:5001`.
- nginx exposes only `POST /local-ai/page-assistant`.
- The fallback uses the same input and output disclosure guards as OpenAI.

Production runtime settings:

```text
AI_PROVIDER_MODE=ollama
AI_GOVERNANCE_LOGGING_ENABLED=false
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
ENABLE_RATE_LIMIT=true
RATE_LIMIT_REQUESTS=20
RATE_LIMIT_WINDOW=60
```

The local service must use `backend/assistant_main.py`, not the full application
entry point, so notification dispatchers, migrations, and retention jobs are not
duplicated.
