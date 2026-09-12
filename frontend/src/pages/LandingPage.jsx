// LandingPage.jsx
// The public marketing page shown at "/" before login. Structurally
// inspired by modern SaaS landing pages (a split hero with an annotated
// callout pointing at real product evidence), but built entirely from
// TalentLens's own brand and its actual capabilities -- the callout
// highlights a real evidence row from the CV-JD match feature, not a
// decorative mockup.
//
// Below the hero: what the product is, what it can actually do, how a
// candidate and a recruiter each move through it end to end (as one
// interactive flow diagram with a toggle, rather than two long lists),
// the principles behind it, and who it helps.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const PILLARS = [
  {
    title: "See the reasoning, not just the score",
    body: "Every match, every test result, every recommendation comes with the evidence behind it — cited, in plain language, not a black-box number.",
  },
  {
    title: "AI-aware, not AI-blind",
    body: "When a candidate uses AI tools on a practical task, TalentLens evaluates how well they used it — the prompts, the verification, the corrections — not just whether they did.",
  },
  {
    title: "Integrity without accusation",
    body: "Unusual activity during an assessment is flagged for a recruiter to review, with evidence and severity attached. It's never treated as proof of anything on its own.",
  },
  {
    title: "The recruiter always decides",
    body: "AI analyzes, drafts, scores, and flags. It never auto-hires, auto-rejects, or bans anyone. Every report ends the same way: recruiter review required.",
  },
];

const AI_FEATURES = [
  {
    icon: "document",
    title: "Resume Matching",
    body: "A candidate's resume is parsed into structured skills, education, and experience the moment it's uploaded — no manual data entry on either side.",
  },
  {
    icon: "target",
    title: "CV-JD Match",
    body: "Every application is scored against the job description with cited evidence for each requirement — strong, partial, or missing — never a bare percentage.",
  },
  {
    icon: "chart",
    title: "Assessment Analysis",
    body: "Three tailored tests per role — knowledge & reasoning, situational judgment, and a practical simulation — are generated from the JD and scored with reasoning attached.",
  },
  {
    icon: "shield",
    title: "Verification",
    body: "Submitted documents are cross-checked for consistency, institution phone numbers can be manually verified, and duplicate or altered files are flagged automatically.",
  },
  {
    icon: "chat",
    title: "Candidate Copilot",
    body: "A candidate can ask about their own applications, assessment status, or interview prep from anywhere in the app — answered from their real data, never guessed.",
  },
  {
    icon: "sparkle",
    title: "Interview Generation",
    body: "Categorized interview questions — technical, behavioral, situational, role-specific — are drafted straight from the job description in one click, and stay editable.",
  },
  {
    icon: "check",
    title: "AI Evaluation",
    body: "Once a candidate submits interview answers, AI produces a first-pass read — scored and summarized — for the recruiter to review, edit, or override entirely.",
  },
  {
    icon: "gauge",
    title: "Overall Score",
    body: "CV-JD match and assessment performance are blended into one transparent score, with the split between them fully recruiter-adjustable.",
  },
];

const CANDIDATE_STEPS = [
  { title: "Registration", body: "Create a candidate account in a couple of minutes." },
  { title: "Resume", body: "Upload your resume — skills, education, and experience are extracted automatically." },
  { title: "Job Matching", body: "See a CV-JD match score for each role, with the evidence behind it laid out plainly." },
  { title: "Assessment", body: "Complete three tests built for the specific role: knowledge, situational judgment, and practical work." },
  { title: "Practical Test", body: "Work through a real job-like task, with AI tools available where the recruiter allows them." },
  { title: "File Upload", body: "Attach your completed work — code, documents, designs — as evidence for the practical test." },
  { title: "Interview", body: "Once a recruiter sends questions, answer them directly from your own dashboard." },
  { title: "AI Evaluation", body: "Your interview answers get a first-pass AI read before any human review happens." },
  { title: "Overall Score", body: "See one transparent score, blending your resume match with your assessment results." },
  { title: "Recruiter Feedback", body: "Get real feedback and your score straight from the recruiter — not silence." },
  { title: "Selection", body: "Move forward, get held, or get a clear reason why not. Yours to act on next." },
];

