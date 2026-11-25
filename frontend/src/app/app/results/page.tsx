"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate } from "../../../lib/api";
import { AppShell, PageTitle } from "../../../components/shell";
import { LinkButton, Panel, Spinner, Stamp } from "../../../components/ui";

type Iv = { id: string; status: string; score: number | null; verdict: string; published: boolean; attempt_no: number; started_at: string };

function Results() {
  const [rows, setRows] = useState<Iv[] | null>(null);
  useEffect(() => { api<{ interviews: Iv[] }>("/interviews").then((d) => setRows(d.interviews)).catch(() => setRows([])); }, []);
  if (!rows) return <Spinner />;
  return (
    <>
      <PageTitle eyebrow="Results" title="Your interviews" sub="Only your latest interview can be published. Every attempt is counted and shown beside your result." />
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-6 py-16 text-center">
          <p className="text-[15px] text-fg">No interviews yet.</p>
          <LinkButton href="/app/book" className="mt-5">Book your first interview</LinkButton>
        </div>
      ) : (
        <Panel className="divide-y divide-line">
          {rows.map((r) => (
            <Link key={r.id} href={r.status === "active" ? `/interview/${r.id}` : `/app/results/${r.id}`} className="flex items-center gap-5 px-5 py-4 hover:bg-raised">
              <span className="num w-10 text-[13px] text-faint">#{r.attempt_no}</span>
              <span className="flex-1"><span className="text-[15px] text-fg">{fmtDate(r.started_at)}</span><span className="block text-[13px] text-faint">{r.status === "active" ? "In progress" : r.published ? "Published" : "Private"}</span></span>
              {r.status !== "active" && <Stamp verdict={r.verdict} size="sm" />}
              <span className="num w-14 text-right text-[19px] text-fg">{r.score ?? "–"}</span>
            </Link>
          ))}
        </Panel>
      )}
    </>
  );
}
export default function Page() { return <AppShell role="student"><Results /></AppShell>; }
