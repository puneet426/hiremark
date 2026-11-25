"use client";
import { FileUp, Lock, Unlock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, fmtDate } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { AppShell, PageTitle } from "../../../components/shell";
import { Bar, Button, cx, Eyebrow, LinkButton, Notice, Panel, scoreTone, Spinner } from "../../../components/ui";

type Check = { key: string; label: string; weight: number; points: number; detail: string };
type Resume = { id: string; filename: string; score: number; breakdown: Check[]; fixes: { check: string; title: string; detail: string }[]; skills: string[]; projects: string[]; created_at: string; unlocked: boolean };

function ResumePage() {
  const { config } = useAuth();
  const [resume, setResume] = useState<Resume | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const unlock = config?.ats_unlock ?? 60;

  useEffect(() => { api<{ resume: Resume | null }>("/resume").then((d) => setResume(d.resume)).catch(() => setResume(null)); }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("Only PDF resumes are accepted.");
    if (file.size > 2 * 1024 * 1024) return setError("The file is larger than 2 MB. Compress it or remove images.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      setResume(await api<Resume>("/resume", { form }));
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  if (resume === undefined) return <Spinner />;
  return (
    <>
      <PageTitle eyebrow="Step 1" title="Resume score"
        sub={`Six checks, scored by fixed rules so the same resume always gets the same score. The interview unlocks at ${unlock}, and the interviewer will question whatever you list.`} />
      {error && <div className="mb-5"><Notice tone="bad">{error}</Notice></div>}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
            className={cx("rounded-lg border border-dashed p-6 text-center transition-colors", drag ? "border-mark bg-mark-dim/40" : "border-line-strong")}>
            <FileUp className="mx-auto h-6 w-6 text-muted" />
            <p className="mt-3 text-[15px] text-fg">{resume ? "Upload a new version" : "Upload your resume"}</p>
            <p className="mt-1 text-[13px] text-faint">PDF, up to 2 MB. Re-upload as often as you like.</p>
            <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Button className="mt-4" variant={resume ? "secondary" : "primary"} busy={busy} onClick={() => input.current?.click()}>{busy ? "Scoring" : "Choose file"}</Button>
          </div>
          {resume && (
            <Panel className="p-5">
              <Eyebrow>What the interviewer will see</Eyebrow>
              <p className="mt-3 text-[13px] text-muted">Skills</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{resume.skills.length ? resume.skills.map((s) => <span key={s} className="rounded border border-line px-2 py-0.5 text-[12px] text-muted">{s}</span>) : <span className="text-[13px] text-faint">None recognised</span>}</div>
              {resume.projects.length > 0 && <><p className="mt-4 text-[13px] text-muted">Projects</p><ul className="mt-1 space-y-1 text-[13px] text-fg">{resume.projects.map((p) => <li key={p}>{p}</li>)}</ul></>}
            </Panel>
          )}
        </div>

        {resume ? (
          <div className="space-y-5">
            <Panel className="p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Eyebrow>{resume.filename} · {fmtDate(resume.created_at)}</Eyebrow>
                  <p className="num mt-3 text-[72px] leading-none">{resume.score}<span className="text-xl text-faint">/100</span></p>
                </div>
                <div className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", resume.unlocked ? "border-good/40 text-good" : "border-warn/40 text-warn")}>
                  {resume.unlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {resume.unlocked ? "Interview unlocked" : `${unlock - resume.score} more points to unlock the interview`}
                </div>
              </div>
              <div className="relative mt-6">
                <Bar value={resume.score} tone={scoreTone(resume.score >= unlock ? 70 : 40)} />
                <span className="absolute -top-1 h-3.5 w-px bg-fg" style={{ left: `${unlock}%` }} /><span className="num absolute top-3 -translate-x-1/2 text-[11px] text-faint" style={{ left: `${unlock}%` }}>{unlock}</span>
              </div>
              {resume.unlocked && <LinkButton href="/app/book" className="mt-8">Book your interview</LinkButton>}
            </Panel>

            <Panel>
              <div className="border-b border-line px-5 py-4"><Eyebrow>How the score was calculated</Eyebrow></div>
              <div className="divide-y divide-line">
                {resume.breakdown.map((c) => (
                  <div key={c.key} className="grid items-center gap-x-5 gap-y-1 px-5 py-4 sm:grid-cols-[180px_90px_1fr]">
                    <span className="text-[15px] text-fg">{c.label}</span>
                    <span className="num text-sm"><span className={c.points === c.weight ? "text-good" : c.points >= c.weight * 0.6 ? "text-warn" : "text-bad"}>{c.points}</span><span className="text-faint"> / {c.weight}</span></span>
                    <span className="text-[13px] leading-relaxed text-muted">{c.detail}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {resume.fixes.length > 0 && (
              <Panel>
                <div className="border-b border-line px-5 py-4"><Eyebrow>Fix these first</Eyebrow></div>
                <ol className="divide-y divide-line">
                  {resume.fixes.map((f, i) => (
                    <li key={f.title} className="flex gap-4 px-5 py-4">
                      <span className="num pt-0.5 text-[13px] text-mark">{String(i + 1).padStart(2, "0")}</span>
                      <div><p className="text-[15px] text-fg">{f.title}</p><p className="mt-1 text-sm leading-relaxed text-muted">{f.detail}</p></div>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}
          </div>
        ) : (
          <Panel className="p-6">
            <Eyebrow>What is checked</Eyebrow>
            <div className="mt-4 divide-y divide-line">
              {[["Parseability", 20, "Text extracts cleanly; nothing hidden in images or tables"], ["Standard sections", 15, "Education, skills, projects, experience and contact"], ["SDE keywords", 25, "Skills that real fresher SDE job posts ask for"], ["Impact", 20, "Action verbs and measurable results in bullets"], ["Clarity and length", 10, "One page, short bullets, consistent dates"], ["Links", 10, "Email, phone, GitHub and LinkedIn"]].map(([l, w, d]) => (
                <div key={l as string} className="grid gap-x-5 py-3 sm:grid-cols-[180px_60px_1fr]"><span className="text-[15px] text-fg">{l}</span><span className="num text-sm text-faint">{w}%</span><span className="text-sm text-muted">{d}</span></div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}

export default function Page() { return <AppShell role="student"><ResumePage /></AppShell>; }