const RECRUITER_STEPS = [
  { title: "Registration", body: "Create a recruiter account for your company." },
  { title: "Company Name", body: "Link your account to a shared company profile every recruiter on your team can see." },
  { title: "Post Job", body: "Paste in a job description — AI extracts the skills and responsibilities that actually matter." },
  { title: "Candidate Matching", body: "Every applicant is scored against the JD automatically, with evidence attached to each claim." },
  { title: "Verification", body: "Review submitted documents, place verification calls, and catch inconsistencies early." },
  { title: "Assessment Results", body: "See every test result broken down by category, with integrity flags where relevant." },
  { title: "Overall Score", body: "A single blended score combining resume match and assessment performance — tunable by you." },
  { title: "Interview", body: "Generate interview questions from the JD in one click and send them straight to the candidate." },
  { title: "AI Evaluation", body: "Get a first-pass AI read on submitted answers to save time, then edit anything before it's final." },
  { title: "Feedback", body: "Share scores and feedback with candidates directly — no more silence after a good interview." },
  { title: "Shortlist / Reject", body: "Make the final call, backed by evidence at every step along the way." },
];

const BENEFITS = {
  candidate: [
    "Know exactly why you matched, or didn't — never a black-box rejection.",
    "Real feedback and a real score from the recruiter, not silence after you apply.",
    "One dashboard for every application, test, and interview — nothing scattered across emails.",
    "AI tool use on practical work is evaluated fairly, not penalized by default.",
  ],
  recruiter: [
    "Cut screening time with AI that shows its reasoning, not just a score to trust blindly.",
    "Catch inconsistencies and fraud early with real document and phone verification.",
    "Every recommendation comes with evidence you can defend to your own team.",
    "You approve, edit, or override every AI output — nothing is ever auto-decided.",
  ],
};

function Icon({ name, className, style }) {
  const paths = {
    document: <path d="M7 3h7l4 4v14H7z M14 3v4h4 M9 12h6 M9 16h6" />,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></>,
    chart: <path d="M4 20V4 M4 20h16 M8 16v-5 M13 16V8 M18 16v-8" />,
    shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9 12l2 2 4-4" />,
    chat: <path d="M4 5h16v11H8l-4 4z" />,
    sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
    check: <path d="M4 12l5 5L20 6" />,
    gauge: <path d="M4 15a8 8 0 1116 0 M12 15l4-5 M12 15h.01" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      {paths[name]}
    </svg>
  );
}

function useRevealOnScroll() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}

