import { Footer, PublicNav } from "../../components/shell";
import { Eyebrow, LinkButton } from "../../components/ui";

const points = [
  ["Every candidate sat the same interview", "A coding problem with hidden tests, questions on their own projects and core CS. Scores come from code, not from a model's opinion."],
  ["You see attempts, not just the best one", "The board shows a candidate's latest result and how many interviews they took. Sort by first-attempt score if you prefer."],
  ["Integrity is part of the record", "Results with any integrity warning cannot be published. Pasting outside code, leaving the tab and leaving full screen are all logged."],
  ["Contact with consent", "Send a request with a short note. The student approves before you see an email, phone number or resume."],
];

export default function Recruiters() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-6xl px-5 py-16">
        <Eyebrow>For startups and recruiters</Eyebrow>
        <h1 className="display mt-4 max-w-3xl text-[52px]">Hire freshers on what they did in the room, <span className="text-faint">not the name on the gate.</span></h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted">Search students from any college by interview score, skill, graduation year and city. Shortlist the ones who fit and ask for an introduction.</p>
        <div className="mt-9 flex gap-3">
          <LinkButton href="/signup?role=recruiter" size="lg">Create a recruiter account</LinkButton>
          <LinkButton href="/leaderboard" size="lg" variant="secondary">Browse the public board</LinkButton>
        </div>
        <div className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {points.map(([t, d]) => (
            <div key={t} className="border-t border-line pt-5">
              <h2 className="text-[17px] font-medium text-fg">{t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
