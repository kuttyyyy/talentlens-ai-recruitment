// CandidateCopilot.jsx
// Module 12 -- Candidate Copilot: a floating chat widget for candidates,
// available on every page (rendered from AppShell), that answers questions
// about their own jobs/applications/interviews using their real data, plus
// general job-search advice. Mirrors the existing Recruiter Copilot pattern
// in RecruiterDashboard.jsx, but scoped to the logged-in candidate only.

import { useEffect, useRef, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SUGGESTED_QUESTIONS = [
  "What's the status of my applications?",
  "How should I prepare for an interview?",
  "What is a CV-JD match score?",
];

function CandidateCopilot({ user }) {
  const storageKey = `candidate_copilot_messages_${user.id}`;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // sessionStorage unavailable -- chat still works, just won't persist across pages
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function askCopilot(customQuestion) {
    const q = (customQuestion ?? question).trim();
    if (!q || asking) return;

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setAsking(true);

    try {
      const res = await fetch(`${BASE_URL}/copilot/ask-candidate/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: data.answer }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.detail || "Something went wrong answering that." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Couldn't reach the server. Please try again." },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askCopilot();
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-80 sm:w-96 bg-surface border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gold" />
              <p className="text-text font-display text-sm">Candidate Copilot</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted hover:text-text text-sm leading-none"
              aria-label="Close copilot"
            >
              ✕
            </button>
          </div>

          <div className="px-4 pt-3 pb-1">
            <p className="text-muted text-xs">
              Ask about your applications, assessments, or interview prep.
            </p>
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {SUGGESTED_QUESTIONS.map((sq) => (
                <button
                  key={sq}
                  onClick={() => askCopilot(sq)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-muted hover:text-gold hover:border-gold/40 transition"
                >
                  {sq}
                </button>
              ))}
            </div>
          ) : (
            <div ref={scrollRef} className="flex flex-col gap-2 px-4 py-2 max-h-80 overflow-y-auto">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${
                    m.role === "user"
                      ? "bg-surface-2 border border-border text-text self-end"
                      : "bg-gold/10 border border-gold/30 text-text/90 self-start"
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {asking && <div className="text-sm text-muted self-start px-3 py-2">Thinking…</div>}
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-3 border-t border-border">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question…"
              className="flex-1 text-sm px-3 py-2 rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition"
            />
            <button
              onClick={() => askCopilot()}
              disabled={asking || !question.trim()}
              className="text-sm font-medium px-3 py-2 rounded-lg bg-gold text-ink hover:bg-gold-dim transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ask
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-14 h-14 rounded-full bg-gold text-ink shadow-xl flex items-center justify-center hover:bg-gold-dim transition text-2xl"
        aria-label={open ? "Close Candidate Copilot" : "Open Candidate Copilot"}
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}

export default CandidateCopilot;
