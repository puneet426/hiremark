"use client";
import { ArrowRight, Check, Circle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, fmtSlot } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { AppShell, PageTitle } from "../../components/shell";
import { Button, cx, Eyebrow, LinkButton, Notice, Panel, Spinner, Stamp } from "../../components/ui";

type Resume = { score: number; unlocked: boolean } | null;
type Booking = { id: string; slot_start: string; can_start: boolean; status: string; interview_id: string | null };
type Iv = { id: string; status: string; score: number | null; verdict: string; published: boolean; attempt_no: number; started_at: string; eligible: boolean };
type Req = { id: string; company: string; recruiter: string; message: string; status: string };

function Overview() {
  const { user, config, refresh } = useAuth();
  const [data, setData] = useState<{ resume: Resume; bookings: Booking[]; interviews: Iv[]; requests: Req[] } | null>(null);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [devLink, setDevLink] = useState("");

  const load = useCallback(async () => {
    const [r, b, i, q] = await Promise.all([
      api<{ resume: Resume }>("/resume"), api<{ bookings: Booking[] }>("/booking/options"),
      api<{ interviews: Iv[] }>("/interviews"), api<{ requests: Req[] }>("/requests"),
    ]);
    setData({ resume: r.resume, bookings: b.bookings, interviews: i.interviews, requests: q.requests });
  }, []);
  useEffect(() => { load().catch(() => {}); setDevLink(sessionStorage.getItem("hm_dev_verify") || ""); }, [load]);

  if (!user || !data) return <Spinner />;
  const { resume, bookings, interviews, requests } = data;
  const done = interviews.filter((i) => i.status !== "active");
  const active = interviews.find((i) => i.status === "active");
  const latest = done[0];
  const profileOk = !!(user.college && user.grad_year && user.consented);
  const unlock = config?.ats_unlock ?? 60;

  const steps = [
    { ok: user.email_verified, title: "Confirm your email", href: "", note: user.email },
    { ok: profileOk, title: "Complete your profile", href: "/app/profile", note: "College, graduation year and the interview terms" },
    { ok: !!resume?.unlocked, title: `Score ${unlock} or more on your resume`, href: "/app/resume", note: resume ? `Current score ${resume.score}` : "Upload a PDF to get your score" },
    { ok: bookings.length > 0 || done.length > 0, title: "Book your interview", href: "/app/book", note: user.free_interview_available ? "Your first interview is free" : `${user.credits} credit${user.credits === 1 ? "" : "s"} available` },
    { ok: done.length > 0, title: "Take the interview", href: "/app/book", note: `${config?.interview_minutes ?? 40} minutes, in the interview room` },
  ];
  const next = steps.find((s) => !s.ok);

  const resend = async () => {
    try {
      const d = await api<{ dev_verify_url?: string }>("/auth/resend", { method: "POST" });
      if (d.dev_verify_url) { setDevLink(d.dev_verify_url); sessionStorage.setItem("hm_dev_verify", d.dev_verify_url); }
      setVerifyMsg("A new confirmation link has been sent.");
    } catch (e) { setVerifyMsg((e as Error).message); }
  };
  const decide = async (id: string, approve: boolean) => { await api(`/requests/${id}`, { body: { approve } }); load(); };

  return (
    <>
      <PageTitle eyebrow="Overview" title={`Hello, ${user.name.split(" ")[0]}.`}
        sub={latest ? "Your latest result is below. Book another interview to improve it." : "Five steps stand between you and your first result."} />

      {!user.email_verified && (
        <div className="mb-6 space-y-2">
          <Notice tone="warn">
            Confirm your email to book an interview. We sent a link to {user.email}.{" "}
            <button className="underline underline-offset-4" onClick={resend}>Send it again</button>
            {verifyMsg && <span className="ml-2 text-muted">{verifyMsg}</span>}
          </Notice>
          {devLink && (
            <Notice>Development mode, no mail server configured: <a className="text-fg underline underline-offset-4" href={devLink} onClick={() => { sessionStorage.removeItem("hm_dev_verify"); setTimeout(refresh, 1500); }}>open your confirmation link</a>.</Notice>
          )}
        </div>
      )}

      {active && <div className="mb-6"><Notice tone="warn">You have an interview in progress. <Link className="underline underline-offset-4" href={`/interview/${active.id}`}>Return to the interview room</Link></Notice></div>}

      {requests.filter((r) => r.status === "pending").map((r) => (
        <Panel key={r.id} className="mb-4 flex flex-wrap items-center justify-between gap-4 border-mark/40 p-5">
          <div>
            <p className="text-[15px] text-fg">{r.company} would like your contact details</p>
            <p className="mt-1 text-sm text-muted">{r.recruiter}{r.message ? `: “${r.message}”` : ""}</p>
            <p className="mt-1 text-[12px] text-faint">If you approve, they will see your email, phone number and resume.</p>
          </div>
          <div className="flex gap-2"><Button size="sm" onClick={() => decide(r.id, true)}>Approve</Button><Button size="sm" variant="secondary" onClick={() => decide(r.id, false)}>Decline</Button></div>
        </Panel>
      ))}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Panel>
          <div className="border-b border-line px-5 py-4"><Eyebrow>Your path</Eyebrow></div>
          <ol>
            {steps.map((s, i) => {
              const isNext = s === next;
              const body = (
                <div className={cx("flex items-center gap-4 border-b border-line px-5 py-4 last:border-0", isNext && "bg-raised")}>
                  {s.ok ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-good/15"><Check className="h-3.5 w-3.5 text-good" /></span>
                    : <span className="flex h-6 w-6 items-center justify-center"><Circle className={cx("h-4 w-4", isNext ? "text-mark" : "text-line-strong")} /></span>}
                  <div className="flex-1">
                    <p className={cx("text-[15px]", s.ok ? "text-muted" : "text-fg")}>{s.title}</p>
                    <p className="text-[13px] text-faint">{s.note}</p>
                  </div>
                  <span className="num text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  {isNext && s.href && <ArrowRight className="h-4 w-4 text-mark" />}
                </div>
              );
              return <li key={s.title}>{s.href && !s.ok ? <Link href={s.href}>{body}</Link> : body}</li>;
            })}
          </ol>
        </Panel>

        <div className="space-y-5">
          {bookings[0] && !active && (
            <Panel className="p-5">
              <Eyebrow>Next interview</Eyebrow>
              <p className="mt-3 text-[19px] text-fg">{fmtSlot(bookings[0].slot_start)}</p>
              <p className="mt-1 text-sm text-muted">You can join from 5 minutes before until 15 minutes after this time.</p>
              <LinkButton href="/app/book" className="mt-4" variant={bookings[0].can_start ? "primary" : "secondary"}>{bookings[0].can_start ? "Join now" : "View booking"}</LinkButton>
            </Panel>
          )}
          {latest ? (
            <Panel className="p-5">
              <div className="flex items-start justify-between">
                <div><Eyebrow>Latest result · Attempt {latest.attempt_no}</Eyebrow><p className="num mt-3 text-[52px] leading-none">{latest.score}<span className="text-lg text-faint">/100</span></p></div>
                <Stamp verdict={latest.verdict} />
              </div>
              <p className="mt-4 text-sm text-muted">{fmtDate(latest.started_at)} · {latest.published ? "Published on the leaderboard" : latest.eligible ? "Not published" : "Not eligible for the leaderboard"}</p>
              <LinkButton href={`/app/results/${latest.id}`} variant="secondary" className="mt-4">Open the full report</LinkButton>
            </Panel>
          ) : (
            <Panel className="p-5">
              <Eyebrow>What the interview covers</Eyebrow>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>One easy DSA problem in the built-in editor, with hidden tests</li>
                <li>Questions on the projects and skills in your resume</li>
                <li>Operating systems, DBMS, networks and OOP</li>
                <li>One behavioural question</li>
              </ul>
            </Panel>
          )}
          <Panel className="flex items-center justify-between p-5">
            <div><Eyebrow>Interview credits</Eyebrow><p className="mt-2 text-[15px] text-fg">{user.free_interview_available ? "1 free interview" : `${user.credits} credit${user.credits === 1 ? "" : "s"}`}{user.free_interview_available && user.credits > 0 ? ` + ${user.credits} paid` : ""}</p></div>
            <LinkButton href="/app/billing" variant="secondary" size="sm">Buy more</LinkButton>
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function Page() { return <AppShell role="student"><Overview /></AppShell>; }
