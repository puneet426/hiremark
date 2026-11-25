"""Authentication, sessions, CSRF and rate limiting."""
import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from . import config
from .db import get_db
from .models import AuthSession, User, now

_ph = PasswordHasher()
# Verifying against a dummy hash keeps login timing equal for unknown emails.
_DUMMY_HASH = _ph.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _ph.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def create_session(db: Session, user: User, response: Response) -> str:
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    db.add(
        AuthSession(
            token_hash=sha256(token),
            user_id=user.id,
            csrf=csrf,
            expires_at=now() + timedelta(days=config.SESSION_DAYS),
        )
    )
    db.commit()
    response.set_cookie(
        config.SESSION_COOKIE,
        token,
        max_age=config.SESSION_DAYS * 86400,
        httponly=True,
        secure=config.IS_PROD,
        samesite="lax",
        path="/",
    )
    return csrf


def destroy_session(db: Session, request: Request, response: Response) -> None:
    token = request.cookies.get(config.SESSION_COOKIE)
    if token:
        db.query(AuthSession).filter(AuthSession.token_hash == sha256(token)).delete()
        db.commit()
    response.delete_cookie(config.SESSION_COOKIE, path="/")


def _session(db: Session, request: Request) -> AuthSession | None:
    token = request.cookies.get(config.SESSION_COOKIE)
    if not token:
        return None
    sess = db.get(AuthSession, sha256(token))
    if not sess or sess.expires_at < now():
        return None
    return sess


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    sess = _session(db, request)
    if not sess:
        return None
    request.state.csrf = sess.csrf
    return db.get(User, sess.user_id)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Authenticated user. State-changing requests must also carry the CSRF token."""
    sess = _session(db, request)
    if not sess:
        raise HTTPException(401, "Please sign in.")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        sent = request.headers.get("x-csrf-token", "")
        if not hmac.compare_digest(sent, sess.csrf):
            raise HTTPException(403, "Your session token is missing or out of date. Reload the page.")
        origin = request.headers.get("origin")
        if origin and origin.rstrip("/") != config.APP_ORIGIN:
            raise HTTPException(403, "Request from an unexpected origin.")
    user = db.get(User, sess.user_id)
    if not user:
        raise HTTPException(401, "Please sign in.")
    request.state.csrf = sess.csrf
    return user


def require_role(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "You do not have access to this.")
        return user

    return dep


def recruiter_with_plan(user: User = Depends(require_role("recruiter", "admin"))) -> User:
    if user.role == "admin":
        return user
    if not user.plan or not user.plan_expires_at or user.plan_expires_at < now():
        raise HTTPException(402, "An active recruiter plan is needed for this.")
    return user


# --- Rate limiting (in-memory sliding window; one backend process) ---
_hits: dict[str, deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(key: str, limit: int, per_seconds: int) -> None:
    t = time.monotonic()
    q = _hits[key]
    while q and q[0] <= t - per_seconds:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Too many requests. Please wait a moment and try again.")
    q.append(t)
    if len(_hits) > 50_000:  # crude memory guard
        for k in [k for k, v in _hits.items() if not v]:
            _hits.pop(k, None)
