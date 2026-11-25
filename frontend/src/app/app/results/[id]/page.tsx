"use client";
import { ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, clock, fmtDate } from "../../../../lib/api";
import { AppShell } from "../../../../components/shell";
import { Interviewer, Portrait } from "../../../../components/portrait";
import { Bar, Button, cx, Eyebrow, LinkButton, Notice, Panel, scoreTone, Spinner, Stamp } from "../../../../components/ui";

type Review = { segment: string; topic: string; question: string; answer: string; covered: string[]; missed: string[]; best: string; asked: boolean; ratio: number };
type Result = {
  id: string; status: string; score: number; verdict: string; published: boolean; attempt_no: number; started_at: string; eligible: boolean; is_latest: boolean; interviewer: Interviewer;
  report: {
    segments: { key: string; label: string; score: number; weight: number }[];
    dsa: { title: string; passed: number; total: number; hints: number; submits: number; pass_seconds: number | null; language: string };
    review: Review[]; fixes: { area: string; detail: string }[];
    integrity: { warnings: number; events: { kind: string; label: string; detail: string; counted: boolean; at: string }[] }; eligible: boolean;
  };
  transcript: { role: string; text: string; segment: string }[];
};
const SEG: Record<string, string> = { intro: "Introduction", dsa: "DSA", dev: "Development and resume", core: "Core CS", wrap: "Wrap-up" };

