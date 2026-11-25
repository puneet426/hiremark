import { Check } from "lucide-react";
import { Footer, PublicNav } from "../../components/shell";
import { Eyebrow, LinkButton } from "../../components/ui";

const plans = [
  { name: "First interview", price: "Free", unit: "once per verified student", cta: ["Start free", "/signup"], items: ["Full 40-minute interview", "Resume score with unlimited re-uploads", "Complete report with best answers", "Leaderboard publishing"] },
  { name: "Single interview", price: "₹149", unit: "per interview", cta: ["Create account", "/signup"], items: ["Everything in the free interview", "A different problem and question set", "Attempt count shown on your result"] },
  { name: "Pack of three", price: "₹399", unit: "₹133 per interview", cta: ["Create account", "/signup"], items: ["Three interviews, no expiry", "Track your score across attempts", "Best for a placement season"], featured: true },
];
const recruiter = [
  { name: "Starter", price: "₹4,999", unit: "per 30 days", items: ["Search every published result", "Filter by score, skill, college, year, city", "Shortlists", "20 contact requests"] },
  { name: "Growth", price: "₹14,999", unit: "per 30 days", items: ["Everything in Starter", "200 contact requests", "Shortlist export (CSV)", "Sort by first-attempt score"] },
];

function Plan({ p }: { p: { name: string; price: string; unit: string; items: string[]; cta?: string[]; featured?: boolean } }) {
  return (
    <div className={"flex flex-col rounded-lg border bg-panel p-6 " + (p.featured ? "border-mark/60" : "border-line")}>
      <p className="text-sm text-muted">{p.name}</p>
      <p className="num mt-3 text-[40px] leading-none text-fg">{p.price}</p>
      <p className="mt-2 text-[13px] text-faint">{p.unit}</p>
      <ul className="mb-6 mt-6 space-y-2.5 text-sm text-muted">
        {p.items.map((i) => <li key={i} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-good" />{i}</li>)}
      </ul>
      {p.cta && <LinkButton href={p.cta[1]} variant={p.featured ? "primary" : "secondary"} className="mt-auto">{p.cta[0]}</LinkButton>}
    </div>
  );
}

export default function Pricing() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-6xl px-5 py-16">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="display mt-4 max-w-2xl text-[52px]">One interview is free. After that, less than a movie ticket.</h1>
        <h2 className="mb-5 mt-14 text-[15px] font-medium text-fg">For students</h2>
        <div className="grid gap-4 md:grid-cols-3">{plans.map((p) => <Plan key={p.name} p={p} />)}</div>
        <h2 className="mb-5 mt-14 text-[15px] font-medium text-fg">For startups and recruiters</h2>
        <div className="grid gap-4 md:grid-cols-2">{recruiter.map((p) => <Plan key={p.name} p={{ ...p, cta: ["Create a recruiter account", "/signup?role=recruiter"] }} />)}</div>
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-faint">Prices include taxes where applicable. Payments are processed by Razorpay; Hiremark never sees or stores your card or UPI details. Colleges that want interviews for a whole batch can write to us for a per-student yearly price.</p>
      </main>
      <Footer />
    </>
  );
}
