# Security

No system can be guaranteed free of vulnerabilities. This file lists the risks considered, what the code does about each, and what is still open. Have someone other than the authors test it before a public launch.

## Handled in code

| Risk | Control | Where |
|---|---|---|
| Stolen AI or payment keys | Keys are read from the environment on the server only; the browser never receives them | `backend/app/config.py` |
| Passwords | Argon2 hashes; equal-time check for unknown emails; minimum 10 characters | `security.py` |
| Session theft | Random session token in an HttpOnly, SameSite cookie (Secure in production); only its hash is stored | `security.py` |
| Cross-site request forgery | Every state-changing request needs a per-session token header and a matching origin | `security.py` |
| One user reading another's data | Every interview, resume, order and request is looked up with the owner's id; unknown ids return 404 | `main.py`, tested in `tests/test_flow.py` |
| Role bypass | Student, recruiter and admin routes are checked on the server; recruiter search needs an active plan | `security.py` |
| Resume or answer tricks the AI into a better score | The score is computed by code. An AI-suggested key point counts only if it quotes words the student really said | `engine.py`, tested |
| Student asks the AI for the solution | Solutions, key phrases and hidden tests are never sent to the AI during the interview | `engine.py` |
| Hidden tests leaking | Submit returns only counts and the first error type; inputs and expected outputs stay on the server | `main.py`, tested |
| Browser clock or rules bypassed | Timers, hint counts and warnings live on the server; a sudden large block of code is flagged server-side | `engine.py` |
| Outside code pasted or dragged in | Blocked in the editor and the answer box, and logged as a warning | `code-editor.tsx` |
| Malicious resume upload | PDF only, 2 MB limit, signature check, parsed in a separate process with CPU, memory and time limits, stored under a random name | `main.py`, `pdf_extract.py` |
| Stored files served as web pages | Resumes download as attachments with a sandbox policy; only the owner or an approved recruiter can fetch them | `main.py` |
| Script injection | React escapes all text; no raw HTML is rendered; a Content Security Policy limits scripts to this site and Razorpay | `next.config.ts` |
| Clickjacking | Framing by other sites is refused | `next.config.ts` |
| Fake payment success | Credits are granted only after the Razorpay signature is verified on the server; granting is idempotent; the webhook is signature-checked | `services.py`, tested |
| Spreadsheet formula injection in exports | Cells starting with `=`, `+`, `-` or `@` are neutralised | `main.py` |
| Bots burning the free AI quota | Sign-in required, per-user rate limits, a daily AI call budget, and a cap of 20 rooms | `security.py`, `llm.py` |
| Brute-force sign-in and signup floods | Rate limits per email and per address | `main.py` |
| Open redirect after sign-in | Only same-site paths are followed | `login/page.tsx` |
| Personal data sent to AI providers | Name, email, phone and links are removed from resume text before any AI call | `resume.py` |
| Camera privacy | Face checks run in the browser; no frame is uploaded or stored | `proctor.ts` |
| Recruiters harvesting contacts | Contact details appear only after the student approves; requests are capped per plan; search is rate-limited | `main.py` |
| Data deletion | Deleting an account removes files, interviews, transcripts and requests | `main.py`, tested |
| Third-party script risk | The editor and face-detection runtime are served from this site, not a CDN | `scripts/copy-assets.mjs` |

## Still open

| Risk | Why it is open | What to do |
|---|---|---|
| Code execution sandbox | The development runner only applies OS resource limits | Run Judge0 1.13.1+ on a separate VM with no secrets, no public address and no outbound internet |
| Help from a second device or person | No browser check can prevent it | Resume follow-ups and "explain your code" questions reduce it; describe results as AI-proctored, not verified |
| Client-side proctoring can be tampered with | A skilled user can alter page code so events are not sent | Server-side checks catch large inserts; treat the rest as deterrence |
| Fake accounts for repeat free interviews | Only the email address is confirmed | Add phone OTP or college email domain checks |
| Rate limits and locks are in memory | They reset on restart and do not span several server processes | Run one API process, or move them to Redis before scaling |
| Recruiter identity | Verification is a manual admin switch | Check the company domain and a business document before verifying |
| Free AI tiers may train on prompts | Provider terms differ and change | Read the terms; tell students in the consent text; move to a paid tier for real launches |
| Speech recognition | Chrome sends microphone audio to Google's speech service | State this in the privacy page; offer typed answers |
| Dependency vulnerabilities | New ones appear over time | Turn on Dependabot and run `npm audit` and `pip-audit` regularly |
| Server hardening | Depends on your host | SSH keys only, firewall, automatic updates, HTTPS, database backups |
| No independent security test | Only the authors' tests have run | Get a review before taking payments from the public |
