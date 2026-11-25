"""Mail, payments and shared queries."""
import hashlib
import hmac
import logging
import smtplib
import threading
from datetime import timedelta
from email.message import EmailMessage

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import config, engine
from .models import Booking, Interview, Payment, User, now

log = logging.getLogger("hiremark")

# ------------------------------------------------------------------ mail
def send_mail(to: str, subject: str, body: str) -> None:
    if not config.SMTP_HOST:
        # Message bodies can hold confirmation links, so they are printed only in development.
        if config.IS_PROD:
            log.error("Mail not sent: SMTP_HOST is not configured (subject=%s)", subject)
        else:
            log.info("MAIL (no SMTP configured) to=%s subject=%s\n%s", to, subject, body)
        return

    def _send():
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = config.MAIL_FROM, to, subject
        msg.set_content(body)
        try:
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as s:
                s.starttls()
                if config.SMTP_USER:
                    s.login(config.SMTP_USER, config.SMTP_PASSWORD)
                s.send_message(msg)
        except Exception:
            log.exception("mail send failed")

    threading.Thread(target=_send, daemon=True).start()


# -------------------------------------------------------------- products
PRODUCTS = {
    "pack1": {"name": "1 interview", "amount_paise": 14900, "role": "student", "credits": 1, "blurb": "One 40-minute interview with the full report."},
    "pack3": {"name": "3 interviews", "amount_paise": 39900, "role": "student", "credits": 3, "blurb": "Three interviews. Save ₹48 against buying singly."},
    "starter": {"name": "Recruiter Starter", "amount_paise": 499900, "role": "recruiter", "plan": "starter", "days": 30, "contacts": 20,
                "blurb": "Search and filter every published result, shortlists, 20 contact requests a month."},
    "growth": {"name": "Recruiter Growth", "amount_paise": 1499900, "role": "recruiter", "plan": "growth", "days": 30, "contacts": 200,
               "blurb": "Everything in Starter, 200 contact requests a month and shortlist export."},
}


async def razorpay_create_order(amount_paise: int, receipt: str) -> str:
    async with httpx.AsyncClient(timeout=15, auth=(config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET)) as client:
        r = await client.post("https://api.razorpay.com/v1/orders", json={"amount": amount_paise, "currency": "INR", "receipt": receipt})
        r.raise_for_status()
        return r.json()["id"]


def razorpay_signature_ok(order_id: str, payment_id: str, signature: str) -> bool:
    expected = hmac.new(config.RAZORPAY_KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def razorpay_webhook_ok(raw_body: bytes, signature: str) -> bool:
    if not config.RAZORPAY_WEBHOOK_SECRET:
        return False
    expected = hmac.new(config.RAZORPAY_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def fulfil(db: Session, payment: Payment, payment_id: str) -> None:
    """Grant what was bought. Safe to call twice (checkout callback and webhook can both arrive)."""
    claimed = db.query(Payment).filter(Payment.id == payment.id, Payment.status != "paid").update(
        {"status": "paid", "payment_id": payment_id, "paid_at": now()})
    if not claimed:
        db.rollback()
        return
    product = PRODUCTS[payment.product]
    user = db.get(User, payment.user_id)
    if "credits" in product:
        user.credits = User.credits + product["credits"]
    else:
        base = user.plan_expires_at if user.plan_expires_at and user.plan_expires_at > now() and user.plan == product["plan"] else now()
        user.plan, user.plan_expires_at = product["plan"], base + timedelta(days=product["days"])
    db.commit()


# ------------------------------------------------------------ interviews
def sweep(db: Session) -> None:
    """Close interviews whose browser went away, so they stop holding capacity."""
    cutoff = now() - timedelta(minutes=5)
    hard = now() - timedelta(seconds=engine.total_seconds() + 600)
    stale = db.query(Interview).filter(Interview.status == "active", (Interview.last_seen_at < cutoff) | (Interview.started_at < hard)).all()
    for iv in stale:
        state = dict(iv.state)
        engine.finish(db, iv, state, "terminated")
        engine.commit_state(db, iv, state)
        db.query(Booking).filter(Booking.id == iv.booking_id).update({"status": "completed"})
        db.query(Interview).filter(Interview.user_id == iv.user_id, Interview.id != iv.id).update({"published": False})
        db.commit()


def active_count(db: Session) -> int:
    sweep(db)
    return db.query(func.count(Interview.id)).filter(Interview.status == "active").scalar() or 0


def attempts_for(db: Session, user_id: str) -> int:
    return db.query(func.count(Interview.id)).filter(Interview.user_id == user_id, Interview.status != "active").scalar() or 0
