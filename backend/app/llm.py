"""AI provider router: Gemini free tier first, Groq as backup.

If no key is configured, a provider fails, or the daily budget is spent, the
caller gets None and the scripted interviewer takes over, so an interview
never stops because of an AI outage.
"""
import json
import logging
import time
from datetime import date

import httpx

from . import config
from .db import SessionLocal
from .models import LlmUsage

log = logging.getLogger("hiremark.llm")
_cooldown: dict[str, float] = {}  # provider -> monotonic time it may be used again


def enabled() -> bool:
    return bool(config.GEMINI_API_KEY or config.GROQ_API_KEY)


def _budget_ok() -> bool:
    with SessionLocal() as db:
        row = db.get(LlmUsage, date.today().isoformat())
        return not row or row.calls < config.LLM_DAILY_CALL_BUDGET


def _record(ok: bool, ms: float) -> None:
    with SessionLocal() as db:
        day = date.today().isoformat()
        row = db.get(LlmUsage, day)
        if not row:
            row = LlmUsage(day=day, calls=0, failures=0, avg_ms=0.0)
            db.add(row)
        row.avg_ms = (row.avg_ms * row.calls + ms) / (row.calls + 1)
        row.calls += 1
        if not ok:
            row.failures += 1
        db.commit()


async def _gemini(client: httpx.AsyncClient, system: str, user: str) -> str:
    r = await client.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": config.GEMINI_API_KEY},
        json={
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400, "responseMimeType": "application/json"},
        },
    )
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


async def _groq(client: httpx.AsyncClient, system: str, user: str) -> str:
    r = await client.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
        json={
            "model": config.GROQ_MODEL, "temperature": 0.4, "max_tokens": 400,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        },
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


async def ask_json(system: str, user: str) -> dict | None:
    """Returns the parsed JSON object, or None when no provider could answer."""
    providers = []
    if config.GEMINI_API_KEY:
        providers.append(("gemini", _gemini))
    if config.GROQ_API_KEY:
        providers.append(("groq", _groq))
    if not providers or not _budget_ok():
        return None
    async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT_SECONDS) as client:
        for name, fn in providers:
            if _cooldown.get(name, 0) > time.monotonic():
                continue
            t0 = time.monotonic()
            try:
                text = await fn(client, system, user)
                data = json.loads(text)
                if not isinstance(data, dict):
                    raise ValueError("not an object")
                _record(True, (time.monotonic() - t0) * 1000)
                return data
            except httpx.HTTPStatusError as exc:
                # Rate limited or quota spent: rest this provider, try the next.
                _cooldown[name] = time.monotonic() + (60 if exc.response.status_code == 429 else 15)
                log.warning("llm %s failed: HTTP %s", name, exc.response.status_code)
            except Exception as exc:  # timeout, bad JSON, unexpected shape
                _cooldown[name] = time.monotonic() + 5
                log.warning("llm %s failed: %s", name, type(exc).__name__)
            _record(False, (time.monotonic() - t0) * 1000)
    return None