function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<Result>(`/interviews/${id}/result`).then(setR).catch((e) => setError(e.message)); }, [id]);
  if (error) return <Notice tone="bad">{error}</Notice>;
  if (!r) return <Spinner label="Preparing your report" />;
  const rep = r.report;

  const publish = async (published: boolean) => {
    setBusy(true); setError("");
    try { const d = await api<{ published: boolean }>(`/interviews/${id}/publish`, { body: { published } }); setR({ ...r, published: d.published }); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="rise">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-8">
        <div>
          <Eyebrow>Interview result · Attempt {r.attempt_no} · {fmtDate(r.started_at)}</Eyebrow>
          <p className="num mt-4 text-[104px] leading-[0.9]">{r.score}<span className="text-2xl text-faint">/100</span></p>
          <div className="mt-5 flex items-center gap-3 text-sm text-muted"><Portrait person={r.interviewer} size={28} /> Interviewed by {r.interviewer.name}, {r.interviewer.title}</div>
        </div>
        <div className="pt-2 text-right">
          <Stamp verdict={r.verdict} size="lg" animate />
          {r.status === "terminated" && <p className="mt-4 max-w-[260px] text-[13px] text-bad">This interview was ended before completion. The score reflects only what was done.</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Panel className="p-6">
            <Eyebrow>Score by segment</Eyebrow>
            <div className="mt-5 space-y-4">
              {rep.segments.map((s) => (
                <div key={s.key}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm"><span className="text-fg">{s.label} <span className="text-faint">· {s.weight}% of the total</span></span><span className="num text-fg">{s.score}</span></div>
                  <Bar value={s.score} tone={scoreTone(s.score)} />
                </div>
              ))}
            </div>
          </Panel>

          {rep.fixes.length > 0 && (
            <Panel>
              <div className="border-b border-line px-5 py-4"><Eyebrow>Three things to fix first</Eyebrow></div>
              <ol className="divide-y divide-line">
                {rep.fixes.map((f, i) => (
                  <li key={i} className="flex gap-4 px-5 py-4"><span className="num pt-0.5 text-[13px] text-mark">{String(i + 1).padStart(2, "0")}</span><div><p className="text-[15px] text-fg">{f.area}</p><p className="mt-1 text-sm leading-relaxed text-muted">{f.detail}</p></div></li>
                ))}
              </ol>
            </Panel>
          )}

          <Panel>
            <div className="border-b border-line px-5 py-4"><Eyebrow>Every question, with the best answer</Eyebrow></div>
            <div className="divide-y divide-line">
              {rep.review.map((q, i) => (
                <div key={i}>
                  <button className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-raised" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                    <span className={cx("num w-9 text-sm", q.ratio >= 0.7 ? "text-good" : q.ratio >= 0.4 ? "text-warn" : "text-bad")}>{Math.round(q.ratio * 100)}</span>
                    <span className="flex-1"><span className="block text-[12px] text-faint">{q.topic || SEG[q.segment]}{!q.asked && " · not reached"}</span><span className="line-clamp-1 text-[15px] text-fg">{q.question.split("\n")[0]}</span></span>
                    <ChevronDown className={cx("h-4 w-4 text-faint transition-transform", open === i && "rotate-180")} />
                  </button>
                  {open === i && (
                    <div className="space-y-4 px-5 pb-6 pl-[4.5rem]">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{q.question}</p>
                      <div><Eyebrow>Your answer</Eyebrow><p className="mt-1.5 text-sm leading-relaxed text-fg">{q.answer || <span className="text-faint">No answer recorded.</span>}</p></div>
                      {(q.covered.length > 0 || q.missed.length > 0) && (
                        <ul className="space-y-1.5 text-sm">
                          {q.covered.map((c) => <li key={c} className="flex gap-2 text-muted"><span className="text-good">✓</span>{c}</li>)}
                          {q.missed.map((c) => <li key={c} className="flex gap-2 text-muted"><span className="text-bad">✕</span>{c}</li>)}
                        </ul>
                      )}
                      <div className="rounded-lg border border-line bg-ink p-4"><Eyebrow>Best answer</Eyebrow><p className="mt-1.5 text-sm leading-relaxed text-fg">{q.best}</p></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <button className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => setShowTranscript(!showTranscript)} aria-expanded={showTranscript}>
              <Eyebrow>Full transcript</Eyebrow><ChevronDown className={cx("h-4 w-4 text-faint transition-transform", showTranscript && "rotate-180")} />
            </button>
            {showTranscript && (
              <div className="space-y-3 border-t border-line px-5 py-5">
                {r.transcript.map((m, i) => (
                  <p key={i} className={cx("text-sm leading-relaxed", m.role === "student" ? "text-fg" : m.role === "system" ? "text-warn" : "text-muted")}>
                    <span className="num mr-2 text-[11px] text-faint">{m.role === "student" ? "You" : m.role === "system" ? "System" : r.interviewer.name}</span>{m.text}
                  </p>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel className="p-5">
            <Eyebrow>Leaderboard</Eyebrow>
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
            {!rep.eligible ? <p className="mt-3 text-sm leading-relaxed text-muted">This result cannot be published because the interview had integrity warnings or ended early.</p>
              : !r.is_latest ? <p className="mt-3 text-sm leading-relaxed text-muted">Only your latest interview can be published.</p>
              : r.published ? (<><p className="mt-3 text-sm leading-relaxed text-muted">Published. Your name, college, verdict, score, attempts and skills are visible on the board and to recruiters.</p><div className="mt-4 flex gap-2"><LinkButton href="/leaderboard" size="sm" variant="secondary">View board</LinkButton><Button size="sm" variant="ghost" busy={busy} onClick={() => publish(false)}>Unpublish</Button></div></>)
              : (<><p className="mt-3 text-sm leading-relaxed text-muted">Private. Publishing shows your name, college, branch, graduation year, verdict, score, attempts and skills. Your transcript stays private. You can unpublish at any time.</p><Button className="mt-4" busy={busy} onClick={() => publish(true)}>Publish this result</Button></>)}
          </Panel>

          <Panel className="p-5">
            <Eyebrow>Coding problem</Eyebrow>
            <p className="mt-3 text-[15px] text-fg">{rep.dsa.title}</p>
            <dl className="mt-3 space-y-2 text-sm">
              {[["Hidden tests passed", `${rep.dsa.passed} of ${rep.dsa.total}`], ["Language", rep.dsa.language], ["Submissions", String(rep.dsa.submits)], ["Hints used", String(rep.dsa.hints)], ["Time to pass", rep.dsa.pass_seconds != null ? clock(rep.dsa.pass_seconds) : "Not passed"]].map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="num text-fg">{v}</dd></div>
              ))}
            </dl>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center gap-2">{rep.integrity.warnings === 0 ? <ShieldCheck className="h-4 w-4 text-good" /> : <ShieldAlert className="h-4 w-4 text-warn" />}<Eyebrow>Integrity log</Eyebrow></div>
            <p className="mt-3 text-sm text-muted">{rep.integrity.warnings === 0 ? "No warnings." : `${rep.integrity.warnings} warning${rep.integrity.warnings > 1 ? "s" : ""}.`}</p>
            {rep.integrity.events.length > 0 && (
              <ul className="mt-3 space-y-2 text-[13px]">
                {rep.integrity.events.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3"><span className={e.counted ? "text-warn" : "text-muted"}>{e.label}{e.detail ? ` (${e.detail})` : ""}</span><span className="num text-faint">{new Date(e.at + "Z").toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></li>
                ))}
              </ul>
            )}
          </Panel>
          <LinkButton href="/app/book" variant="secondary" className="w-full">Book another interview</LinkButton>
        </div>
      </div>
    </div>
  );
}
export default function Page() { return <AppShell role="student"><ResultPage /></AppShell>; }
