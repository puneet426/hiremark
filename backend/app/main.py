import asyncio
import csv
import io
import json
import logging
import re
import secrets
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from . import config, engine, llm, questions as Q, runner, security as sec, services as svc
from .db import Base, engine as db_engine, get_db
from .models import (AuthSession, Booking, ContactRequest, IntegrityEvent, Interview, LlmUsage, Message, Payment, Resume,
                     Shortlist, Submission, User, now)
from .resume import ResumeError, extract_pdf, parse_resume, score_resume

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
Base.metadata.create_all(db_engine)
config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Hiremark API", docs_url=None if config.IS_PROD else "/api/docs", redoc_url=None,
              openapi_url=None if config.IS_PROD else "/api/openapi.json")
IST = ZoneInfo("Asia/Kolkata")
_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    if request.headers.get("content-length") and int(request.headers["content-length"]) > config.RESUME_MAX_BYTES + 200_000:
        return JSONResponse({"detail": "Request too large."}, status_code=413)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logging.getLogger("hiremark").exception("unhandled error on %s", request.url.path)
    return JSONResponse({"detail": "Something went wrong on our side. Please try again."}, status_code=500)


def _email_ok(v: str) -> str:
    v = v.strip().lower()
    if not re.fullmatch(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", v) or len(v) > 254:
        raise ValueError("Enter a valid email address.")
    return v


def user_out(u: User, request: Request) -> dict:
    return {
        "id": u.id, "email": u.email, "name": u.name, "role": u.role, "email_verified": u.email_verified,
        "college": u.college, "branch": u.branch, "grad_year": u.grad_year, "phone": u.phone, "location": u.location,
        "company": u.company, "recruiter_verified": u.recruiter_verified,
        "plan": u.plan if u.plan_expires_at and u.plan_expires_at > now() else "",
        "plan_expires_at": u.plan_expires_at.isoformat() if u.plan_expires_at else None,
        "credits": u.credits, "free_interview_available": not u.free_interview_used, "consented": bool(u.consent_at),
        "csrf": getattr(request.state, "csrf", ""),
    }


# =================================================================== auth
class SignupIn(BaseModel):
    email: str
    password: str = Field(min_length=10, max_length=128)
    name: str = Field(min_length=2, max_length=80)
    role: str = "student"
    company: str = Field(default="", max_length=120)

    _e = field_validator("email")(_email_ok)

    @field_validator("role")
    @classmethod
    def _role(cls, v):
        if v not in ("student", "recruiter"):
            raise ValueError("Invalid role.")
        return v

    @field_validator("name", "company")
    @classmethod
    def _plain(cls, v):
        v = re.sub(r"\s+", " ", v).strip()
        if re.search(r"[<>{}\\]", v):
            raise ValueError("Please remove special characters.")
        return v


class LoginIn(BaseModel):
    email: str
    password: str = Field(max_length=128)
    _e = field_validator("email")(_email_ok)


def _issue_verification(db: Session, user: User) -> dict:
    token = secrets.token_urlsafe(32)
    user.verify_token_hash, user.verify_sent_at = sec.sha256(token), now()
    db.commit()
    link = f"{config.APP_ORIGIN}/verify?token={token}"
    svc.send_mail(user.email, "Confirm your Hiremark email", f"Hello {user.name},\n\nConfirm your email to unlock your free interview:\n{link}\n\nThe link works for 24 hours.")
    # Without SMTP in development, hand the link back so the flow can be completed locally.
    return {"dev_verify_url": link} if (not config.IS_PROD and not config.SMTP_HOST) else {}


@app.post("/api/auth/signup")
def signup(body: SignupIn, request: Request, response: Response, db: Session = Depends(get_db)):
    sec.rate_limit("signup:" + sec.client_ip(request), 8, 3600)
    if body.role == "recruiter" and not body.company:
        raise HTTPException(422, "Enter your company name.")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, "An account with this email already exists. Sign in instead.")
    role = "admin" if body.email in config.ADMIN_EMAILS else body.role
    user = User(email=body.email, password_hash=sec.hash_password(body.password), name=body.name, role=role, company=body.company)
    db.add(user)
    db.commit()
    extra = _issue_verification(db, user)
    request.state.csrf = sec.create_session(db, user, response)
    return {"user": user_out(user, request), **extra}


@app.post("/api/auth/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    sec.rate_limit("login-ip:" + sec.client_ip(request), 30, 900)
    sec.rate_limit("login:" + body.email, 8, 900)
    user = db.query(User).filter(User.email == body.email).first()
    if not sec.verify_password(user.password_hash if user else None, body.password) or not user:
        raise HTTPException(401, "Email or password is incorrect.")
    request.state.csrf = sec.create_session(db, user, response)
    return {"user": user_out(user, request)}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    sec.destroy_session(db, request, response)
    return {"ok": True}


@app.get("/api/auth/me")
def me(request: Request, user: User | None = Depends(sec.optional_user)):
    return {"user": user_out(user, request) if user else None,
            "config": {"ats_unlock": config.ATS_UNLOCK_SCORE, "payments": "live" if config.PAYMENTS_LIVE else "test" if config.PAYMENTS_MOCK else "off",
                       "ai": llm.enabled(), "interview_minutes": round(engine.total_seconds() / 60)}}


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=100)


