import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def uid() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(16), default="student")  # student | recruiter | admin
    name: Mapped[str] = mapped_column(String(80))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verify_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verify_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # student profile
    college: Mapped[str] = mapped_column(String(120), default="", index=True)
    branch: Mapped[str] = mapped_column(String(80), default="")
    grad_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    phone: Mapped[str] = mapped_column(String(20), default="")
    location: Mapped[str] = mapped_column(String(80), default="")
    # recruiter profile
    company: Mapped[str] = mapped_column(String(120), default="")
    recruiter_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    plan: Mapped[str] = mapped_column(String(16), default="")  # "" | starter | growth
    plan_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # credits
    free_interview_used: Mapped[bool] = mapped_column(Boolean, default=False)
    credits: Mapped[int] = mapped_column(Integer, default=0)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    csrf: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Resume(Base):
    __tablename__ = "resumes"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(200))
    stored_name: Mapped[str] = mapped_column(String(64))
    parsed: Mapped[dict] = mapped_column(JSON)
    score: Mapped[int] = mapped_column(Integer)
    breakdown: Mapped[list] = mapped_column(JSON)
    fixes: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    slot_start: Mapped[datetime] = mapped_column(DateTime, index=True)
    interviewer_id: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(16), default="booked")  # booked | started | completed | cancelled | missed
    credit_source: Mapped[str] = mapped_column(String(8))  # free | paid
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Interview(Base):
    __tablename__ = "interviews"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    booking_id: Mapped[str] = mapped_column(ForeignKey("bookings.id"), unique=True)
    resume_id: Mapped[str] = mapped_column(ForeignKey("resumes.id"))
    interviewer_id: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)  # active | completed | terminated
    started_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    # Server-owned state machine (segment index, question pointers, counters).
    state: Mapped[dict] = mapped_column(JSON, default=dict)
    plan: Mapped[dict] = mapped_column(JSON, default=dict)  # questions chosen for this interview
    code: Mapped[str] = mapped_column(Text, default="")
    language: Mapped[str] = mapped_column(String(16), default="python")
    warnings: Mapped[int] = mapped_column(Integer, default=0)
    hints: Mapped[int] = mapped_column(Integer, default=0)
    # result
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verdict: Mapped[str] = mapped_column(String(24), default="")
    report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)

    messages: Mapped[list["Message"]] = relationship(back_populates="interview", order_by="Message.seq")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(12))  # interviewer | student | system
    text: Mapped[str] = mapped_column(Text)
    segment: Mapped[str] = mapped_column(String(16))
    qid: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    interview: Mapped[Interview] = relationship(back_populates="messages")
    __table_args__ = (UniqueConstraint("interview_id", "seq"),)


class IntegrityEvent(Base):
    __tablename__ = "integrity_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str] = mapped_column(String(300), default="")
    counted: Mapped[bool] = mapped_column(Boolean, default=False)  # counted as a warning
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(8))  # run | submit
    language: Mapped[str] = mapped_column(String(16))
    code: Mapped[str] = mapped_column(Text)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    product: Mapped[str] = mapped_column(String(24))
    amount_paise: Mapped[int] = mapped_column(Integer)
    provider: Mapped[str] = mapped_column(String(12))  # razorpay | mock
    order_id: Mapped[str] = mapped_column(String(64), unique=True)
    payment_id: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(12), default="created")  # created | paid | failed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Shortlist(Base):
    __tablename__ = "shortlists"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recruiter_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    __table_args__ = (UniqueConstraint("recruiter_id", "student_id"),)


class ContactRequest(Base):
    __tablename__ = "contact_requests"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    recruiter_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(String(600), default="")
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending | approved | declined
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    __table_args__ = (UniqueConstraint("recruiter_id", "student_id"),)


class LlmUsage(Base):
    __tablename__ = "llm_usage"
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    calls: Mapped[int] = mapped_column(Integer, default=0)
    failures: Mapped[int] = mapped_column(Integer, default=0)
    avg_ms: Mapped[float] = mapped_column(Float, default=0.0)
