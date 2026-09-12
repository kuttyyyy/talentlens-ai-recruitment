// LandingPage.jsx
// The public marketing page shown at "/" before login. Structurally
// inspired by modern SaaS landing pages (a split hero with an annotated
// callout pointing at real product evidence), but built entirely from
// TalentLens's own brand and its actual capabilities -- the callout
// highlights a real evidence row from the CV-JD match feature, not a
// decorative mockup.

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

const STEPS = [
  {
    n: "01",
    title: "Post a job, let AI read it",
    body: "Paste in a job description. The JD Analysis Agent extracts the skills, qualifications, and responsibilities that actually matter.",
  },
  {
    n: "02",
    title: "AI builds the assessment, you approve it",
    body: "Three tailored tests are generated from the JD alone — knowledge & reasoning, situational judgment, and a practical simulation. Edit anything before it goes live.",
  },
  {
    n: "03",
    title: "Candidates apply and take the tests",
    body: "CVs are matched against the JD with cited evidence. Candidates complete the approved tests, AI tools included where you allow them.",
  },
  {
    n: "04",
    title: "You get an evidence-based report",
    body: "Scores, strengths, integrity flags, suggested interview topics — all with reasoning attached. You make the final call.",
  },
];

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

function LandingPage() {
  const [heroMounted, setHeroMounted] = useState(false);
  const [stepsRef, stepsVisible] = useRevealOnScroll();

  useEffect(() => {
    // One orchestrated entrance moment for the hero, on page load only --
    // deliberately not repeated as a scroll-triggered effect on every
    // section below.
    const t = setTimeout(() => setHeroMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

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

      {/* How it works */}
      <section ref={stepsRef} className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <p className="font-mono text-xs text-gold tracking-widest mb-3">HOW IT WORKS</p>
        <h2 className="font-display text-3xl text-text mb-14 max-w-lg">
          From a job description to a decision you can stand behind.
        </h2>

        <div className="grid md:grid-cols-4 gap-8">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className={stepsVisible ? "tl-rise" : "opacity-0"}
              style={{ animationDelay: stepsVisible ? `${i * 90}ms` : "0ms" }}
            >
              <p className="font-display text-3xl text-gold/50 mb-3">{step.n}</p>
              <p className="text-text font-medium mb-2">{step.title}</p>
              <p className="text-muted text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature pillars */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <p className="font-mono text-xs text-gold tracking-widest mb-3">WHAT IT DOES</p>
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
