# Hiremark

A 40-minute AI interview for SDE freshers, with a built-in code editor, that turns the result into proof recruiters can search.

## What is built

| Area | What works |
|---|---|
| Accounts | Student, recruiter and admin roles; email confirmation; profile; account deletion |
| Resume | PDF upload, six rule-based checks, score out of 100, fixes, interview unlocks at 60 |
| Booking | Ten interviewers, hourly slots for seven days, "start now", 20 rooms at once |
| Interview room | Laid out like a video call: camera and microphone required, the interviewer listens throughout, answers clarifying questions, stays quiet while you think aloud, repeats questions and gives hints when asked. Code editor (Python, C++, Java, JavaScript) with Run and Submit, hidden tests, five timed segments |
| Integrity | Outside paste and drag blocked, tab and full-screen checks, in-browser face check, three warnings end the interview |
| Result | Verdict, score, segment scores, best answer to every question, three fixes, integrity log, transcript |
| Leaderboard | Opt-in publishing, latest attempt counts, attempts shown, college and skill filters |
| Recruiters | Paid plans, candidate search, shortlists, contact requests that the student approves, CSV export |
| Payments | Razorpay orders, server-side signature check, webhook; simulated checkout when no keys are set |
| Admin | Recruiter verification, room usage, AI usage, revenue |

Not built yet: resume-based job search, the funded-startups list, the readiness tracker, 3D avatars and the Kokoro voice (the room uses drawn portraits and the browser's voice), college (batch) accounts.

## Run it locally

Backend (Python 3.11+):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/uvicorn app.main:app --port 8000
```

Frontend (Node 20+):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in Chrome. With no mail server set, the confirmation link is shown on the dashboard. To try a short interview, add `INTERVIEW_TIME_SCALE=0.15` to `backend/.env` (ignored in production).

Tests:

```bash
cd backend && .venv/bin/python -m pytest tests -q
```

`docs/browser-walkthrough.js` drives the whole product in a real browser with Playwright.

## What you must set up before real students use it

1. **AI keys.** Create free keys for Gemini (Google AI Studio) and Groq and put them in `backend/.env`. Without them the interviewer uses fixed wording and keyword-based assessment. The calls to these providers are written but have not been tested with real keys.
2. **Code runner.** Install Judge0 CE 1.13.1 or newer on its own VM and set `JUDGE0_URL`. The local runner used in development is not a security sandbox and is refused when `ENV=production`.
3. **Razorpay.** Add your key id, key secret and webhook secret. Point the webhook at `/api/billing/webhook` for the `payment.captured` event. Live checkout has not been tested here.
4. **Database.** Set `DATABASE_URL` to PostgreSQL (for example Supabase's free tier) and install `psycopg[binary]`.
5. **Email.** Set the SMTP values so confirmation links are sent.
6. **Secrets.** Set `ENV=production`, a random `SECRET_KEY`, `APP_ORIGIN` to your https address and `ADMIN_EMAILS`.
7. **Hosting.** Serve the frontend and the API behind HTTPS on one domain. Set `BACKEND_URL` for the frontend so `/api` is proxied to the API. Run the API as a single process: rate limits and interview locks are kept in memory.

See `SECURITY.md` for the risks and how each is handled.

## How the score is produced

| Segment | Weight | From |
|---|---|---|
| DSA | 40% | Hidden tests 60, explanation 25, speed 15, minus 5 per hint |
| Development and resume | 30% | Key points covered in two resume questions and one planted bug |
| Core CS | 20% | Key points covered in three questions with follow-ups |
| Communication | 10% | Introduction and behavioural answer |

85 and above is Strong hire, 70 Hire, 55 Lean no hire, below that No hire. The AI model may suggest that an answer covered a key point, but only when it quotes at least three words the student actually said; the code checks the quote.
