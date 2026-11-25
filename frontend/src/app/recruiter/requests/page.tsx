"use client";
import { useEffect, useState } from "react";
import { api, fmtDate } from "../../../lib/api";
import { AppShell, PageTitle } from "../../../components/shell";
import { cx, Panel, Spinner } from "../../../components/ui";

type Req = { id: string; student_id: string; name: string; college: string; status: string; created_at: string; email: string | null; phone: string | null; resume: boolean };

function Requests() {
  const [rows, setRows] = useState<Req[] | null>(null);
  useEffect(() => { api<{ requests: Req[] }>("/recruiter/requests").then((d) => setRows(d.requests)).catch(() => setRows([])); }, []);
  if (!rows) return <Spinner />;
  return (
    <>
      <PageTitle eyebrow="Contact requests" title="Your requests" sub="A student's email, phone number and resume appear here only after they approve." />
      {rows.length === 0 ? <p className="text-sm text-faint">You have not sent any requests yet.</p> : (
        <Panel className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-[200px] flex-1"><p className="text-[15px] text-fg">{r.name}</p><p className="text-[13px] text-faint">{r.college} · sent {fmtDate(r.created_at)}</p></div>
              {r.status === "approved" ? (
                <div className="text-right text-sm"><p className="text-fg">{r.email}</p><p className="num text-muted">{r.phone || "No phone given"}</p>{r.resume && <a className="text-mark underline underline-offset-4" href={`/api/resume/file/${r.student_id}`}>Download resume</a>}</div>
              ) : null}
              <span className={cx("num rounded border px-2 py-0.5 text-[11px]", r.status === "approved" ? "border-good/40 text-good" : r.status === "declined" ? "border-bad/40 text-bad" : "border-line text-muted")}>{r.status}</span>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
export default function Page() { return <AppShell role="recruiter"><Requests /></AppShell>; }
