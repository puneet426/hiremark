"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { AppShell, Footer, PublicNav } from "../../components/shell";
import { cx, Eyebrow, Input, LinkButton, Select, Spinner, Stamp } from "../../components/ui";

type Row = { rank: number; name: string; college: string; branch: string; grad_year: number | null; verdict: string; score: number; attempts: number; skills: string[] };

function Board() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [colleges, setColleges] = useState<string[]>([]);
  const [f, setF] = useState({ college: "", skill: "", min_score: "", grad_year: "" });

  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
      api<{ rows: Row[]; colleges: string[] }>("/leaderboard?" + q).then((d) => { setRows(d.rows); setColleges(d.colleges); }).catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(t);
  }, [f]);

  return (
    <>
      <Eyebrow>Leaderboard</Eyebrow>
      <h1 className="display mt-4 text-[48px]">Published results</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">Every student here chose to publish. The board shows each student&apos;s latest interview and how many they have taken. Results with integrity warnings are not eligible.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Select aria-label="College" value={f.college} onChange={(e) => setF({ ...f, college: e.target.value })}>
          <option value="">All colleges</option>
          {colleges.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Input aria-label="Skill" placeholder="Skill, e.g. react" value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })} />
        <Select aria-label="Minimum score" value={f.min_score} onChange={(e) => setF({ ...f, min_score: e.target.value })}>
          <option value="">Any score</option><option value="85">85 and above</option><option value="70">70 and above</option><option value="55">55 and above</option>
        </Select>
        <Select aria-label="Graduation year" value={f.grad_year} onChange={(e) => setF({ ...f, grad_year: e.target.value })}>
          <option value="">Any year</option>{[2026, 2027, 2028, 2029].map((y) => <option key={y}>{y}</option>)}
        </Select>
      </div>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line px-6 py-16 text-center">
          <p className="text-[15px] text-fg">No published results match yet.</p>
          <p className="mt-2 text-sm text-muted">Take an interview and publish your result to be the first on this board.</p>
          <LinkButton href="/app" className="mt-6">Go to your dashboard</LinkButton>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-[12px] text-faint">
              <tr>{["#", "Student", "College", "Skills", "Verdict", "Attempts", "Score"].map((h, i) => <th key={h} className={cx("px-4 py-3 font-normal", i >= 5 && "text-right")}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.rank + r.name} className="hover:bg-panel">
                  <td className={cx("num px-4 py-3.5", r.rank <= 3 ? "text-mark" : "text-faint")}>{String(r.rank).padStart(2, "0")}</td>
                  <td className="px-4 py-3.5"><span className="text-fg">{r.name}</span><span className="block text-[12px] text-faint">{[r.branch, r.grad_year].filter(Boolean).join(" · ")}</span></td>
                  <td className="px-4 py-3.5 text-muted">{r.college}</td>
                  <td className="max-w-[260px] px-4 py-3.5 text-[12px] text-faint">{r.skills.slice(0, 5).join(", ")}</td>
                  <td className="px-4 py-3.5"><Stamp verdict={r.verdict} size="sm" /></td>
                  <td className="num px-4 py-3.5 text-right text-muted">{r.attempts}</td>
                  <td className="num px-4 py-3.5 text-right text-[17px] text-fg">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Leaderboard() {
  const { user, loading } = useAuth();
  if (!loading && user) return <AppShell role="any"><Board /></AppShell>;
  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-14"><Board /></main>
      <Footer />
    </>
  );
}
