// TakeTest.jsx
// Module 4 -- the actual test-taking experience for a candidate.
//
// Flow: an intro/consent screen showing duration, allowed tools, AI policy,
// and privacy info -> Start (begins the clock) -> question-by-question
// (Test 1 & 2) or single-task (Test 3) interface with a countdown timer,
// autosave, and a locked read-only view once submitted.

import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import { apiRequest } from "../api/client";

const TEST_META = {
  knowledge_reasoning: { label: "Test 1 -- Knowledge & Reasoning" },
  situational_judgment: { label: "Test 2 -- Job Situational Judgment" },
  practical_simulation: { label: "Test 3 -- Practical Job Simulation" },
};

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function TakeTest() {
  const { applicationId, testId } = useParams();
  const user = JSON.parse(localStorage.getItem("user"));
  const [attempt, setAttempt] = useState(null); // raw response from start
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Practical task submission text (test 3 only)
  const [practicalSubmission, setPracticalSubmission] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  const [aiPromptsUsed, setAiPromptsUsed] = useState("");
  const [aiOutputNotes, setAiOutputNotes] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [filesSubmitted, setFilesSubmitted] = useState("");

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  // Integrity instrumentation -- captured now, surfaced by a later module
  const integrityRef = useRef({ tab_switches: 0, blur_count: 0 });
  const timerRef = useRef(null);

  // Load the test's rules up-front (duration, AI/internet policy, required
  // software, etc.) WITHOUT starting the clock, so the consent screen can
  // show the real details instead of placeholders.
  useEffect(() => {
    async function loadPreview() {
      try {
        const data = await apiRequest(`/test-attempts/preview/${testId}`);
        setPreview(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setPreviewLoading(false);
      }
    }
    loadPreview();
  }, [testId]);

  async function beginAttempt() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(
        `/test-attempts/start?application_id=${applicationId}&assessment_test_id=${testId}&candidate_id=${user.id}`,
        "POST"
      );
      setAttempt(data);
      setAnswers(data.answers || {});
      setPracticalSubmission(data.answers?.submission_text || "");
      setAiUsed(!!data.answers?.ai_used);
      setAiPromptsUsed(data.answers?.ai_prompts_used || "");
      setAiOutputNotes(data.answers?.ai_output_notes || "");
      setVerificationNotes(data.answers?.verification_notes || "");
      setFilesSubmitted(data.answers?.files_submitted || "");
      if (data.status === "submitted") {
        setSubmitted(true);
      } else {
        setStarted(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Timer
  useEffect(() => {
    if (!started || !attempt?.started_at || submitted) return;

    function tick() {
      const startedAt = new Date(attempt.started_at).getTime();
      const deadline = startedAt + attempt.duration_minutes * 60 * 1000;
      const remaining = Math.floor((deadline - Date.now()) / 1000);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        handleSubmit(true);
      }
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, attempt, submitted]);

  // Integrity instrumentation -- tab switches / focus loss
  useEffect(() => {
    if (!started || submitted) return;
    function onVisibilityChange() {
      if (document.hidden) integrityRef.current.tab_switches += 1;
    }
    function onBlur() {
      integrityRef.current.blur_count += 1;
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [started, submitted]);

  function currentAnswers() {
    if (attempt?.test_type === "practical_simulation") {
      return {
        submission_text: practicalSubmission,
        ai_used: aiUsed,
        ai_prompts_used: aiUsed ? aiPromptsUsed : "",
        ai_output_notes: aiUsed ? aiOutputNotes : "",
        verification_notes: aiUsed ? verificationNotes : "",
        files_submitted: filesSubmitted,
      };
    }
    return answers;
  }

  async function saveProgress() {
    if (!attempt || submitted) return;
    try {
      await apiRequest(`/test-attempts/${attempt.attempt_id}/save`, "PUT", {
        answers: currentAnswers(),
        integrity_events: integrityRef.current,
      });
    } catch {
      // Non-fatal -- autosave failures shouldn't interrupt the candidate
    }
  }

  async function handleSubmit(auto = false) {
    if (!attempt || submitted) return;
    if (!auto && !window.confirm("Submit this test? You won't be able to change your answers afterward.")) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiRequest(`/test-attempts/${attempt.attempt_id}/submit`, "POST", {
        answers: currentAnswers(),
        integrity_events: integrityRef.current,
      });
      setSubmitted(true);
      clearInterval(timerRef.current);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function updateAnswer(questionIndex, value) {
    setAnswers((prev) => ({ ...prev, [questionIndex]: value }));
  }

  function goToQuestion(index) {
    saveProgress();
    setCurrentIndex(index);
  }

  // --- Intro / consent screen (before starting) ---
  if (!started && !submitted) {
    const isPracticalPreview = preview?.test_type === "practical_simulation";
    return (
      <AppShell>
        <Link to="/my-assessments" className="text-muted text-sm hover:text-text">← My Assessments</Link>
        <p className="font-mono text-xs text-gold tracking-widest mt-2 mb-2">BEFORE YOU START</p>
        <h1 className="font-display text-3xl text-text mb-1">{preview?.title || "Test Instructions"}</h1>
        {preview?.instructions && <p className="text-muted text-sm mb-6 max-w-xl">{preview.instructions}</p>}

        {error && (
          <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-xl">
            {error}
          </div>
        )}

        {previewLoading ? (
          <p className="text-muted text-sm">Loading test details...</p>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-6 max-w-xl flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">Duration</p>
                <p className="text-text">{preview?.duration_minutes} minutes</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">Submission</p>
                <p className="text-text">Auto-submits when time runs out</p>
              </div>
            </div>

            {isPracticalPreview && (
              <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">AI Tools</p>
                  <p className="text-text">{preview.ai_allowed === "allowed" ? "Allowed" : "Not Allowed"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Internet Access</p>
                  <p className="text-text">{preview.internet_allowed === "allowed" ? "Allowed" : "Not Allowed"}</p>
                </div>
                {preview.ai_allowed === "allowed" && preview.allowed_tools && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted uppercase tracking-wide">Allowed Tools</p>
                    <p className="text-text">{preview.allowed_tools}</p>
                  </div>
                )}
                {preview.required_software?.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted uppercase tracking-wide">Required Software</p>
                    <p className="text-text">{preview.required_software.join(", ")}</p>
                  </div>
                )}
                {preview.submission_format && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted uppercase tracking-wide">Submission Format</p>
                    <p className="text-text">{preview.submission_format}</p>
                  </div>
                )}
                {preview.required_files?.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted uppercase tracking-wide">Files to Submit</p>
                    <p className="text-text">{preview.required_files.join(", ")}</p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Privacy & Consent</p>
              <p className="text-muted text-sm leading-relaxed">
                Your answers, along with basic activity signals (like leaving this page or losing
                focus), will be visible to the recruiter for this job when they review your
                submission. This is used only to support their hiring decision -- it does not
                automatically accept or reject you, and the recruiter makes the final call.
              </p>
              {isPracticalPreview && preview?.proof_of_work_required && (
                <p className="text-muted text-sm leading-relaxed mt-2">
                  This task asks you to briefly describe your process as proof of work. No
                  screen or video recording is captured in this prototype.
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm text-text mt-2">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1"
              />
              I understand and agree to start this test.
            </label>

            <button
              onClick={beginAttempt}
              disabled={!consentChecked || loading}
              className="bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-40 mt-2"
            >
              {loading ? "Starting..." : "Start Test"}
            </button>
          </div>
        )}
      </AppShell>
    );
  }

  // --- Submitted (locked, read-only) ---
  if (submitted) {
    return (
      <AppShell>
        <Link to="/my-assessments" className="text-muted text-sm hover:text-text">← My Assessments</Link>
        <div className="bg-success/10 border border-success/40 text-success rounded-xl p-6 max-w-xl mt-4">
          <p className="font-display text-xl mb-1">✓ Test Submitted</p>
          <p className="text-sm">
            Your answers have been recorded and can no longer be edited. The recruiter will review
            your results as part of their evaluation.
          </p>
        </div>
      </AppShell>
    );
  }

  // --- In progress ---
  const meta = TEST_META[attempt.test_type] || { label: attempt.title };
  const questions = attempt.content?.questions || attempt.content?.scenarios || [];
  const isPractical = attempt.test_type === "practical_simulation";

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4 max-w-3xl">
        <div>
          <p className="font-mono text-xs text-gold tracking-widest mb-1">{meta.label}</p>
          <h1 className="font-display text-2xl text-text">{attempt.title}</h1>
        </div>
        {secondsLeft !== null && (
          <div className={`text-lg font-mono px-4 py-2 rounded-lg border ${secondsLeft < 60 ? "text-danger border-danger/40 bg-danger/10" : "text-gold border-gold/30 bg-gold/10"}`}>
            {formatTime(secondsLeft)}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/40 text-danger text-sm rounded-lg px-3 py-2 mb-4 max-w-3xl">
          {error}
        </div>
      )}

      {attempt.instructions && (
        <p className="text-muted text-sm mb-6 max-w-3xl">{attempt.instructions}</p>
      )}

      {isPractical ? (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-3xl flex flex-col gap-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Task</p>
            <p className="text-text text-sm whitespace-pre-wrap">{attempt.content?.task_description}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Deliverable Instructions</p>
            <p className="text-text text-sm whitespace-pre-wrap">{attempt.content?.deliverable_instructions}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 bg-ink/40 border border-border rounded-lg p-4 text-sm">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">AI Tools</p>
              <p className="text-text">{attempt.ai_allowed === "allowed" ? "Allowed" : "Not Allowed"}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Allowed Tools</p>
              <p className="text-text">{attempt.allowed_tools || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Internet Access</p>
              <p className="text-text">{attempt.internet_allowed === "allowed" ? "Allowed" : "Not Allowed"}</p>
            </div>
            {attempt.content?.required_software?.length > 0 && (
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">Required Software</p>
                <p className="text-text">{attempt.content.required_software.join(", ")}</p>
              </div>
            )}
            {attempt.content?.submission_format && (
              <div className="col-span-2">
                <p className="text-xs text-muted uppercase tracking-wide">Submission Format</p>
                <p className="text-text">{attempt.content.submission_format}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Your Submission</p>
            <textarea
              rows={10}
              value={practicalSubmission}
              onChange={(e) => setPracticalSubmission(e.target.value)}
              onBlur={saveProgress}
              placeholder="Paste your work, notes, code, or a summary of what you did here..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition text-sm font-mono resize-none"
            />
          </div>

          {attempt.content?.required_files?.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">
                Files to Submit ({attempt.content.required_files.join(", ")})
              </p>
              <textarea
                rows={2}
                value={filesSubmitted}
                onChange={(e) => setFilesSubmitted(e.target.value)}
                onBlur={saveProgress}
                placeholder="Since file upload isn't available in this prototype, briefly describe each file's contents here..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition text-sm resize-none"
              />
            </div>
          )}

          {attempt.ai_allowed === "allowed" && (
            <div className="border-t border-border pt-4 flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={aiUsed}
                  onChange={(e) => {
                    setAiUsed(e.target.checked);
                    saveProgress();
                  }}
                />
                I used an AI tool while completing this task
              </label>

              {aiUsed && (
                <>
                  <p className="text-xs text-muted/70 -mt-1">
                    This isn't scored on whether you used AI — it's about how effectively you used it.
                  </p>
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">Prompts You Used</p>
                    <textarea
                      rows={3}
                      value={aiPromptsUsed}
                      onChange={(e) => setAiPromptsUsed(e.target.value)}
                      onBlur={saveProgress}
                      placeholder="What did you ask the AI tool?"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition text-sm resize-none"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">What the AI Gave You</p>
                    <textarea
                      rows={3}
                      value={aiOutputNotes}
                      onChange={(e) => setAiOutputNotes(e.target.value)}
                      onBlur={saveProgress}
                      placeholder="Summarize the AI's output"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition text-sm resize-none"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">
                      How You Verified or Corrected It
                    </p>
                    <textarea
                      rows={3}
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      onBlur={saveProgress}
                      placeholder="What did you check, fix, or change before using it in your final answer?"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition text-sm resize-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="bg-gold hover:bg-gold-dim transition text-ink font-semibold py-2.5 rounded-lg disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Test"}
          </button>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-3xl">
          <p className="text-xs text-muted mb-4">
            Question {currentIndex + 1} of {questions.length}
          </p>

          {questions[currentIndex] && (
            <div>
              <p className="text-text text-base mb-4">
                {questions[currentIndex].question || questions[currentIndex].scenario}
              </p>
              {questions[currentIndex].scenario && questions[currentIndex].question && (
                <p className="text-text text-sm font-medium mb-4">{questions[currentIndex].question}</p>
              )}

              {Array.isArray(questions[currentIndex].options) ? (
                <div className="flex flex-col gap-2">
                  {questions[currentIndex].options.map((opt, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border cursor-pointer text-sm transition ${
                        answers[currentIndex] === opt
                          ? "border-gold bg-gold/10 text-text"
                          : "border-border text-muted hover:border-gold/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${currentIndex}`}
                        checked={answers[currentIndex] === opt}
                        onChange={() => updateAnswer(currentIndex, opt)}
                        className="hidden"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  rows={4}
                  value={answers[currentIndex] || ""}
                  onChange={(e) => updateAnswer(currentIndex, e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-2 border border-border text-text placeholder:text-muted/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition text-sm resize-none"
                />
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <button
              onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="text-sm text-muted hover:text-text disabled:opacity-30"
            >
              ← Previous
            </button>

            <div className="flex gap-1">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToQuestion(i)}
                  className={`w-2 h-2 rounded-full transition ${
                    i === currentIndex ? "bg-gold" : answers[i] !== undefined ? "bg-success/60" : "bg-border"
                  }`}
                />
              ))}
            </div>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => goToQuestion(currentIndex + 1)}
                className="text-sm text-gold hover:text-gold-dim"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-gold hover:bg-gold-dim transition text-ink disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Test"}
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default TakeTest;