@app.post("/api/auth/verify")
def verify_email(body: TokenIn, request: Request, db: Session = Depends(get_db)):
    sec.rate_limit("verify:" + sec.client_ip(request), 20, 600)
    user = db.query(User).filter(User.verify_token_hash == sec.sha256(body.token)).first()
    if not user or not user.verify_sent_at or user.verify_sent_at < now() - timedelta(hours=24):
        raise HTTPException(400, "This link is invalid or has expired. Request a new one from your dashboard.")
    user.email_verified, user.verify_token_hash = True, None
    db.commit()
    return {"ok": True}


@app.post("/api/auth/resend")
def resend(request: Request, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    sec.rate_limit("resend:" + user.id, 3, 900)
    if user.email_verified:
        return {"ok": True}
    return {"ok": True, **_issue_verification(db, user)}


class ProfileIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    college: str = Field(default="", max_length=120)
    branch: str = Field(default="", max_length=80)
    grad_year: int | None = Field(default=None, ge=2020, le=2035)
    phone: str = Field(default="", max_length=20)
    location: str = Field(default="", max_length=80)
    company: str = Field(default="", max_length=120)
    consent: bool = False

    @field_validator("name", "college", "branch", "location", "company")
    @classmethod
    def _plain(cls, v):
        v = re.sub(r"\s+", " ", v).strip()
        if re.search(r"[<>{}\\]", v):
            raise ValueError("Please remove special characters.")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        v = re.sub(r"[\s-]", "", v)
        if v and not re.fullmatch(r"\+?\d{10,13}", v):
            raise ValueError("Enter a valid phone number.")
        return v


@app.put("/api/profile")
def update_profile(body: ProfileIn, request: Request, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    for f in ("name", "college", "branch", "grad_year", "phone", "location"):
        setattr(user, f, getattr(body, f))
    if user.role == "recruiter" and body.company:
        user.company = body.company
    if body.consent and not user.consent_at:
        user.consent_at = now()
    db.commit()
    return {"user": user_out(user, request)}


@app.delete("/api/account")
def delete_account(request: Request, response: Response, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    """Deletes the account and everything attached to it (DPDP: right to erasure)."""
    for r in db.query(Resume).filter(Resume.user_id == user.id).all():
        (config.UPLOAD_DIR / r.stored_name).unlink(missing_ok=True)
    ivs = [i.id for i in db.query(Interview.id).filter(Interview.user_id == user.id)]
    for model in (Message, IntegrityEvent, Submission):
        db.query(model).filter(model.interview_id.in_(ivs)).delete(synchronize_session=False)
    db.query(Interview).filter(Interview.user_id == user.id).delete()
    db.query(Booking).filter(Booking.user_id == user.id).delete()
    db.query(Resume).filter(Resume.user_id == user.id).delete()
    db.query(Shortlist).filter(or_(Shortlist.recruiter_id == user.id, Shortlist.student_id == user.id)).delete()
    db.query(ContactRequest).filter(or_(ContactRequest.recruiter_id == user.id, ContactRequest.student_id == user.id)).delete()
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    db.query(Payment).filter(Payment.user_id == user.id, Payment.status != "paid").delete()
    # Paid payment rows are kept without personal data, as tax records.
    db.query(Payment).filter(Payment.user_id == user.id).update({"user_id": None})
    db.delete(user)
    db.commit()
    response.delete_cookie(config.SESSION_COOKIE, path="/")
    return {"ok": True}


# ================================================================= resume
def latest_resume(db: Session, user_id: str) -> Resume | None:
    return db.query(Resume).filter(Resume.user_id == user_id).order_by(Resume.created_at.desc()).first()


def resume_out(r: Resume) -> dict:
    p = r.parsed
    return {"id": r.id, "filename": r.filename, "score": r.score, "breakdown": r.breakdown, "fixes": r.fixes,
            "skills": p.get("skills", []), "projects": [x["title"] for x in p.get("projects", [])],
            "pages": p.get("pages"), "created_at": r.created_at.isoformat(), "unlocked": r.score >= config.ATS_UNLOCK_SCORE}


@app.post("/api/resume")
async def upload_resume(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(sec.require_role("student"))):
    sec.rate_limit("resume:" + user.id, 12, 3600)
    data = await file.read(config.RESUME_MAX_BYTES + 1)
    if len(data) > config.RESUME_MAX_BYTES:
        raise HTTPException(413, "The file is larger than 2 MB. Compress it or remove images.")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(415, "Only PDF resumes are accepted.")
    stored = secrets.token_hex(16) + ".pdf"  # never the user's filename
    path = config.UPLOAD_DIR / stored
    path.write_bytes(data)
    try:
        raw = await asyncio.to_thread(extract_pdf, path)
    except ResumeError as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(422, str(exc))
    parsed = parse_resume(raw)
    score, breakdown, fixes = score_resume(parsed)
    # Keep only the latest three files per student.
    old = db.query(Resume).filter(Resume.user_id == user.id).order_by(Resume.created_at.desc()).offset(2).all()
    used = {i.resume_id for i in db.query(Interview.resume_id).filter(Interview.user_id == user.id)}
    for r in old:
        (config.UPLOAD_DIR / r.stored_name).unlink(missing_ok=True)
        if r.id not in used:
            db.delete(r)
    name = re.sub(r"[^A-Za-z0-9._ -]", "", file.filename or "resume.pdf")[:120] or "resume.pdf"
    r = Resume(user_id=user.id, filename=name, stored_name=stored, parsed=parsed, score=score, breakdown=breakdown, fixes=fixes)
    db.add(r)
    db.commit()
    return resume_out(r)


@app.get("/api/resume")
def get_resume(db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    r = latest_resume(db, user.id)
    return {"resume": resume_out(r) if r else None}


@app.get("/api/resume/file/{student_id}")
def resume_file(student_id: str, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    """The owner, or a recruiter whose contact request that student approved."""
    if user.id != student_id and user.role != "admin":
        ok = db.query(ContactRequest).filter(ContactRequest.recruiter_id == user.id, ContactRequest.student_id == student_id, ContactRequest.status == "approved").first()
        if not ok:
            raise HTTPException(404, "Not found.")
    r = latest_resume(db, student_id)
    path = config.UPLOAD_DIR / r.stored_name if r else None
    if not path or not path.exists():
        raise HTTPException(404, "Not found.")
    return FileResponse(path, media_type="application/pdf", filename="resume.pdf", headers={"Content-Security-Policy": "sandbox"})


# ================================================================ booking
def _slot_times() -> list[datetime]:
    """Hourly slots, 9:00 to 21:00 India time, for the next seven days (stored as UTC)."""
    out = []
    start = datetime.now(IST)
    for day in range(0, 7):
        base = (start + timedelta(days=day)).replace(minute=0, second=0, microsecond=0)
        for hour in range(9, 22):
            t = base.replace(hour=hour)
            if t > start + timedelta(minutes=10):
                out.append(t.astimezone(timezone.utc).replace(tzinfo=None))
    return out


def _requirements(db: Session, user: User) -> list[str]:
    missing = []
    if not user.email_verified:
        missing.append("Confirm your email address.")
    if not (user.college and user.grad_year):
        missing.append("Add your college and graduation year to your profile.")
    if not user.consent_at:
        missing.append("Accept the interview and data terms in your profile.")
    r = latest_resume(db, user.id)
    if not r:
        missing.append("Upload your resume.")
    elif r.score < config.ATS_UNLOCK_SCORE:
        missing.append(f"Raise your resume score to {config.ATS_UNLOCK_SCORE} (now {r.score}).")
    if user.free_interview_used and user.credits < 1:
        missing.append("Buy an interview credit.")
    return missing


def booking_out(b: Booking, db: Session) -> dict:
    iv = db.query(Interview).filter(Interview.booking_id == b.id).first()
    opens = b.slot_start - timedelta(minutes=5)
    closes = b.slot_start + timedelta(minutes=15)
    return {"id": b.id, "slot_start": b.slot_start.isoformat() + "Z", "interviewer_id": b.interviewer_id, "status": b.status,
            "can_start": b.status == "booked" and opens <= now() <= closes, "interview_id": iv.id if iv else None,
            "join_closes": closes.isoformat() + "Z"}


@app.get("/api/booking/options")
def booking_options(db: Session = Depends(get_db), user: User = Depends(sec.require_role("student"))):
    counts = dict(db.query(Booking.slot_start, func.count(Booking.id)).filter(Booking.status.in_(("booked", "started")), Booking.slot_start > now() - timedelta(hours=1)).group_by(Booking.slot_start).all())
    slots = [{"start": t.isoformat() + "Z", "left": max(0, config.MAX_CONCURRENT_INTERVIEWS - counts.get(t, 0))} for t in _slot_times()]
    mine = db.query(Booking).filter(Booking.user_id == user.id, Booking.status.in_(("booked", "started"))).order_by(Booking.slot_start).all()
    for b in mine:  # expire bookings whose join window has passed
        if b.status == "booked" and now() > b.slot_start + timedelta(minutes=15):
            b.status = "missed"
    db.commit()
    return {"interviewers": Q.INTERVIEWERS, "slots": slots, "now_available": svc.active_count(db) < config.MAX_CONCURRENT_INTERVIEWS,
            "requirements": _requirements(db, user), "bookings": [booking_out(b, db) for b in mine if b.status in ("booked", "started")]}


class BookIn(BaseModel):
    slot: str = Field(max_length=40)  # ISO time, or "now"
    interviewer_id: str = Field(max_length=24)


@app.post("/api/booking")
def book(body: BookIn, db: Session = Depends(get_db), user: User = Depends(sec.require_role("student"))):
    sec.rate_limit("book:" + user.id, 10, 3600)
    missing = _requirements(db, user)
    if missing:
        raise HTTPException(409, missing[0])
    if body.interviewer_id not in Q.INTERVIEWER_IDS:
        raise HTTPException(422, "Choose an interviewer.")
    if db.query(Booking).filter(Booking.user_id == user.id, Booking.status.in_(("booked", "started")), Booking.slot_start > now() - timedelta(minutes=15)).first():
        raise HTTPException(409, "You already have an interview booked. Cancel it first to pick another time.")
    if body.slot == "now":
        if svc.active_count(db) >= config.MAX_CONCURRENT_INTERVIEWS:
            raise HTTPException(409, "All interview rooms are busy right now. Pick a later slot.")
        slot = now().replace(microsecond=0)
    else:
        try:
            slot = datetime.fromisoformat(body.slot.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            raise HTTPException(422, "Invalid slot.")
        if slot not in _slot_times():
            raise HTTPException(422, "That slot is not available.")
        taken = db.query(func.count(Booking.id)).filter(Booking.slot_start == slot, Booking.status.in_(("booked", "started"))).scalar()
        if taken >= config.MAX_CONCURRENT_INTERVIEWS:
            raise HTTPException(409, "That slot is full. Pick another.")
    b = Booking(user_id=user.id, slot_start=slot, interviewer_id=body.interviewer_id, credit_source="free" if not user.free_interview_used else "paid")
    db.add(b)
    db.commit()
    return booking_out(b, db)


@app.delete("/api/booking/{booking_id}")
def cancel_booking(booking_id: str, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    b = db.get(Booking, booking_id)
    if not b or b.user_id != user.id or b.status != "booked":
        raise HTTPException(404, "Booking not found.")
    b.status = "cancelled"
    db.commit()
    return {"ok": True}


@app.post("/api/booking/{booking_id}/start")
async def start_interview(booking_id: str, db: Session = Depends(get_db), user: User = Depends(sec.require_role("student"))):
    async with _locks["start:" + user.id]:
        b = db.get(Booking, booking_id)
        if not b or b.user_id != user.id:
            raise HTTPException(404, "Booking not found.")
        existing = db.query(Interview).filter(Interview.booking_id == b.id).first()
        if existing:
            return {"interview_id": existing.id}
        if b.status != "booked" or not (b.slot_start - timedelta(minutes=5) <= now() <= b.slot_start + timedelta(minutes=15)):
            raise HTTPException(409, "This booking cannot be started now. You can join from 5 minutes before to 15 minutes after the slot time.")
        missing = _requirements(db, user)
        if missing:
            raise HTTPException(409, missing[0])
        if svc.active_count(db) >= config.MAX_CONCURRENT_INTERVIEWS:
            raise HTTPException(409, "All interview rooms are busy. Try again in a few minutes.")
        if not config.JUDGE0_URL and not config.ALLOW_LOCAL_RUNNER:
            raise HTTPException(503, "The code runner is not configured yet. Please contact support.")
        # One credit is taken when the interview starts.
        if not user.free_interview_used:
            user.free_interview_used = True
        else:
            took = db.query(User).filter(User.id == user.id, User.credits >= 1).update({"credits": User.credits - 1})
            if not took:
                raise HTTPException(402, "You have no interview credits left.")
        resume = latest_resume(db, user.id)
        iv = Interview(user_id=user.id, booking_id=b.id, resume_id=resume.id, interviewer_id=b.interviewer_id, attempt_no=svc.attempts_for(db, user.id) + 1)
        db.add(iv)
        b.status = "started"
        db.flush()
        engine.start_interview(db, iv, user, resume)
        return {"interview_id": iv.id}


# ============================================================== interview
def _own_interview(db: Session, interview_id: str, user: User) -> Interview:
    iv = db.get(Interview, interview_id)
    if not iv or iv.user_id != user.id:
        raise HTTPException(404, "Interview not found.")
    return iv


def _after_change(db: Session, iv: Interview, state: dict) -> None:
    engine.commit_state(db, iv, state)
    if iv.status != "active":
        b = db.get(Booking, iv.booking_id)
        if b and b.status != "completed":
            b.status = "completed"
        # A new result replaces older ones on the leaderboard until the student opts in again.
        db.query(Interview).filter(Interview.user_id == iv.user_id, Interview.id != iv.id).update({"published": False})
        db.commit()


class _Ctx:
    """Loads the interview under a per-interview lock, ticks the clock, and saves state on exit."""

    def __init__(self, db: Session, interview_id: str, user: User, must_be_active: bool = True):
        self.db, self.id, self.user, self.must = db, interview_id, user, must_be_active

    async def __aenter__(self):
        self.lock = _locks[self.id]
        await self.lock.acquire()
        try:
            self.db.expire_all()
            self.iv = _own_interview(self.db, self.id, self.user)
            self.state = json.loads(json.dumps(self.iv.state))
            if self.iv.status == "active":
                engine.tick(self.db, self.iv, self.state)
            if self.must and self.iv.status != "active":
                _after_change(self.db, self.iv, self.state)
                raise HTTPException(409, "This interview has ended.")
        except BaseException:
            self.lock.release()
            raise
        return self

    async def __aexit__(self, exc_type, exc, tb):
        try:
            if exc_type is None:
                _after_change(self.db, self.iv, self.state)
            else:
                self.db.rollback()
        finally:
            self.lock.release()


@app.get("/api/interviews/{interview_id}/state")
async def interview_state(interview_id: str, after: int = 0, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    sec.rate_limit("state:" + user.id, 120, 60)
    async with _Ctx(db, interview_id, user, must_be_active=False) as c:
        if c.iv.status == "active":
            gap = (now() - c.iv.last_seen_at).total_seconds()
            if gap > 45:  # the browser was away: one rejoin within five minutes is allowed
                c.state["rejoins"] = c.state.get("rejoins", 0) + 1
                db.add(IntegrityEvent(interview_id=c.iv.id, kind="rejoin", detail=f"Away for {int(gap)} seconds", counted=False))
                if gap > 300 or c.state["rejoins"] > 1:
                    engine._say(db, c.iv, "system", "The interview has ended because the connection was lost more than once or for over five minutes.", "wrap")
                    engine.finish(db, c.iv, c.state, "terminated")
    return engine.view(db, c.iv, max(0, after))


class TurnIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@app.post("/api/interviews/{interview_id}/turn")
async def interview_turn(interview_id: str, body: TurnIn, after: int = 0, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    sec.rate_limit("turn:" + user.id, 24, 60)
    async with _Ctx(db, interview_id, user) as c:
        await engine.handle_turn(db, c.iv, c.state, body.text)
    return engine.view(db, c.iv, max(0, after))


@app.post("/api/interviews/{interview_id}/hint")
async def interview_hint(interview_id: str, after: int = 0, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    sec.rate_limit("turn:" + user.id, 24, 60)
    async with _Ctx(db, interview_id, user) as c:
        engine.give_hint(db, c.iv, c.state)
    return engine.view(db, c.iv, max(0, after))


class CodeIn(BaseModel):
    code: str = Field(max_length=20000)


@app.put("/api/interviews/{interview_id}/code")
async def interview_code(interview_id: str, body: CodeIn, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    sec.rate_limit("code:" + user.id, 90, 60)
    async with _Ctx(db, interview_id, user) as c:
        engine.save_code(db, c.iv, c.state, body.code)
    return {"ok": True, "warnings": c.iv.warnings, "status": c.iv.status}


class LangIn(BaseModel):
    language: str


@app.post("/api/interviews/{interview_id}/language")
async def interview_language(interview_id: str, body: LangIn, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    if body.language not in Q.LANGUAGES:
        raise HTTPException(422, "Unsupported language.")
    async with _Ctx(db, interview_id, user) as c:
        c.iv.language = body.language
        c.iv.code = Q.starter(body.language)  # set by the server, so it is not flagged as a paste
        c.state["last_code_at"] = now().isoformat()
    return {"language": c.iv.language, "code": c.iv.code}


async def _execute(db: Session, interview_id: str, user: User, body: CodeIn, kind: str) -> dict:
    sec.rate_limit("run:" + user.id, 12, 60)
    async with _Ctx(db, interview_id, user) as c:
        if engine.SEGMENTS[c.state["seg"]]["key"] != "dsa" or c.state["dsa"]["phase"] == "review":
            raise HTTPException(409, "The coding part of the interview is over.")
        engine.save_code(db, c.iv, c.state, body.code)
        if c.iv.status != "active":
            raise HTTPException(409, "This interview has ended.")
        prob = Q.DSA_BY_ID[c.iv.plan["dsa"]]
        tests = Q.expand_tests(prob)
        chosen = tests[: prob["samples"]] if kind == "run" else tests
        try:
            results = await runner.run_tests(c.iv.language, c.iv.code, chosen)
        except runner.RunnerUnavailable:
            raise HTTPException(503, "The code runner is unavailable. Try again in a moment.")
        summary = engine.record_submission(db, c.iv, c.state, kind, results)
        if kind == "run":  # sample tests are visible, so show their details
            summary["tests"] = [{"input": i, "expected": e, "status": r["status"], "passed": r["passed"], "stdout": r["stdout"][:2000], "stderr": r["stderr"][:2000], "ms": r["ms"]}
                                for (i, e), r in zip(chosen, results)]
        else:  # hidden tests: counts and the first error message only, never inputs or expected output
            failing = next((r for r in results if not r["passed"]), None)
            summary["first_failure"] = {"status": failing["status"], "stderr": failing["stderr"][:1500] if failing["status"] in ("Compilation error", "Runtime error") else ""} if failing else None
    return summary


@app.post("/api/interviews/{interview_id}/run")
async def interview_run(interview_id: str, body: CodeIn, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    return await _execute(db, interview_id, user, body, "run")


@app.post("/api/interviews/{interview_id}/submit")
async def interview_submit(interview_id: str, body: CodeIn, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    return await _execute(db, interview_id, user, body, "submit")


class EventIn(BaseModel):
    kind: str = Field(max_length=32)
    detail: str = Field(default="", max_length=300)


@app.post("/api/interviews/{interview_id}/event")
async def interview_event(interview_id: str, body: EventIn, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    sec.rate_limit("event:" + user.id, 60, 60)
    async with _Ctx(db, interview_id, user) as c:
        engine.record_event(db, c.iv, c.state, body.kind, body.detail)
    return {"warnings": c.iv.warnings, "status": c.iv.status}


@app.post("/api/interviews/{interview_id}/end")
async def interview_end(interview_id: str, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    async with _Ctx(db, interview_id, user) as c:
        engine._say(db, c.iv, "system", "The candidate ended the interview early.", engine.SEGMENTS[c.state["seg"]]["key"])
        engine.finish(db, c.iv, c.state, "completed")
    return {"ok": True}


def interview_summary(iv: Interview) -> dict:
    return {"id": iv.id, "status": iv.status, "score": iv.score, "verdict": iv.verdict, "published": iv.published, "attempt_no": iv.attempt_no,
            "started_at": iv.started_at.isoformat() + "Z", "interviewer_id": iv.interviewer_id,
            "eligible": bool(iv.report and iv.report.get("eligible"))}


@app.get("/api/interviews")
def my_interviews(db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    svc.sweep(db)
    rows = db.query(Interview).filter(Interview.user_id == user.id).order_by(Interview.started_at.desc()).all()
    return {"interviews": [interview_summary(i) for i in rows]}


@app.get("/api/interviews/{interview_id}/result")
def interview_result(interview_id: str, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    iv = _own_interview(db, interview_id, user)
    if iv.status == "active":
        raise HTTPException(409, "This interview is still running.")
    latest = db.query(Interview).filter(Interview.user_id == user.id, Interview.status != "active").order_by(Interview.started_at.desc()).first()
    return {**interview_summary(iv), "report": iv.report, "is_latest": latest.id == iv.id,
            "interviewer": next(i for i in Q.INTERVIEWERS if i["id"] == iv.interviewer_id),
            "transcript": [{"role": m.role, "text": m.text, "segment": m.segment} for m in iv.messages]}


class PublishIn(BaseModel):
    published: bool


@app.post("/api/interviews/{interview_id}/publish")
def publish(interview_id: str, body: PublishIn, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    iv = _own_interview(db, interview_id, user)
    if body.published:
        latest = db.query(Interview).filter(Interview.user_id == user.id, Interview.status != "active").order_by(Interview.started_at.desc()).first()
        if iv.status == "active" or not latest or latest.id != iv.id:
            raise HTTPException(409, "Only your latest interview can be published.")
        if not (iv.report and iv.report.get("eligible")):
            raise HTTPException(409, "Interviews with integrity warnings or an early end cannot be published.")
    iv.published = body.published
    db.commit()
    return interview_summary(iv)


# ============================================================ leaderboard
def _board_rows(db: Session, college: str = "", skill: str = "", min_score: int = 0, grad_year: int | None = None, location: str = "", sort: str = "score"):
    q = db.query(Interview, User).join(User, User.id == Interview.user_id).filter(Interview.published.is_(True), Interview.status == "completed")
    if college:
        q = q.filter(func.lower(User.college) == college.strip().lower())
    if grad_year:
        q = q.filter(User.grad_year == grad_year)
    if min_score:
        q = q.filter(Interview.score >= min_score)
    if location:
        q = q.filter(func.lower(User.location).like("%" + re.sub(r"[%_]", "", location.strip().lower()) + "%"))
    rows = []
    for iv, u in q.order_by(Interview.score.desc(), Interview.ended_at.asc()).limit(500):
        resume = db.get(Resume, iv.resume_id)
        skills = resume.parsed.get("skills", []) if resume else []
        if skill and skill.strip().lower() not in skills:
            continue
        first = db.query(Interview.score).filter(Interview.user_id == u.id, Interview.attempt_no == 1).scalar()
        rows.append({"student_id": u.id, "name": u.name, "college": u.college, "branch": u.branch, "grad_year": u.grad_year, "location": u.location,
                     "verdict": iv.verdict, "score": iv.score, "attempts": svc.attempts_for(db, u.id), "first_score": first, "skills": skills[:12],
                     "ats": resume.score if resume else None, "segments": iv.report["segments"], "date": iv.ended_at.date().isoformat()})
    if sort == "first":
        rows.sort(key=lambda r: -(r["first_score"] or 0))
    return rows


@app.get("/api/leaderboard")
def leaderboard(request: Request, college: str = "", skill: str = "", min_score: int = 0, grad_year: int | None = None, db: Session = Depends(get_db)):
    sec.rate_limit("board:" + sec.client_ip(request), 60, 60)
    rows = _board_rows(db, college[:120], skill[:40], max(0, min(100, min_score)), grad_year)[:100]
    public = [{k: r[k] for k in ("name", "college", "branch", "grad_year", "verdict", "score", "attempts", "skills")} | {"rank": i + 1} for i, r in enumerate(rows)]
    colleges = [c for (c,) in db.query(User.college).join(Interview, Interview.user_id == User.id).filter(Interview.published.is_(True), User.college != "").distinct().order_by(User.college)]
    return {"rows": public, "colleges": colleges}


# ============================================================== recruiter
@app.get("/api/recruiter/candidates")
def candidates(college: str = "", skill: str = "", min_score: int = 0, grad_year: int | None = None, location: str = "", sort: str = "score",
               db: Session = Depends(get_db), user: User = Depends(sec.recruiter_with_plan)):
    sec.rate_limit("cands:" + user.id, 40, 60)  # slows bulk scraping
    rows = _board_rows(db, college[:120], skill[:40], max(0, min(100, min_score)), grad_year, location[:80], sort)[:60]
    short = {s.student_id for s in db.query(Shortlist).filter(Shortlist.recruiter_id == user.id)}
    reqs = {r.student_id: r.status for r in db.query(ContactRequest).filter(ContactRequest.recruiter_id == user.id)}
    for r in rows:
        r["shortlisted"], r["request"] = r["student_id"] in short, reqs.get(r["student_id"])
    return {"rows": rows}


class StudentRef(BaseModel):
    student_id: str = Field(max_length=32)
    message: str = Field(default="", max_length=600)


def _published_student(db: Session, student_id: str) -> User:
    ok = db.query(Interview).filter(Interview.user_id == student_id, Interview.published.is_(True)).first()
    if not ok:
        raise HTTPException(404, "Candidate not found.")
    return db.get(User, student_id)


@app.post("/api/recruiter/shortlist")
def shortlist_add(body: StudentRef, db: Session = Depends(get_db), user: User = Depends(sec.recruiter_with_plan)):
    _published_student(db, body.student_id)
    if not db.query(Shortlist).filter(Shortlist.recruiter_id == user.id, Shortlist.student_id == body.student_id).first():
        db.add(Shortlist(recruiter_id=user.id, student_id=body.student_id))
        db.commit()
    return {"ok": True}


@app.delete("/api/recruiter/shortlist/{student_id}")
def shortlist_remove(student_id: str, db: Session = Depends(get_db), user: User = Depends(sec.recruiter_with_plan)):
    db.query(Shortlist).filter(Shortlist.recruiter_id == user.id, Shortlist.student_id == student_id).delete()
    db.commit()
    return {"ok": True}


@app.post("/api/recruiter/contact")
def contact_request(body: StudentRef, db: Session = Depends(get_db), user: User = Depends(sec.recruiter_with_plan)):
    if not user.recruiter_verified and user.role != "admin":
        raise HTTPException(403, "Your company is being verified. Contact requests open once that is done.")
    student = _published_student(db, body.student_id)
    if db.query(ContactRequest).filter(ContactRequest.recruiter_id == user.id, ContactRequest.student_id == student.id).first():
        raise HTTPException(409, "You have already sent this candidate a request.")
    limit = svc.PRODUCTS.get(user.plan, {}).get("contacts", 20)
    sent = db.query(func.count(ContactRequest.id)).filter(ContactRequest.recruiter_id == user.id, ContactRequest.created_at > now() - timedelta(days=30)).scalar()
    if sent >= limit:
        raise HTTPException(429, f"Your plan allows {limit} contact requests in 30 days.")
    msg = re.sub(r"[<>]", "", body.message).strip()
    db.add(ContactRequest(recruiter_id=user.id, student_id=student.id, message=msg))
    db.commit()
    svc.send_mail(student.email, f"{user.company or 'A recruiter'} wants to contact you on Hiremark",
                  f"Hello {student.name},\n\n{user.name} from {user.company} has asked for your contact details.\nApprove or decline here: {config.APP_ORIGIN}/app\n\nNothing is shared unless you approve.")
    return {"ok": True}


@app.get("/api/recruiter/requests")
def recruiter_requests(db: Session = Depends(get_db), user: User = Depends(sec.require_role("recruiter", "admin"))):
    out = []
    for r, s in db.query(ContactRequest, User).join(User, User.id == ContactRequest.student_id).filter(ContactRequest.recruiter_id == user.id).order_by(ContactRequest.created_at.desc()):
        approved = r.status == "approved"
        out.append({"id": r.id, "student_id": s.id, "name": s.name, "college": s.college, "status": r.status, "created_at": r.created_at.isoformat() + "Z",
                    "email": s.email if approved else None, "phone": s.phone if approved else None, "resume": approved})
    return {"requests": out}


@app.get("/api/recruiter/shortlist.csv")
def shortlist_csv(db: Session = Depends(get_db), user: User = Depends(sec.recruiter_with_plan)):
    if user.plan != "growth" and user.role != "admin":
        raise HTTPException(402, "Shortlist export is part of the Growth plan.")
    ids = [s.student_id for s in db.query(Shortlist).filter(Shortlist.recruiter_id == user.id)]
    approved = {r.student_id for r in db.query(ContactRequest).filter(ContactRequest.recruiter_id == user.id, ContactRequest.status == "approved")}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Name", "College", "Branch", "Graduation year", "Score", "Verdict", "Attempts", "Email (if approved)"])

    def safe(v):  # stop spreadsheet formula injection
        v = "" if v is None else str(v)
        return "'" + v if v[:1] in "=+-@" else v

    for r in _board_rows(db):
        if r["student_id"] in ids:
            u = db.get(User, r["student_id"])
            w.writerow([safe(x) for x in (r["name"], r["college"], r["branch"], r["grad_year"], r["score"], r["verdict"], r["attempts"], u.email if u.id in approved else "")])
    return PlainTextResponse(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=shortlist.csv"})


# Student side of contact requests
@app.get("/api/requests")
def my_requests(db: Session = Depends(get_db), user: User = Depends(sec.require_role("student"))):
    out = []
    for r, rec in db.query(ContactRequest, User).join(User, User.id == ContactRequest.recruiter_id).filter(ContactRequest.student_id == user.id).order_by(ContactRequest.created_at.desc()):
        out.append({"id": r.id, "company": rec.company, "recruiter": rec.name, "message": r.message, "status": r.status, "created_at": r.created_at.isoformat() + "Z"})
    return {"requests": out}


class DecisionIn(BaseModel):
    approve: bool


@app.post("/api/requests/{request_id}")
def decide_request(request_id: str, body: DecisionIn, db: Session = Depends(get_db), user: User = Depends(sec.require_role("student"))):
    r = db.get(ContactRequest, request_id)
    if not r or r.student_id != user.id:
        raise HTTPException(404, "Request not found.")
    r.status, r.decided_at = ("approved" if body.approve else "declined"), now()
    db.commit()
    return {"ok": True}


# ================================================================ billing
@app.get("/api/billing")
def billing(db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    wanted = "recruiter" if user.role == "recruiter" else "student"
    pays = db.query(Payment).filter(Payment.user_id == user.id, Payment.status == "paid").order_by(Payment.paid_at.desc()).limit(20)
    return {"products": [{"id": k, **{f: v[f] for f in ("name", "amount_paise", "blurb")}} for k, v in svc.PRODUCTS.items() if v["role"] == wanted],
            "mode": "live" if config.PAYMENTS_LIVE else "test" if config.PAYMENTS_MOCK else "off",
            "payments": [{"id": p.id, "product": svc.PRODUCTS[p.product]["name"], "amount_paise": p.amount_paise, "paid_at": p.paid_at.isoformat() + "Z", "ref": p.payment_id} for p in pays]}


class OrderIn(BaseModel):
    product: str = Field(max_length=24)


@app.post("/api/billing/order")
async def create_order(body: OrderIn, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    sec.rate_limit("order:" + user.id, 10, 600)
    product = svc.PRODUCTS.get(body.product)
    if not product or product["role"] != ("recruiter" if user.role == "recruiter" else "student"):
        raise HTTPException(422, "Unknown product.")
    if not user.email_verified:
        raise HTTPException(409, "Confirm your email address before paying.")
    pay = Payment(id=secrets.token_hex(16), user_id=user.id, product=body.product, amount_paise=product["amount_paise"], provider="razorpay" if config.PAYMENTS_LIVE else "mock", order_id="pending")
    if config.PAYMENTS_LIVE:
        try:
            pay.order_id = await svc.razorpay_create_order(product["amount_paise"], pay.id)
        except Exception:
            raise HTTPException(502, "The payment gateway did not respond. Nothing was charged; please try again.")
    elif config.PAYMENTS_MOCK:
        pay.order_id = "test_order_" + secrets.token_hex(8)
    else:
        raise HTTPException(503, "Payments are not switched on yet.")
    db.add(pay)
    db.commit()
    return {"order_id": pay.order_id, "amount_paise": pay.amount_paise, "name": product["name"], "key_id": config.RAZORPAY_KEY_ID, "mode": "live" if config.PAYMENTS_LIVE else "test"}


class VerifyIn(BaseModel):
    order_id: str = Field(max_length=64)
    payment_id: str = Field(default="", max_length=64)
    signature: str = Field(default="", max_length=128)


@app.post("/api/billing/verify")
def verify_payment(body: VerifyIn, request: Request, db: Session = Depends(get_db), user: User = Depends(sec.current_user)):
    pay = db.query(Payment).filter(Payment.order_id == body.order_id, Payment.user_id == user.id).first()
    if not pay:
        raise HTTPException(404, "Order not found.")
    if pay.provider == "razorpay":
        # Never trust the browser's "success": only the gateway's signature proves payment.
        if not svc.razorpay_signature_ok(body.order_id, body.payment_id, body.signature):
            raise HTTPException(400, "Payment could not be verified. If money was deducted it will be refunded automatically.")
        svc.fulfil(db, pay, body.payment_id)
    elif config.PAYMENTS_MOCK:
        svc.fulfil(db, pay, "test_pay_" + secrets.token_hex(6))
    else:
        raise HTTPException(400, "Payment could not be verified.")
    db.refresh(user)
    return {"user": user_out(user, request)}


@app.post("/api/billing/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    if not svc.razorpay_webhook_ok(raw, request.headers.get("x-razorpay-signature", "")):
        raise HTTPException(400, "Bad signature.")
    event = json.loads(raw)
    if event.get("event") in ("payment.captured", "order.paid"):
        entity = event.get("payload", {}).get("payment", {}).get("entity", {})
        pay = db.query(Payment).filter(Payment.order_id == entity.get("order_id", "")).first()
        if pay and entity.get("amount") == pay.amount_paise:
            svc.fulfil(db, pay, entity.get("id", ""))
    return {"ok": True}


# ================================================================== admin
@app.get("/api/admin/overview")
def admin_overview(db: Session = Depends(get_db), user: User = Depends(sec.require_role("admin"))):
    usage = db.query(LlmUsage).order_by(LlmUsage.day.desc()).limit(7).all()
    recruiters = db.query(User).filter(User.role == "recruiter").order_by(User.created_at.desc()).limit(100).all()
    return {
        "counts": {"students": db.query(func.count(User.id)).filter(User.role == "student").scalar(), "recruiters": len(recruiters),
                   "interviews": db.query(func.count(Interview.id)).scalar(), "active": svc.active_count(db), "capacity": config.MAX_CONCURRENT_INTERVIEWS,
                   "revenue_paise": db.query(func.coalesce(func.sum(Payment.amount_paise), 0)).filter(Payment.status == "paid", Payment.provider == "razorpay").scalar()},
        "ai": {"enabled": llm.enabled(), "budget": config.LLM_DAILY_CALL_BUDGET, "days": [{"day": u.day, "calls": u.calls, "failures": u.failures, "avg_ms": round(u.avg_ms)} for u in usage]},
        "runner": "judge0" if config.JUDGE0_URL else "local (development only)" if config.ALLOW_LOCAL_RUNNER else "not configured",
        "recruiters": [{"id": r.id, "name": r.name, "email": r.email, "company": r.company, "verified": r.recruiter_verified, "plan": r.plan} for r in recruiters],
    }


class VerifyRecruiterIn(BaseModel):
    verified: bool


@app.post("/api/admin/recruiters/{recruiter_id}")
def admin_verify(recruiter_id: str, body: VerifyRecruiterIn, db: Session = Depends(get_db), user: User = Depends(sec.require_role("admin"))):
    r = db.get(User, recruiter_id)
    if not r or r.role != "recruiter":
        raise HTTPException(404, "Recruiter not found.")
    r.recruiter_verified = body.verified
    db.commit()
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"ok": True}
