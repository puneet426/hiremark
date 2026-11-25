"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fmtSlot } from "../../../lib/api";
import { AppShell, PageTitle } from "../../../components/shell";
import { Interviewer, Portrait } from "../../../components/portrait";
import { Button, cx, Eyebrow, LinkButton, Notice, Panel, Spinner } from "../../../components/ui";

type Slot = { start: string; left: number };
type Booking = { id: string; slot_start: string; interviewer_id: string; status: string; can_start: boolean; interview_id: string | null; join_closes: string };
type Options = { interviewers: Interviewer[]; slots: Slot[]; now_available: boolean; requirements: string[]; bookings: Booking[] };

function Book() {
  const router = useRouter();
  const [o, setO] = useState<Options | null>(null);
  const [who, setWho] = useState("");
  const [slot, setSlot] = useState("");
  const [day, setDay] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Options>("/booking/options").then(setO).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const days = useMemo(() => {
    const m = new Map<string, Slot[]>();
    o?.slots.forEach((s) => { const k = new Date(s.start).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); m.set(k, [...(m.get(k) || []), s]); });
    return [...m.entries()];
  }, [o]);
  useEffect(() => { if (!day && days[0]) setDay(days[0][0]); }, [days, day]);

  if (!o) return error ? <Notice tone="bad">{error}</Notice> : <Spinner />;
  const booking = o.bookings[0];

  const book = async () => {
    setBusy(true); setError("");
    try { await api("/booking", { body: { slot, interviewer_id: who } }); setSlot(""); await load(); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };
  const cancel = async () => { await api(`/booking/${booking.id}`, { method: "DELETE" }).catch((e) => setError(e.message)); load(); };

  if (booking) {
    const person = o.interviewers.find((i) => i.id === booking.interviewer_id)!;
    return (
      <>
        <PageTitle eyebrow="Step 2" title="Your interview is booked" />
        {error && <div className="mb-5"><Notice tone="bad">{error}</Notice></div>}
        <Panel className="flex flex-wrap items-center gap-6 p-6">
          <Portrait person={person} size={88} />
          <div className="flex-1">
            <p className="text-[21px] text-fg">{fmtSlot(booking.slot_start)}</p>
            <p className="mt-1 text-sm text-muted">With {person.name}, {person.title}. {person.style}</p>
            <p className="mt-2 text-[13px] text-faint">{booking.can_start || booking.status === "started" ? "The room is open now." : "The room opens 5 minutes before this time and closes 15 minutes after."}</p>
          </div>
          <div className="flex gap-2">
            {booking.status === "started" && booking.interview_id ? <LinkButton href={`/interview/${booking.interview_id}`}>Return to the room</LinkButton>
              : <><Button disabled={!booking.can_start} onClick={() => router.push(`/interview/check/${booking.id}`)}>Enter the interview room</Button><Button variant="secondary" onClick={cancel}>Cancel</Button></>}
          </div>
        </Panel>
        <Panel className="mt-5 p-6">
          <Eyebrow>Before you join</Eyebrow>
          <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
            <li>Use Chrome on a laptop or desktop.</li><li>Sit somewhere quiet, with your face clearly lit.</li>
            <li>Close other tabs and applications.</li><li>Keep 40 uninterrupted minutes.</li>
          </ul>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageTitle eyebrow="Step 2" title="Book your interview" sub="Choose who interviews you and when. Each interviewer runs the same structure with a different manner." />
      {error && <div className="mb-5"><Notice tone="bad">{error}</Notice></div>}
      {o.requirements.length > 0 && (
        <div className="mb-6"><Notice tone="warn"><span className="text-fg">Before you can book:</span> {o.requirements.join(" ")} <LinkButton href={o.requirements[0].includes("credit") ? "/app/billing" : o.requirements[0].includes("esume") ? "/app/resume" : o.requirements[0].includes("email") ? "/app" : "/app/profile"} variant="secondary" size="sm" className="ml-2">Fix this</LinkButton></Notice></div>
      )}

      <Eyebrow>1 · Interviewer</Eyebrow>
      <div className="mb-10 mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="radiogroup" aria-label="Interviewer">
        {o.interviewers.map((p) => (
          <button key={p.id} role="radio" aria-checked={who === p.id} onClick={() => setWho(p.id)}
            className={cx("rounded-lg border p-4 text-left transition-colors", who === p.id ? "border-mark bg-mark-dim/40" : "border-line bg-panel hover:border-line-strong")}>
            <Portrait person={p} size={56} />
            <p className="mt-3 text-[15px] text-fg">{p.name}</p>
            <p className="text-[12px] text-faint">{p.title}</p>
            <p className="mt-2 text-[13px] leading-snug text-muted">{p.style}</p>
          </button>
        ))}
      </div>

      <Eyebrow>2 · Time</Eyebrow>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={!o.now_available} onClick={() => setSlot("now")}
          className={cx("rounded-lg border px-4 py-2 text-sm disabled:opacity-40", slot === "now" ? "border-mark bg-mark-dim/40 text-fg" : "border-line text-muted hover:text-fg")}>
          Start now{!o.now_available && " (all rooms busy)"}
        </button>
        {days.map(([d]) => (
          <button key={d} onClick={() => setDay(d)} className={cx("rounded-lg border px-4 py-2 text-sm", day === d && slot !== "now" ? "border-line-strong bg-raised text-fg" : "border-line text-muted hover:text-fg")}>{d}</button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {(days.find(([d]) => d === day)?.[1] || []).map((s) => (
          <button key={s.start} disabled={s.left === 0} onClick={() => setSlot(s.start)}
            className={cx("rounded-lg border px-2 py-2.5 text-center disabled:opacity-35", slot === s.start ? "border-mark bg-mark-dim/40" : "border-line bg-panel hover:border-line-strong")}>
            <span className="num block text-sm text-fg">{new Date(s.start).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
            <span className="block text-[11px] text-faint">{s.left === 0 ? "Full" : `${s.left} left`}</span>
          </button>
        ))}
      </div>

      <div className="sticky bottom-0 mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-ink py-4">
        <p className="text-sm text-muted">{who && slot ? <>With <span className="text-fg">{o.interviewers.find((i) => i.id === who)?.name}</span>, {slot === "now" ? "starting now" : fmtSlot(slot)}</> : "Choose an interviewer and a time."}</p>
        <Button disabled={!who || !slot || o.requirements.length > 0} busy={busy} onClick={book}>Confirm booking</Button>
      </div>
    </>
  );
}

export default function Page() { return <AppShell role="student"><Book /></AppShell>; }
