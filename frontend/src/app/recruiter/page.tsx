"use client";
import { Bookmark, BookmarkCheck, Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { AppShell, PageTitle } from "../../components/shell";
import { Bar, Button, cx, Eyebrow, Input, LinkButton, Notice, Panel, scoreTone, Select, Spinner, Stamp } from "../../components/ui";

type Cand = {
  student_id: string; name: string; college: string; branch: string; grad_year: number | null; location: string; verdict: string; score: number;
  attempts: number; first_score: number | null; skills: string[]; ats: number | null; segments: { key: string; label: string; score: number }[];
  date: string; shortlisted: boolean; request: string | null;
};

function Candidates() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Cand[] | null>(null);
  const [needPlan, setNeedPlan] = useState(false);
  const [f, setF] = useState({ college: "", skill: "", min_score: "", grad_year: "", location: "", sort: "score" });
  const [onlyShort, setOnlyShort] = useState(false);
  const [sel, setSel] = useState<Cand | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    return api<{ rows: Cand[] }>("/recruiter/candidates?" + q).then((d) => { setRows(d.rows); setNeedPlan(false); })
      .catch((e) => { if (e.status === 402) setNeedPlan(true); else setMsg({ tone: "bad", text: e.message }); setRows([]); });
  }, [f]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  if (!rows) return <Spinner />;
  if (needPlan) {
    return (
      <>
        <PageTitle eyebrow="Candidates" title="Choose a plan to search candidates" sub="A plan opens search, filters, shortlists and contact requests for 30 days. The public leaderboard stays free to browse." />
        <div className="flex gap-3"><LinkButton href="/app/billing">See plans</LinkButton><LinkButton href="/leaderboard" variant="secondary">Public leaderboard</LinkButton></div>
      </>
    );
  }

  const toggle = async (c: Cand) => {
    if (c.shortlisted) await api(`/recruiter/shortlist/${c.student_id}`, { method: "DELETE" });
    else await api("/recruiter/shortlist", { body: { student_id: c.student_id } });
    await load();
    if (sel?.student_id === c.student_id) setSel({ ...c, shortlisted: !c.shortlisted });
  };
  const request = async () => {
    if (!sel) return;
    setMsg(null);
    try { await api("/recruiter/contact", { body: { student_id: sel.student_id, message: note } }); setMsg({ tone: "good", text: `Request sent to ${sel.name}. You will see their details once they approve.` }); setSel({ ...sel, request: "pending" }); setNote(""); load(); }
    catch (e) { setMsg({ tone: "bad", text: (e as Error).message }); }
  };
  const exportCsv = async () => {
    const res = await fetch("/api/recruiter/shortlist.csv", { credentials: "same-origin" });
    if (!res.ok) return setMsg({ tone: "bad", text: res.status === 402 ? "Shortlist export is part of the Growth plan." : "Export failed." });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a"); a.href = url; a.download = "shortlist.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const shown = onlyShort ? rows.filter((r) => r.shortlisted) : rows;

  return (
    <>
      <PageTitle eyebrow="Candidates" title="Search published results"
        sub="Every candidate chose to publish and passed the integrity checks. Contact details are shared only after the student approves your request."
        right={<Button variant="secondary" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5" />Export shortlist</Button>} />
      {user && !user.recruiter_verified && user.role !== "admin" && <div className="mb-5"><Notice tone="warn">Your company is being verified. You can search and shortlist now; contact requests open once verification is done.</Notice></div>}
      {msg && <div className="mb-5"><Notice tone={msg.tone}>{msg.text}</Notice></div>}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Input aria-label="College" placeholder="College" value={f.college} onChange={(e) => setF({ ...f, college: e.target.value })} />
        <Input aria-label="Skill" placeholder="Skill" value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })} />
        <Input aria-label="City" placeholder="City" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        <Select aria-label="Minimum score" value={f.min_score} onChange={(e) => setF({ ...f, min_score: e.target.value })}><option value="">Any score</option><option value="85">85+</option><option value="70">70+</option><option value="55">55+</option></Select>
        <Select aria-label="Graduation year" value={f.grad_year} onChange={(e) => setF({ ...f, grad_year: e.target.value })}><option value="">Any year</option>{[2026, 2027, 2028, 2029].map((y) => <option key={y}>{y}</option>)}</Select>
        <Select aria-label="Sort" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="score">Latest score</option><option value="first">First-attempt score</option></Select>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="accent-[#0a0a0a]" checked={onlyShort} onChange={(e) => setOnlyShort(e.target.checked)} />Show my shortlist only</label>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel className="divide-y divide-line self-start">
          {shown.length === 0 && <p className="px-5 py-12 text-center text-sm text-faint">No candidates match these filters.</p>}
          {shown.map((c) => (
            <div key={c.student_id} className={cx("flex cursor-pointer items-center gap-4 px-5 py-4 hover:bg-raised", sel?.student_id === c.student_id && "bg-raised")} onClick={() => { setSel(c); setMsg(null); }}>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-fg">{c.name}</p>
                <p className="truncate text-[13px] text-faint">{[c.college, c.branch, c.grad_year, c.location].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 truncate text-[12px] text-muted">{c.skills.slice(0, 7).join(", ")}</p>
              </div>
              <Stamp verdict={c.verdict} size="sm" />
              <div className="w-16 text-right"><p className="num text-[21px] leading-none text-fg">{c.score}</p><p className="mt-1 text-[11px] text-faint">{c.attempts} attempt{c.attempts > 1 ? "s" : ""}</p></div>
              <button aria-label={c.shortlisted ? "Remove from shortlist" : "Add to shortlist"} onClick={(e) => { e.stopPropagation(); toggle(c); }} className="rounded-lg p-2 text-muted hover:bg-line hover:text-fg">
                {c.shortlisted ? <BookmarkCheck className="h-4 w-4 text-mark" /> : <Bookmark className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </Panel>

        {sel ? (
          <Panel className="h-fit p-5 lg:sticky lg:top-20">
            <p className="text-[19px] text-fg">{sel.name}</p>
            <p className="text-[13px] text-faint">{[sel.college, sel.grad_year].filter(Boolean).join(" · ")}</p>
            <div className="mt-5 space-y-3">
              {sel.segments.map((s) => <div key={s.key}><div className="mb-1 flex justify-between text-[13px]"><span className="text-muted">{s.label}</span><span className="num text-fg">{s.score}</span></div><Bar value={s.score} tone={scoreTone(s.score)} /></div>)}
            </div>
            <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
              {[["Latest score", sel.score], ["First-attempt score", sel.first_score ?? "–"], ["Attempts", sel.attempts], ["Resume score", sel.ats ?? "–"], ["Interview date", sel.date]].map(([k, v]) => <div key={k as string} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="num text-fg">{v}</dd></div>)}
            </dl>
            <div className="mt-5 border-t border-line pt-4">
              <Eyebrow>Contact</Eyebrow>
              {sel.request ? <p className="mt-2 text-sm text-muted">Request {sel.request}. {sel.request === "approved" ? "Their details are under Contact requests." : sel.request === "pending" ? "Waiting for the student." : ""}</p> : (
                <>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} rows={3} placeholder="A short note: the role, the team, why you are reaching out." className="mt-2 w-full resize-none rounded-lg border border-line bg-ink px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-faint focus:outline-none" />
                  <Button className="mt-2 w-full" onClick={request}>Request contact details</Button>
                </>
              )}
            </div>
          </Panel>
        ) : <p className="hidden pt-10 text-center text-sm text-faint lg:block">Select a candidate to see segment scores.</p>}
      </div>
    </>
  );
}
export default function Page() { return <AppShell role="recruiter"><Candidates /></AppShell>; }
