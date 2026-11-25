"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, User } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { AppShell, PageTitle } from "../../../components/shell";
import { Button, Field, Input, Notice, Panel, Select } from "../../../components/ui";

function Profile() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: user!.name, college: user!.college, branch: user!.branch, grad_year: user!.grad_year ? String(user!.grad_year) : "", phone: user!.phone, location: user!.location, company: user!.company });
  const [consent, setConsent] = useState(user!.consented);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");
  const student = user!.role === "student";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const d = await api<{ user: User }>("/profile", { method: "PUT", body: { ...f, grad_year: f.grad_year ? Number(f.grad_year) : null, consent } });
      setUser(d.user); setMsg({ tone: "good", text: "Profile saved." });
    } catch (err) { setMsg({ tone: "bad", text: (err as Error).message }); }
    setBusy(false);
  };
  const remove = async () => {
    try { await api("/account", { method: "DELETE" }); setUser(null); router.replace("/"); } catch (err) { setMsg({ tone: "bad", text: (err as Error).message }); }
  };

  return (
    <>
      <PageTitle eyebrow="Profile" title="Your details" sub={student ? "Your college and graduation year place you on the right leaderboard. Your phone number is shared only with recruiters you approve." : undefined} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Panel className="p-6">
          <form onSubmit={save} className="space-y-4">
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><Input required value={f.name} onChange={set("name")} maxLength={80} /></Field>
              <Field label="Email"><Input value={user!.email} disabled /></Field>
              {student ? (<>
                <Field label="College"><Input required value={f.college} onChange={set("college")} maxLength={120} placeholder="Full college name" /></Field>
                <Field label="Branch"><Input value={f.branch} onChange={set("branch")} maxLength={80} placeholder="e.g. Computer Science" /></Field>
                <Field label="Graduation year"><Select required value={f.grad_year} onChange={set("grad_year")}><option value="">Select</option>{[2025, 2026, 2027, 2028, 2029, 2030].map((y) => <option key={y}>{y}</option>)}</Select></Field>
                <Field label="Preferred city"><Input value={f.location} onChange={set("location")} maxLength={80} placeholder="e.g. Bengaluru" /></Field>
                <Field label="Phone" hint="Optional"><Input value={f.phone} onChange={set("phone")} maxLength={20} inputMode="tel" /></Field>
              </>) : <Field label="Company"><Input value={f.company} onChange={set("company")} maxLength={120} /></Field>}
            </div>
            {student && (
              <label className="flex gap-3 rounded-lg border border-line p-4 text-sm leading-relaxed text-muted">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[#ff5b38]" checked={consent} disabled={user!.consented} onChange={(e) => setConsent(e.target.checked)} />
                <span>I agree to the interview terms: my camera and microphone stay on during the interview, face checks run only in my browser and no video is stored, and Hiremark stores my resume, the text transcript, my code and the integrity log. I can delete all of it at any time.</span>
              </label>
            )}
            <Button type="submit" busy={busy}>Save profile</Button>
          </form>
        </Panel>
        <Panel className="h-fit p-5">
          <p className="text-[15px] text-fg">Delete account</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">Removes your account, resume files, interviews, transcripts and contact requests immediately. This cannot be undone.</p>
          <Field label='Type "delete" to confirm'><Input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} className="mt-3" /></Field>
          <Button variant="danger" className="mt-3" disabled={confirmDelete !== "delete"} onClick={remove}>Delete my account</Button>
        </Panel>
      </div>
    </>
  );
}
export default function Page() { return <AppShell role="any"><Profile /></AppShell>; }