function AIFeatureAccordion({ features }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="border-t border-border">
      {features.map((f, i) => {
        const open = openIndex === i;
        return (
          <div key={f.title} className="border-b border-border">
            <button
              onClick={() => setOpenIndex(open ? -1 : i)}
              className="w-full flex items-center gap-4 py-5 text-left group"
            >
              <Icon name={f.icon} className={`w-5 h-5 shrink-0 transition-colors ${open ? "text-gold" : "text-muted group-hover:text-text"}`} />
              <span className={`font-display text-lg transition-colors ${open ? "text-text" : "text-muted group-hover:text-text"}`}>
                {f.title}
              </span>
              <span className={`ml-auto text-muted text-xl leading-none transition-transform duration-300 ${open ? "rotate-45" : ""}`}>
                +
              </span>
            </button>
            <div
              className="grid transition-all duration-300 ease-out"
              style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="text-muted text-sm leading-relaxed pb-5 pl-9 max-w-xl">{f.body}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JourneyFlow({ steps, accentVar }) {
  const [active, setActive] = useState(0);
  const accentColor = `var(--color-${accentVar})`;

  return (
    <div>
      {/* Node row -- horizontally scrollable on small screens */}
      <div className="flex items-stretch overflow-x-auto pb-4 -mx-1 px-1 gap-0 scrollbar-thin">
        {steps.map((s, i) => (
          <div key={s.title} className="flex items-center shrink-0">
            <button
              onClick={() => setActive(i)}
              className="flex flex-col items-center gap-2 w-[92px] group"
            >
              <span
                className="w-9 h-9 rounded-full border flex items-center justify-center text-xs font-mono transition-all"
                style={
                  active === i
                    ? { borderColor: accentColor, color: accentColor, backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)` }
                    : { borderColor: "var(--color-border)", color: "var(--color-muted)" }
                }
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`text-[11px] leading-tight text-center transition-colors ${active === i ? "text-text" : "text-muted group-hover:text-text"}`}
              >
                {s.title}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="w-6 md:w-8 h-px shrink-0 mb-6" style={{ backgroundColor: "var(--color-border)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Active step detail */}
      <div
        className="mt-6 rounded-xl border p-6 md:p-7"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
      >
        <p className="font-mono text-xs tracking-widest mb-2" style={{ color: accentColor }}>
          STEP {String(active + 1).padStart(2, "0")} OF {steps.length}
        </p>
        <p className="font-display text-2xl text-text mb-2">{steps[active].title}</p>
        <p className="text-muted text-sm leading-relaxed max-w-lg">{steps[active].body}</p>
        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setActive((a) => Math.max(0, a - 1))}
            disabled={active === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text disabled:opacity-30 transition"
          >
            ← Back
          </button>
          <button
            onClick={() => setActive((a) => Math.min(steps.length - 1, a + 1))}
            disabled={active === steps.length - 1}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-text disabled:opacity-30 transition"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const [heroMounted, setHeroMounted] = useState(false);
  const [journeyAudience, setJourneyAudience] = useState("candidate");

  const [aboutRef, aboutVisible] = useRevealOnScroll();
  const [featuresRef, featuresVisible] = useRevealOnScroll();
  const [journeyRef, journeyVisible] = useRevealOnScroll();
  const [pillarsRef, pillarsVisible] = useRevealOnScroll();
  const [benefitsRef, benefitsVisible] = useRevealOnScroll();

  useEffect(() => {
    // One orchestrated entrance moment for the hero, on page load only --
    // deliberately not repeated as a scroll-triggered effect on every
    // section below.
    const t = setTimeout(() => setHeroMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const activeSteps = journeyAudience === "candidate" ? CANDIDATE_STEPS : RECRUITER_STEPS;
  const activeAccent = journeyAudience === "candidate" ? "gold" : "signal";

  return (
    <div className="min-h-screen bg-ink text-text">
      <style>{`
        @keyframes tl-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tl-pulse-ring {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.04); }
        }
        @keyframes tl-callout-in {
          from { opacity: 0; transform: translate(-8px, 6px) scale(0.96); }
          to { opacity: 1; transform: translate(0, 0) scale(1); }
        }
        .tl-rise { animation: tl-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .tl-ring { animation: tl-pulse-ring 5s ease-in-out infinite; }
        .tl-callout { animation: tl-callout-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .scrollbar-thin::-webkit-scrollbar { height: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) {
          .tl-rise, .tl-ring, .tl-callout { animation: none !important; }
        }
      `}</style>

      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-ink/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="font-display text-xl text-text">TalentLens</p>
          <nav className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-muted hover:text-text transition px-3 py-2"
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-gold hover:bg-gold-dim transition text-ink px-4 py-2 rounded-lg"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <p
            className={`font-mono text-xs text-gold tracking-widest mb-4 ${heroMounted ? "tl-rise" : "opacity-0"}`}
            style={{ animationDelay: "0ms" }}
          >
            AI RECRUITMENT, EXPLAINED
          </p>
          <h1
            className={`font-display text-4xl md:text-5xl leading-tight text-text mb-5 ${heroMounted ? "tl-rise" : "opacity-0"}`}
            style={{ animationDelay: "80ms" }}
          >
            Hiring decisions your team can actually explain.
          </h1>
          <p
            className={`text-muted text-lg leading-relaxed mb-8 max-w-md ${heroMounted ? "tl-rise" : "opacity-0"}`}
            style={{ animationDelay: "160ms" }}
          >
            TalentLens turns a job description into AI-built assessments and
            evidence-based candidate reports — every recommendation reasoned
            out loud, with the final call always left to a person.
          </p>
          <div
            className={`flex items-center gap-3 ${heroMounted ? "tl-rise" : "opacity-0"}`}
            style={{ animationDelay: "240ms" }}
          >
            <Link
              to="/register"
              className="bg-gold hover:bg-gold-dim transition text-ink font-semibold px-5 py-3 rounded-lg"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="border border-border hover:border-gold/40 text-text px-5 py-3 rounded-lg transition"
            >
              Log In
            </Link>
          </div>
        </div>

        {/* Hero visual: a real evidence card from the product, with an
            annotated spotlight callout pointing at one row -- the single
            characteristic visual moment for this page. */}
        <div className={`relative ${heroMounted ? "tl-rise" : "opacity-0"}`} style={{ animationDelay: "200ms" }}>
          <div className="absolute -inset-10 pointer-events-none">
            <div className="tl-ring absolute top-8 right-4 w-64 h-64 rounded-full border border-gold/20" />
            <div className="tl-ring absolute top-8 right-4 w-44 h-44 rounded-full border border-gold/25" style={{ animationDelay: "1.2s" }} />
          </div>

          <div className="relative bg-surface border border-border rounded-xl p-5 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between mb-4">
              <p className="text-text font-display text-lg">CV-JD Match Detail</p>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border text-success bg-success/10 border-success/30">
                87% alignment
              </span>
            </div>

            <div className="overflow-hidden border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted uppercase tracking-wide bg-ink/40">
                    <th className="text-left px-3 py-2">Requirement</th>
                    <th className="text-left px-3 py-2">Evidence</th>
                    <th className="text-left px-3 py-2">Match</th>
                  </tr>
                </thead>
                <tbody className="text-text">
                  <tr className="border-b border-border">
                    <td className="px-3 py-2">Python</td>
                    <td className="px-3 py-2 text-muted">2 yrs, backend APIs</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border text-success bg-success/10 border-success/30">Strong</span>
                    </td>
                  </tr>
                  <tr className="border-b border-border relative">
                    <td className="px-3 py-2">Financial modeling</td>
                    <td className="px-3 py-2 text-muted">Mentioned once, no detail</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border text-gold bg-gold/10 border-gold/30">Partial</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Team leadership</td>
                    <td className="px-3 py-2 text-muted">Not found in resume</td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border text-danger bg-danger/10 border-danger/30">Missing</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-gold font-medium mt-3">
              AI Recommendation → Recruiter Review Required
            </p>
          </div>

          {/* Spotlight callout, staggered in after the card */}
          <div
            className="tl-callout absolute -bottom-8 -left-8 max-w-[240px] bg-surface-2 border border-gold/30 rounded-lg p-3.5 shadow-xl shadow-black/40"
            style={{ animationDelay: "650ms" }}
          >
            <p className="text-xs text-text leading-relaxed">
              <span className="text-gold font-semibold">Why "Partial"?</span>{" "}
              The AI cites exactly what it found — and what it didn't — so
              you never have to take a score on faith.
            </p>
          </div>
        </div>
      </section>

      {/* About */}
      <section ref={aboutRef} className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <div className={`grid md:grid-cols-2 gap-12 ${aboutVisible ? "tl-rise" : "opacity-0"}`}>
          <div>
            <p className="font-mono text-xs text-gold tracking-widest mb-3">ABOUT TALENTLENS</p>
            <h2 className="font-display text-3xl text-text leading-snug mb-5">
              Recruitment software that shows its work.
            </h2>
            <p className="text-muted leading-relaxed max-w-md">
              Most hiring tools hand you a score and ask you to trust it.
              TalentLens hands you the reasoning behind every score instead —
              which requirements a resume actually meets, how a candidate
              performed on tests built for that exact role, and where a
              submitted document doesn't add up. The decision still belongs
              to a person; the evidence just gets there first.
            </p>
          </div>
          <div className="grid gap-6">
            <div className="border-l-2 border-danger/40 pl-5">
              <p className="text-text font-medium mb-1.5">The problem</p>
              <p className="text-muted text-sm leading-relaxed">
                Manual screening doesn't scale, and most AI screening tools
                can't explain themselves. Recruiters end up approving a
                black-box number, and candidates never learn why they didn't
                get through.
              </p>
            </div>
            <div className="border-l-2 border-success/40 pl-5">
              <p className="text-text font-medium mb-1.5">How TalentLens fixes it</p>
              <p className="text-muted text-sm leading-relaxed">
                It builds the assessment from your job description,
                evaluates every submission with cited evidence, and verifies
                what candidates claim about themselves — while leaving every
                hire-or-reject decision to a person.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Features */}
      <section ref={featuresRef} className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <div className={featuresVisible ? "tl-rise" : "opacity-0"}>
          <p className="font-mono text-xs text-gold tracking-widest mb-3">AI FEATURES</p>
          <h2 className="font-display text-3xl text-text mb-4 max-w-lg">
            Eight ways AI does the groundwork, so people can make the call.
          </h2>
          <p className="text-muted text-sm mb-6">Tap a feature to see what it actually does.</p>
          <AIFeatureAccordion features={AI_FEATURES} />
        </div>
      </section>

      {/* Candidate / Recruiter Journey */}
      <section ref={journeyRef} className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <div className={journeyVisible ? "tl-rise" : "opacity-0"}>
          <p className="font-mono text-xs tracking-widest mb-3" style={{ color: `var(--color-${activeAccent})` }}>
            HOW IT WORKS
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <h2 className="font-display text-3xl text-text max-w-lg">
              {journeyAudience === "candidate"
                ? "Every step from signing up to hearing back."
                : "Every step from posting a job to making the call."}
            </h2>
            <div className="flex bg-surface-2 border border-border rounded-lg p-1">
              <button
                onClick={() => setJourneyAudience("candidate")}
                className={`text-sm px-4 py-2 rounded-md transition font-medium ${
                  journeyAudience === "candidate" ? "bg-gold text-ink" : "text-muted hover:text-text"
                }`}
              >
                Candidate Journey
              </button>
              <button
                onClick={() => setJourneyAudience("recruiter")}
                className={`text-sm px-4 py-2 rounded-md transition font-medium ${
                  journeyAudience === "recruiter" ? "text-ink" : "text-muted hover:text-text"
                }`}
                style={journeyAudience === "recruiter" ? { backgroundColor: "var(--color-signal)" } : {}}
              >
                Recruiter Journey
              </button>
            </div>
          </div>

          <JourneyFlow steps={activeSteps} accentVar={activeAccent} />
        </div>
      </section>

      {/* Principles */}
      <section ref={pillarsRef} className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <div className={pillarsVisible ? "tl-rise" : "opacity-0"}>
          <p className="font-mono text-xs text-gold tracking-widest mb-3">OUR PRINCIPLES</p>
          <h2 className="font-display text-3xl text-text mb-14 max-w-lg">
            Built to support a decision, never to make one for you.
          </h2>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
            {PILLARS.map((p) => (
              <div key={p.title} className="border-l-2 border-gold/40 pl-5">
                <p className="text-text font-medium mb-1.5">{p.title}</p>
                <p className="text-muted text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section ref={benefitsRef} className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <div className={benefitsVisible ? "tl-rise" : "opacity-0"}>
          <p className="font-mono text-xs text-gold tracking-widest mb-3">WHO IT HELPS</p>
          <h2 className="font-display text-3xl text-text mb-14 max-w-lg">
            Built for both sides of the hiring table.
          </h2>

          <div className="grid md:grid-cols-2 gap-10">
            <div className="bg-surface border border-border rounded-xl p-7">
              <p className="font-display text-xl text-gold mb-5">For Candidates</p>
              <ul className="flex flex-col gap-4">
                {BENEFITS.candidate.map((b) => (
                  <li key={b} className="flex gap-3 text-sm text-muted leading-relaxed">
                    <Icon name="check" className="w-4 h-4 shrink-0 mt-0.5 text-gold" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface border border-border rounded-xl p-7">
              <p className="font-display text-xl mb-5" style={{ color: "var(--color-signal)" }}>For Recruiters</p>
              <ul className="flex flex-col gap-4">
                {BENEFITS.recruiter.map((b) => (
                  <li key={b} className="flex gap-3 text-sm text-muted leading-relaxed">
                    <Icon name="check" className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-signal)" }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 border-t border-border text-center">
        <h2 className="font-display text-3xl md:text-4xl text-text mb-4">
          See it on your next job posting.
        </h2>
        <p className="text-muted mb-8 max-w-md mx-auto">
          Set up a job, let TalentLens build the assessment, and see the
          evidence for yourself.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/register"
            className="bg-gold hover:bg-gold-dim transition text-ink font-semibold px-5 py-3 rounded-lg"
          >
            Get Started
          </Link>
          <Link
            to="/login"
            className="border border-border hover:border-gold/40 text-text px-5 py-3 rounded-lg transition"
          >
            Log In
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <p className="font-display text-text">TalentLens</p>
          <p className="text-muted text-xs">© {new Date().getFullYear()} TalentLens</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
