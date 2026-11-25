"use client";
import { useCallback, useEffect, useState } from "react";
import { api, rupees } from "../../lib/api";
import { AppShell, PageTitle } from "../../components/shell";
import { Button, Eyebrow, Notice, Panel, Spinner } from "../../components/ui";

type Overview = {
  counts: { students: number; recruiters: number; interviews: number; active: number; capacity: number; revenue_paise: number };
  ai: { enabled: boolean; budget: number; days: { day: string; calls: number; failures: number; avg_ms: number }[] };
  runner: string; recruiters: { id: string; name: string; email: string; company: string; verified: boolean; plan: string }[];
};

function Admin() {
  const [o, setO] = useState<Overview | null>(null);
  const load = useCallback(() => api<Overview>("/admin/overview").then(setO), []);
  useEffect(() => { load().catch(() => {}); const t = setInterval(() => load().catch(() => {}), 15000); return () => clearInterval(t); }, [load]);
  if (!o) return <Spinner />;
  const verify = async (id: string, verified: boolean) => { await api(`/admin/recruiters/${id}`, { body: { verified } }); load(); };
  return (
    <>
      <PageTitle eyebrow="Admin" title="Operations" />
      {!o.ai.enabled && <div className="mb-5"><Notice tone="warn">No AI key is configured. Interviews are running with the scripted interviewer: fixed wording and keyword-based assessment.</Notice></div>}
      {o.runner.startsWith("local") && <div className="mb-5"><Notice tone="warn">Code runs with the local development runner. It is not a security sandbox. Set JUDGE0_URL before real students use this.</Notice></div>}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-5">
        {[["Students", o.counts.students], ["Recruiters", o.counts.recruiters], ["Interviews", o.counts.interviews], ["Rooms in use", `${o.counts.active}/${o.counts.capacity}`], ["Revenue", rupees(o.counts.revenue_paise)]].map(([k, v]) => (
          <div key={k as string} className="bg-panel p-5"><Eyebrow>{k}</Eyebrow><p className="num mt-2 text-[28px] text-fg">{v}</p></div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <div className="border-b border-line px-5 py-4"><Eyebrow>Recruiter verification</Eyebrow></div>
          {o.recruiters.length === 0 ? <p className="px-5 py-8 text-sm text-faint">No recruiter accounts yet.</p> : o.recruiters.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
              <div className="min-w-0 flex-1"><p className="text-sm text-fg">{r.company} <span className="text-faint">· {r.name}</span></p><p className="truncate text-[12px] text-faint">{r.email}{r.plan ? ` · ${r.plan}` : ""}</p></div>
              <Button size="sm" variant={r.verified ? "ghost" : "primary"} onClick={() => verify(r.id, !r.verified)}>{r.verified ? "Remove verification" : "Verify"}</Button>
            </div>
          ))}
        </Panel>
        <Panel>
          <div className="border-b border-line px-5 py-4"><Eyebrow>AI calls, last 7 days · daily budget {o.ai.budget}</Eyebrow></div>
          {o.ai.days.length === 0 ? <p className="px-5 py-8 text-sm text-faint">No AI calls recorded.</p> : (
            <table className="w-full text-sm"><tbody>{o.ai.days.map((d) => (
              <tr key={d.day} className="border-b border-line last:border-0"><td className="num px-5 py-2.5 text-muted">{d.day}</td><td className="num px-5 py-2.5 text-right text-fg">{d.calls} calls</td><td className="num px-5 py-2.5 text-right text-muted">{d.failures} failed</td><td className="num px-5 py-2.5 text-right text-muted">{d.avg_ms} ms</td></tr>
            ))}</tbody></table>
          )}
          <p className="border-t border-line px-5 py-3 text-[12px] text-faint">Code runner: {o.runner}</p>
        </Panel>
      </div>
    </>
  );
}
export default function Page() { return <AppShell role="admin"><Admin /></AppShell>; }
