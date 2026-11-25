import { Footer, PublicNav } from "../../components/shell";
import { Eyebrow } from "../../components/ui";

const rows = [
  ["Your resume", "Stored privately. Used to compute your resume score and to choose interview questions. Shared with a recruiter only after you approve that recruiter's contact request."],
  ["Camera", "Used only inside your browser to check that one face is visible. No video or image is sent to our servers or stored anywhere."],
  ["Microphone", "Your speech is turned into text by your browser's speech service; in Chrome this means the audio is processed by Google. We store only the text transcript, never audio. You can type your answers instead."],
  ["Interview record", "We store the transcript, your code submissions, scores and the integrity log (for example tab switches). Only you can see them."],
  ["AI providers", "When the AI interviewer is switched on, the text of your answers, your listed skills and project descriptions are sent to the AI provider to word follow-up questions. Your name, email, phone number and links are removed first."],
  ["Leaderboards", "Nothing is public by default. If you publish a result, your name, college, branch, graduation year, verdict, score, attempt count and skills are shown. You can unpublish at any time."],
  ["Payments", "Handled by Razorpay. We keep the order reference and amount, never card or UPI details."],
  ["Deletion", "Delete your account from Profile at any time. Your resume files, interviews, transcripts and requests are removed immediately. Paid order references are kept without your identity, as tax records."],
];

export default function Privacy() {
  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-16">
        <Eyebrow>Privacy and data</Eyebrow>
        <h1 className="display mt-4 text-[48px]">What we collect, and what we never do.</h1>
        <p className="mt-5 text-[15px] leading-relaxed text-muted">This page describes how the product handles your data in plain words. It follows the principles of India&apos;s Digital Personal Data Protection Act: notice, consent, purpose limitation, and your right to access and erase.</p>
        <dl className="mt-10 divide-y divide-line border-y border-line">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-2 py-5 sm:grid-cols-[180px_1fr]">
              <dt className="text-[15px] text-fg">{k}</dt>
              <dd className="text-sm leading-relaxed text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </main>
      <Footer />
    </>
  );
}
