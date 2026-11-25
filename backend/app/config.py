"""Settings. Everything secret comes from the environment; nothing is hard-coded."""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    path = BASE_DIR / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv()


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).lower() in ("1", "true", "yes")


ENV = os.environ.get("ENV", "development")  # development | production
IS_PROD = ENV == "production"

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'hiremark.db'}")
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", BASE_DIR / "uploads"))

# Public origin of the web app; used for CSRF origin checks and email links.
APP_ORIGIN = os.environ.get("APP_ORIGIN", "http://localhost:3000").rstrip("/")

SECRET_KEY = os.environ.get("SECRET_KEY", "")
if not SECRET_KEY:
    if IS_PROD:
        raise RuntimeError("SECRET_KEY must be set in production")
    SECRET_KEY = secrets.token_hex(32)

SESSION_COOKIE = "hm_session"
SESSION_DAYS = 14

# --- AI providers (free tiers). With no key set, the scripted interviewer runs. ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
LLM_TIMEOUT_SECONDS = float(os.environ.get("LLM_TIMEOUT_SECONDS", "8"))
# Global cut-off so bots cannot burn the free quota.
LLM_DAILY_CALL_BUDGET = int(os.environ.get("LLM_DAILY_CALL_BUDGET", "4000"))

# --- Code runner ---
JUDGE0_URL = os.environ.get("JUDGE0_URL", "").rstrip("/")
JUDGE0_TOKEN = os.environ.get("JUDGE0_TOKEN", "")
# The local runner executes code on this machine with only OS resource limits.
# It is for development and is refused in production.
ALLOW_LOCAL_RUNNER = _bool("ALLOW_LOCAL_RUNNER", not IS_PROD) and not IS_PROD

# --- Interview ---
MAX_CONCURRENT_INTERVIEWS = int(os.environ.get("MAX_CONCURRENT_INTERVIEWS", "20"))
ATS_UNLOCK_SCORE = int(os.environ.get("ATS_UNLOCK_SCORE", "60"))
MAX_WARNINGS = 3
# 1.0 = the real 40-minute interview. Lower values shorten every segment (demos, tests).
TIME_SCALE = float(os.environ.get("INTERVIEW_TIME_SCALE", "1.0"))
if IS_PROD:
    TIME_SCALE = 1.0

# --- Payments (Razorpay) ---
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
PAYMENTS_LIVE = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)
# Simulated checkout for local development only; never available in production.
PAYMENTS_MOCK = (not PAYMENTS_LIVE) and (not IS_PROD)

# --- Email ---
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "Hiremark <no-reply@localhost>")

ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}

RESUME_MAX_BYTES = 2 * 1024 * 1024
