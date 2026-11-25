"use client";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, rupees, User } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { AppShell, PageTitle } from "../../../components/shell";
import { Button, Eyebrow, Notice, Panel, Spinner } from "../../../components/ui";

type Product = { id: string; name: string; amount_paise: number; blurb: string };
type Billing = { products: Product[]; mode: "live" | "test" | "off"; payments: { id: string; product: string; amount_paise: number; paid_at: string; ref: string }[] };
type Order = { order_id: string; amount_paise: number; name: string; key_id: string; mode: "live" | "test" };
type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: () => void) => void } } }

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function BillingPage() {
  const { user, setUser } = useAuth();
  const [b, setB] = useState<Billing | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [testOrder, setTestOrder] = useState<Order | null>(null);

  const load = useCallback(() => api<Billing>("/billing").then(setB), []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  if (!b || !user) return <Spinner />;

  const confirm = async (body: Record<string, string>, name: string) => {
    // The server checks the gateway's signature; the browser's word is never enough.
    const d = await api<{ user: User }>("/billing/verify", { body });
    setUser(d.user);
    setMsg({ tone: "good", text: `Payment received for ${name}.` });
    load();
  };

  const buy = async (p: Product) => {
    setBusy(p.id); setMsg(null);
    try {
      const order = await api<Order>("/billing/order", { body: { product: p.id } });
      if (order.mode === "test") { setTestOrder(order); setBusy(""); return; }
      if (!(await loadRazorpay()) || !window.Razorpay) throw new Error("The payment window could not be loaded. Check your connection and try again.");
      const rzp = new window.Razorpay({
        key: order.key_id, order_id: order.order_id, amount: order.amount_paise, currency: "INR", name: "Hiremark", description: order.name,
        prefill: { name: user.name, email: user.email, contact: user.phone }, theme: { color: "#0c0c0d" },
        handler: (r: RzpResponse) => confirm({ order_id: r.razorpay_order_id, payment_id: r.razorpay_payment_id, signature: r.razorpay_signature }, order.name).catch((e) => setMsg({ tone: "bad", text: e.message })),
        modal: { ondismiss: () => setBusy("") },
      });
      rzp.on("payment.failed", () => setMsg({ tone: "bad", text: "The payment did not go through. Nothing was added to your account." }));
      rzp.open();
    } catch (e) { setMsg({ tone: "bad", text: (e as Error).message }); }
    setBusy("");
  };

  const recruiter = user.role === "recruiter";
  return (
    <>
      <PageTitle eyebrow={recruiter ? "Plan" : "Billing"} title={recruiter ? "Recruiter plans" : "Interview credits"}
        sub={recruiter ? (user.plan ? `Your ${user.plan === "growth" ? "Growth" : "Starter"} plan is active until ${fmtDate(user.plan_expires_at!)}.` : "A plan opens candidate search, shortlists and contact requests for 30 days.")
          : `You have ${user.free_interview_available ? "1 free interview" : "no free interview left"} and ${user.credits} paid credit${user.credits === 1 ? "" : "s"}. One credit is used when an interview starts.`} />
      {msg && <div className="mb-5"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {b.mode === "test" && <div className="mb-5"><Notice tone="warn">Test mode: Razorpay keys are not configured on this server, so checkout is simulated and no money moves.</Notice></div>}
      {b.mode === "off" && <div className="mb-5"><Notice tone="warn">Payments are not switched on yet.</Notice></div>}

      <div className="grid gap-4 md:grid-cols-2">
        {b.products.map((p) => (
          <Panel key={p.id} className="flex flex-col p-6">
            <p className="text-sm text-muted">{p.name}</p>
            <p className="num mt-3 text-[40px] leading-none">{rupees(p.amount_paise)}</p>
            <p className="mb-6 mt-3 text-sm leading-relaxed text-muted">{p.blurb}</p>
            <Button className="mt-auto" busy={busy === p.id} disabled={b.mode === "off"} onClick={() => buy(p)}>Pay {rupees(p.amount_paise)}</Button>
          </Panel>
        ))}
      </div>

      {testOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" role="dialog" aria-modal="true" aria-label="Test checkout">
          <Panel className="w-full max-w-sm p-6">
            <Eyebrow>Test checkout</Eyebrow>
            <p className="mt-3 text-[19px] text-fg">{testOrder.name}</p>
            <p className="num mt-1 text-[32px]">{rupees(testOrder.amount_paise)}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">This stands in for the Razorpay window while no keys are configured. No money is charged.</p>
            <div className="mt-6 flex gap-2">
              <Button className="flex-1" onClick={() => { const o = testOrder; setTestOrder(null); confirm({ order_id: o.order_id }, o.name).catch((e) => setMsg({ tone: "bad", text: e.message })); }}>Simulate successful payment</Button>
              <Button variant="secondary" onClick={() => setTestOrder(null)}>Cancel</Button>
            </div>
          </Panel>
        </div>
      )}

      <h2 className="mb-3 mt-12 text-[15px] font-medium text-fg">Payment history</h2>
      {b.payments.length === 0 ? <p className="text-sm text-faint">No payments yet.</p> : (
        <Panel className="divide-y divide-line">
          {b.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
              <span className="text-fg">{p.product}</span><span className="num hidden text-faint sm:block">{p.ref}</span><span className="text-muted">{fmtDate(p.paid_at)}</span><span className="num text-fg">{rupees(p.amount_paise)}</span>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
export default function Page() { return <AppShell role="any"><BillingPage /></AppShell>; }
